import { ChevronLeft, ChevronRight, X } from "lucide-react"
import {
	Link,
	type LoaderFunctionArgs,
	useLoaderData,
	useNavigation,
	useRevalidator,
	useRouteError,
	useSearchParams,
} from "react-router"
import { getAccount } from "@/accounts"
import { type CalendarPage, civilDate, eventTime } from "@/calendar"
import { EventDetails } from "@/components/presentation/event-details"
import { SourceIdentity } from "@/components/presentation/primitives"
import { DayView, type ScheduleEntry, WeekView } from "@/components/presentation/schedule"
import {
	civilDay,
	scheduleDate,
	scheduleDays,
} from "@/components/presentation/schedule-dates"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { accountProvider } from "@/provider-identity"

export function currentMonth() {
	return civilDay(new Date()).slice(0, 7)
}

type CalendarViewData = CalendarPage & {
	month: string
	day: string
	view: "day" | "week"
}

export async function calendarLoader({
	request,
}: LoaderFunctionArgs): Promise<CalendarViewData> {
	const params = new URL(request.url).searchParams
	const month = params.get("month") ?? params.get("date")?.slice(0, 7) ?? currentMonth()
	const account = params.get("account") ?? "feerasta"
	const page = await window.calendar.list(account, month)
	const selected = page.events.find((event) => event.id === params.get("event"))
	const day =
		params.get("date") ??
		(selected
			? scheduleDate(
					selected.start.date ?? (selected.start.dateTime as string),
					page.timeZone,
				)
			: month === currentMonth()
				? civilDay(new Date())
				: `${month}-01`)
	const view = params.get("view") === "day" ? "day" : "week"
	const visibleMonths = new Set(
		scheduleDays(civilDate(day), view === "day" ? 1 : 7).map((date) =>
			civilDay(date).slice(0, 7),
		),
	)
	visibleMonths.delete(month)
	const otherPages = await Promise.all(
		[...visibleMonths].map((value) => window.calendar.list(account, value)),
	)
	return {
		...page,
		day,
		events: [
			...new Map(
				[page, ...otherPages]
					.flatMap((value) => value.events)
					.map((event) => [event.id, event]),
			).values(),
		],
		month,
		view,
	}
}

export function CalendarView() {
	const { events, timeZone, month, day, view } = useLoaderData() as CalendarViewData
	const [params, setParams] = useSearchParams()
	const account = params.get("account") ?? "feerasta"
	const navigation = useNavigation()
	const revalidator = useRevalidator()
	const selected = events.find((event) => event.id === params.get("event"))
	const date = civilDate(day)
	const days = scheduleDays(date, view === "day" ? 1 : 7)
	const dateFormat = new Intl.DateTimeFormat(undefined, {
		day: "numeric",
		month: "long",
		year: "numeric",
	})
	const title =
		view === "day"
			? dateFormat.format(date)
			: `${dateFormat.format(days[0])} – ${dateFormat.format(days[6])}`
	function navigateDate(offset: number) {
		const next = new Date(date)
		next.setDate(next.getDate() + offset)
		setParams({ account, date: civilDay(next), month: civilDay(next).slice(0, 7), view })
	}
	const entries: ScheduleEntry[] = events.map((event) => ({
		allDay: Boolean(event.start.date),
		content: (
			<Link
				className="schedule-event-link"
				aria-current={selected?.id === event.id ? "true" : undefined}
				to={`?${new URLSearchParams({ account, date: day, event: event.id, month, view })}`}
			>
				<strong>{event.summary || "Untitled event"}</strong>
				<time>{eventTime(event, timeZone)}</time>
				<small>{event.calendarNames?.join(" · ")}</small>
			</Link>
		),
		end: event.end.date ?? (event.end.dateTime as string),
		id: event.id,
		start: event.start.date ?? (event.start.dateTime as string),
	}))
	return (
		<div className="calendar-presentation-workspace">
			<section
				className="calendar-presentation-main"
				aria-label="Calendar"
				aria-busy={navigation.state !== "idle"}
			>
				<header className="calendar-presentation-heading">
					<div>
						<h1>{title}</h1>
						<SourceIdentity
							provider={accountProvider(account, "calendar")}
							account={account}
						/>
						<p>All calendars · {timeZone.replaceAll("_", " ")}</p>
					</div>
					<div className="calendar-presentation-controls">
						<Tabs
							value={view}
							onValueChange={(value) => {
								const next = new URLSearchParams(params)
								next.set("view", String(value))
								next.set("date", day)
								setParams(next)
							}}
						>
							<TabsList aria-label="Calendar view">
								<TabsTrigger value="day">Day</TabsTrigger>
								<TabsTrigger value="week">Week</TabsTrigger>
							</TabsList>
						</Tabs>
						<Button
							variant="ghost"
							size="icon"
							aria-label={view === "day" ? "Previous day" : "Previous week"}
							onClick={() => navigateDate(view === "day" ? -1 : -7)}
						>
							<ChevronLeft size={17} />
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								const today = civilDay(new Date())
								setParams({ account, date: today, month: today.slice(0, 7), view })
							}}
						>
							Today
						</Button>
						<Button
							variant="ghost"
							size="icon"
							aria-label={view === "day" ? "Next day" : "Next week"}
							onClick={() => navigateDate(view === "day" ? 1 : 7)}
						>
							<ChevronRight size={17} />
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={revalidator.state !== "idle"}
							onClick={async () => {
								await window.calendar.refresh()
								revalidator.revalidate()
							}}
						>
							{revalidator.state !== "idle" ? "Refreshing…" : "Refresh"}
						</Button>
					</div>
				</header>
				{view === "day" ? (
					<DayView
						date={date}
						timeZone={timeZone}
						entries={entries}
					/>
				) : (
					<WeekView
						date={date}
						timeZone={timeZone}
						entries={entries}
					/>
				)}
			</section>
			{selected && (
				<main
					className="calendar-presentation-detail"
					aria-label="Event details"
				>
					<div className="calendar-presentation-close">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								const next = new URLSearchParams(params)
								next.delete("event")
								setParams(next)
							}}
						>
							<X size={16} /> Close event
						</Button>
					</div>
					<EventDetails
						event={selected}
						timeZone={timeZone}
						account={account}
					/>
				</main>
			)}
		</div>
	)
}

export function LoadingCalendar() {
	const [params] = useSearchParams()
	const account = getAccount(params.get("account") ?? "feerasta")
	return (
		<main
			className="reader-empty"
			role="status"
		>
			<h2>Opening your calendar…</h2>
			<p>Getting events from {account.email}.</p>
		</main>
	)
}

export function CalendarError() {
	const error = useRouteError()
	return (
		<main
			className="reader-empty"
			role="alert"
		>
			<h2>Calendar couldn’t load.</h2>
			<p>{error instanceof Error ? error.message : "The calendar request failed."}</p>
			<Button onClick={() => window.location.reload()}>Try again</Button>
		</main>
	)
}
