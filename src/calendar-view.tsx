import { ChevronLeft, ChevronRight, X } from "lucide-react"
import {
	Link,
	type LoaderFunctionArgs,
	useLoaderData,
	useNavigation,
	useRevalidator,
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
import { SourceError } from "@/components/source-error"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { accountProvider } from "@/provider-identity"

function currentMonth() {
	return civilDay(new Date()).slice(0, 7)
}

type CalendarViewData = CalendarPage & {
	day: string
	view: "day" | "week"
}

export async function calendarLoader({
	request,
}: LoaderFunctionArgs): Promise<CalendarViewData> {
	const params = new URL(request.url).searchParams
	const month = params.get("date")?.slice(0, 7) ?? params.get("month") ?? currentMonth()
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
		view,
	}
}

export function CalendarView() {
	const { events, timeZone, day, view } = useLoaderData() as CalendarViewData
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
		setParams({ account, date: civilDay(next), view })
	}
	const entries: ScheduleEntry[] = events.map((event) => ({
		allDay: Boolean(event.start.date),
		content: (
			<Link
				className="flex h-full flex-col gap-1 overflow-hidden rounded-md border bg-secondary px-2 py-1.5 text-secondary-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-[current=true]:outline-2 aria-[current=true]:-outline-offset-2 aria-[current=true]:outline-ring"
				aria-current={selected?.id === event.id ? "true" : undefined}
				to={`?${new URLSearchParams({ account, date: day, event: event.id, view })}`}
			>
				<strong className="text-xs leading-snug font-semibold wrap-anywhere">
					{event.summary || "Untitled event"}
				</strong>
				<time className="text-xs leading-snug text-muted-foreground">
					{eventTime(event, timeZone)}
				</time>
				<small className="text-xs leading-snug text-muted-foreground">
					{event.calendarNames?.join(" · ")}
				</small>
			</Link>
		),
		end: event.end.date ?? (event.end.dateTime as string),
		id: event.id,
		start: event.start.date ?? (event.start.dateTime as string),
	}))
	return (
		<div className="flex min-h-0 min-w-0 flex-1">
			<section
				className={cn(
					"min-w-0 flex-1 overflow-auto",
					selected && "@max-4xl/content:hidden",
				)}
				aria-label="Calendar"
				aria-busy={navigation.state !== "idle"}
			>
				<header className="flex flex-wrap items-center justify-between gap-4 border-b p-6">
					<div className="space-y-2">
						<h1 className="text-xl font-semibold tracking-tight">{title}</h1>
						<SourceIdentity
							provider={accountProvider(account, "calendar")}
							account={getAccount(account)}
						/>
						<p className="text-xs text-muted-foreground">
							All calendars · {timeZone.replaceAll("_", " ")}
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Tabs
							value={view}
							onValueChange={(value) => {
								const next = new URLSearchParams(params)
								next.set("view", String(value))
								next.set("date", day)
								next.delete("month")
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
							<ChevronLeft />
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								const today = civilDay(new Date())
								setParams({ account, date: today, view })
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
							<ChevronRight />
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
					className="w-2/5 min-w-sm max-w-2xl overflow-auto border-l @max-4xl/content:w-full @max-4xl/content:min-w-0 @max-4xl/content:max-w-none @max-4xl/content:border-l-0"
					aria-label="Event details"
				>
					<div className="px-6 pt-4">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								const next = new URLSearchParams(params)
								next.delete("event")
								next.delete("month")
								next.set("date", day)
								setParams(next)
							}}
						>
							<X /> Close event
						</Button>
					</div>
					<div className="p-6">
						<EventDetails
							event={selected}
							timeZone={timeZone}
							account={account}
						/>
					</div>
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
			className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 p-12 text-center"
			role="status"
		>
			<h2 className="text-xl font-semibold">Opening your calendar…</h2>
			<p className="text-sm text-muted-foreground">
				Getting events from {account.email}.
			</p>
		</main>
	)
}

export function CalendarError() {
	return (
		<SourceError
			title="Calendar couldn’t load."
			fallback="The calendar request failed."
		/>
	)
}
