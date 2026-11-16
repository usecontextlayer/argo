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
import { singleConnectionAccounts } from "@/provider-identity"

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
	const now = new Date()
	const month =
		params.get("month") ??
		`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
	const id = params.get("meeting")
	const [list, detail, transcript] = await Promise.all([
		window.granola.list(month),
		id ? window.granola.meeting(id) : null,
		id && params.get("view") === "transcript" ? window.granola.transcript(id) : null,
	])
	return {
		meeting: detail ? readGranolaMeetings(detail)[0] : undefined,
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
		<div className={`granola-workspace ${meeting ? "has-selection" : ""}`}>
			<aside
				className="conversation-sidebar"
				aria-label="Granola meetings"
			>
				<header className="sidebar-heading">
					<div>
						<h1>Meetings</h1>
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
					className="granola-month"
					aria-label="Meeting month"
				>
					<Link
						to={monthLink(month, -1)}
						aria-label="Previous month"
					>
						<ChevronLeft size={16} />
					</Link>
					<span>{monthDate.format(new Date(`${month}-01T12:00:00`))}</span>
					<Link
						to={monthLink(month, 1)}
						aria-label="Next month"
					>
						<ChevronRight size={16} />
					</Link>
				</nav>
				<nav
					className="conversation-list"
					aria-label="Meetings"
					aria-busy={navigation.state !== "idle"}
				>
					{meetings.map((item) => (
						<Link
							key={item.id}
							className={`conversation-row ${meeting?.id === item.id ? "is-active" : ""}`}
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
					{meetings.length === 0 && <p className="empty-list">No meetings this month.</p>}
				</nav>
			</aside>
			<main
				className="reading-pane"
				aria-label="Meeting notes"
				aria-busy={navigation.state !== "idle"}
			>
				{meeting ? (
					<div className="meeting-reader">
						<Link
							className="granola-back"
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
					<div className="reader-empty">
						<h2>Meetings, remembered.</h2>
						<p>Choose a meeting to read its notes and transcript.</p>
					</div>
				)}
			</main>
		</div>
	)
}

export function LoadingGranola() {
	return (
		<main
			className="reader-empty"
			role="status"
		>
			<h2>Opening Granola…</h2>
			<p>Getting your meetings.</p>
		</main>
	)
}

export function GranolaError() {
	const error = useRouteError()
	return (
		<main
			className="reader-empty"
			role="alert"
		>
			<h2>Granola couldn’t load.</h2>
			<p>{error instanceof Error ? error.message : "The Granola read failed."}</p>
			<Button onClick={() => window.location.reload()}>Try again</Button>
		</main>
	)
}
