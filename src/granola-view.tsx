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
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

const date = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
})
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
						<p>Granola</p>
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
							<div className="conversation-meta">
								<time dateTime={item.date}>{date.format(new Date(item.date))}</time>
							</div>
							<div className="conversation-subject">{item.title}</div>
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
					<article className="thread granola-meeting">
						<header className="thread-header">
							<Link
								className="granola-back"
								to={`?month=${month}`}
							>
								Back to meetings
							</Link>
							<h2>{meeting.title}</h2>
							<p>
								<time dateTime={meeting.date}>{date.format(new Date(meeting.date))}</time>
							</p>
							<p>{meeting.participants}</p>
						</header>
						<Tabs
							value={view}
							onValueChange={(value) => {
								const next = new URLSearchParams(params)
								next.set("view", String(value))
								setParams(next)
							}}
						>
							<TabsList
								variant="line"
								aria-label="Meeting content"
							>
								<TabsTrigger value="summary">Summary</TabsTrigger>
								<TabsTrigger value="notes">My notes</TabsTrigger>
								{meeting.transcriptAvailable && (
									<TabsTrigger value="transcript">Transcript</TabsTrigger>
								)}
							</TabsList>
							<TabsContent
								value={view}
								className="granola-content"
							>
								{view === "transcript"
									? transcript?.transcript || "No transcript available."
									: view === "notes"
										? meeting.notes || "No private notes."
										: meeting.summary || "No summary available."}
							</TabsContent>
						</Tabs>
						{transcript?.truncated && view === "transcript" && (
							<p className="granola-limit">Granola returned part of this transcript.</p>
						)}
					</article>
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
