import { ChevronLeft, ChevronRight } from "lucide-react"
import {
	Link,
	type LoaderFunctionArgs,
	useLoaderData,
	useNavigation,
	useRevalidator,
	useRouteError,
	useSearchParams,
} from "react-router"
import { singleConnectionAccounts } from "@/accounts"
import { monthLink } from "@/calendar"
import {
	MeetingNotes,
	type MeetingSection,
} from "@/components/presentation/meeting-notes"
import { Preview, SourceIdentity, Timestamp } from "@/components/presentation/primitives"
import { Button } from "@/components/ui/button"
import {
	type GranolaMeeting,
	type GranolaTranscript,
	readGranolaMeetings,
} from "@/granola"

type GranolaViewData = {
	month: string
	meetings: GranolaMeeting[]
	meeting?: GranolaMeeting
	transcript: GranolaTranscript | null
}

const monthDate = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" })

export async function granolaLoader({
	request,
}: LoaderFunctionArgs): Promise<GranolaViewData> {
	const params = new URL(request.url).searchParams
	const id = params.get("meeting")
	const detail = id ? await window.granola.meeting(id) : null
	const meeting = detail ? readGranolaMeetings(detail)[0] : undefined
	const now = new Date()
	const month =
		params.get("month") ??
		meeting?.date.slice(0, 7) ??
		`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
	const [list, transcript] = await Promise.all([
		window.granola.list(month),
		id && params.get("view") === "transcript" ? window.granola.transcript(id) : null,
	])
	return {
		meeting,
		meetings: readGranolaMeetings(list),
		month,
		transcript,
	}
}

export function GranolaView() {
	const { meetings, meeting, month, transcript } = useLoaderData() as GranolaViewData
	const [params, setParams] = useSearchParams()
	const navigation = useNavigation()
	const revalidator = useRevalidator()
	const view = params.get("view") ?? "summary"
	return (
		<div className="flex min-h-0 min-w-0 flex-1">
			<aside
				className={`flex min-h-0 w-80 shrink-0 flex-col border-r bg-muted/30 @4xl/content:w-96 @max-3xl/content:w-full @max-3xl/content:border-r-0 ${meeting ? "@max-3xl/content:hidden" : ""}`}
				aria-label="Granola meetings"
			>
				<header className="flex items-center justify-between gap-4 p-6">
					<div>
						<h1 className="mb-2 text-lg font-semibold">Meetings</h1>
						<SourceIdentity
							provider="granola"
							account={singleConnectionAccounts.granola}
						/>
					</div>
					<Button
						variant="outline"
						size="sm"
						disabled={revalidator.state !== "idle"}
						onClick={async () => {
							await window.granola.refresh()
							revalidator.revalidate()
						}}
					>
						Refresh
					</Button>
				</header>
				<nav
					className="flex items-center justify-between px-6 pb-4 text-sm"
					aria-label="Meeting month"
				>
					<Link
						className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
						to={monthLink(month, -1)}
						aria-label="Previous month"
					>
						<ChevronLeft size={16} />
					</Link>
					<span>{monthDate.format(new Date(`${month}-01T12:00:00`))}</span>
					<Link
						className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
						to={monthLink(month, 1)}
						aria-label="Next month"
					>
						<ChevronRight size={16} />
					</Link>
				</nav>
				<nav
					className="min-h-0 flex-1 overflow-y-auto px-3 pb-6"
					aria-label="Meetings"
					aria-busy={navigation.state !== "idle"}
				>
					{meetings.map((item) => (
						<Link
							key={item.id}
							aria-current={meeting?.id === item.id ? "page" : undefined}
							className={`block rounded-md px-3 py-4 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${meeting?.id === item.id ? "bg-accent" : ""}`}
							to={`?${new URLSearchParams({ meeting: item.id, month })}`}
						>
							<Preview
								title={item.title}
								identity={
									<SourceIdentity
										provider="granola"
										account={singleConnectionAccounts.granola}
									/>
								}
								meta={<Timestamp value={item.date} />}
							/>
						</Link>
					))}
					{meetings.length === 0 && (
						<p className="px-3 py-6 text-sm text-muted-foreground">
							No meetings this month.
						</p>
					)}
				</nav>
			</aside>
			<main
				className={`min-h-0 min-w-0 flex-1 overflow-y-auto p-6 @4xl/content:p-10 ${meeting ? "" : "@max-3xl/content:hidden"}`}
				aria-label="Meeting notes"
				aria-busy={navigation.state !== "idle"}
			>
				{meeting ? (
					<div className="mx-auto max-w-4xl">
						<Link
							className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
							to={`?month=${month}`}
						>
							Back to meetings
						</Link>
						<MeetingNotes
							key={meeting.id}
							meeting={meeting}
							section={view as MeetingSection}
							transcript={transcript}
							onSectionChange={(value) => {
								const next = new URLSearchParams(params)
								next.set("view", value)
								setParams(next)
							}}
						/>
					</div>
				) : (
					<div className="flex min-h-full w-full flex-col items-center justify-center gap-4 p-10 text-center">
						<h2 className="text-xl font-semibold">Meetings, remembered.</h2>
						<p className="max-w-prose text-sm text-muted-foreground">
							Choose a meeting to read its notes and transcript.
						</p>
					</div>
				)}
			</main>
		</div>
	)
}

export function LoadingGranola() {
	return (
		<main
			className="flex min-h-full w-full flex-col items-center justify-center gap-4 p-10 text-center"
			role="status"
		>
			<h2 className="text-xl font-semibold">Opening Granola…</h2>
			<p className="max-w-prose text-sm text-muted-foreground">Getting your meetings.</p>
		</main>
	)
}

export function GranolaError() {
	const error = useRouteError()
	return (
		<main
			className="flex min-h-full w-full flex-col items-center justify-center gap-4 p-10 text-center"
			role="alert"
		>
			<h2 className="text-xl font-semibold">Granola couldn’t load.</h2>
			<p className="max-w-prose text-sm text-muted-foreground">
				{error instanceof Error ? error.message : "The Granola read failed."}
			</p>
			<Button onClick={() => window.location.reload()}>Try again</Button>
		</main>
	)
}
