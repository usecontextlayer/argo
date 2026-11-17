import type { ReactNode } from "react"
import { civilDay, scheduleDate, scheduleDays } from "./schedule-dates"

export type ScheduleEntry = {
	id: string
	start: string
	end: string
	allDay: boolean
	content: ReactNode
}

function minutes(value: string, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-GB", {
		hour: "2-digit",
		hourCycle: "h23",
		minute: "2-digit",
		timeZone,
	}).formatToParts(new Date(value))
	const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
	return Number(fields.hour) * 60 + Number(fields.minute)
}

function timedEntries(entries: ScheduleEntry[], day: string, timeZone: string) {
	const next = new Date(`${day}T12:00:00`)
	next.setDate(next.getDate() + 1)
	const nextDay = civilDay(next)
	return entries
		.filter(
			(entry) =>
				!entry.allDay &&
				scheduleDate(entry.start, timeZone) <= day &&
				(scheduleDate(entry.end, timeZone) > day ||
					(scheduleDate(entry.end, timeZone) === day &&
						minutes(entry.end, timeZone) > 0)),
		)
		.map((entry) => ({
			end:
				scheduleDate(entry.end, timeZone) >= nextDay
					? 1440
					: minutes(entry.end, timeZone),
			entry,
			lane: 0,
			lanes: 1,
			start:
				scheduleDate(entry.start, timeZone) < day ? 0 : minutes(entry.start, timeZone),
		}))
		.sort((a, b) => a.start - b.start || b.end - a.end)
}

function placeEntries(entries: ReturnType<typeof timedEntries>) {
	let cluster: typeof entries = []
	let ends: number[] = []
	function finish() {
		for (const item of cluster) item.lanes = ends.length
		cluster = []
		ends = []
	}
	for (const item of entries) {
		if (cluster.length && ends.every((end) => end <= item.start)) finish()
		let lane = ends.findIndex((end) => end <= item.start)
		if (lane < 0) lane = ends.length
		ends[lane] = item.end
		item.lane = lane
		cluster.push(item)
	}
	finish()
	return entries
}

type ScheduleProps = { date: Date; timeZone: string; entries: ScheduleEntry[] }

function Schedule({ date, timeZone, entries, count }: ScheduleProps & { count: 1 | 7 }) {
	const days = scheduleDays(date, count)
	const placed = days.map((day) =>
		placeEntries(timedEntries(entries, civilDay(day), timeZone)),
	)
	const visible = placed.flat()
	const firstHour = Math.min(7, ...visible.map((item) => Math.floor(item.start / 60)))
	const lastHour = Math.max(19, ...visible.map((item) => Math.ceil(item.end / 60)))
	const hours = Array.from(
		{ length: lastHour - firstHour },
		(_, index) => index + firstHour,
	)
	const today = scheduleDate(new Date().toISOString(), timeZone)
	const columns = { gridTemplateColumns: `4rem repeat(${count}, minmax(0, 1fr))` }
	return (
		<div
			className={count === 1 ? "min-w-0 text-foreground" : "min-w-2xl text-foreground"}
		>
			<div
				className="sticky top-0 z-10 grid border-b bg-background"
				style={columns}
			>
				<div className="self-end overflow-hidden px-1 py-3 text-xs text-muted-foreground">
					{timeZone.split("/").at(-1)?.replaceAll("_", " ")}
				</div>
				{days.map((day) => (
					<div
						key={civilDay(day)}
						className="group flex flex-col items-center gap-1 border-l px-1 py-3"
						data-today={civilDay(day) === today}
					>
						<span className="text-xs text-muted-foreground">
							{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day)}
						</span>
						<strong className="flex size-8 items-center justify-center rounded-full text-xl font-semibold group-data-[today=true]:bg-primary group-data-[today=true]:text-primary-foreground">
							{day.getDate()}
						</strong>
					</div>
				))}
			</div>
			<div
				className="grid min-h-12 border-b"
				style={columns}
			>
				<span className="px-1 py-3 text-xs text-muted-foreground">All day</span>
				{days.map((day) => (
					<div
						key={civilDay(day)}
						className="min-w-0 space-y-1 border-l p-1"
					>
						{entries
							.filter(
								(entry) =>
									entry.allDay &&
									entry.start <= civilDay(day) &&
									entry.end > civilDay(day),
							)
							.map((entry) => (
								<div key={entry.id}>{entry.content}</div>
							))}
					</div>
				))}
			</div>
			<div
				className="relative grid"
				style={{ ...columns, height: hours.length * 72 }}
			>
				<div className="h-full">
					{hours.map((hour) => (
						<div
							className="relative h-18"
							key={hour}
						>
							<time className="block pt-1 pr-2 text-right text-xs text-muted-foreground tabular-nums">
								{String(hour).padStart(2, "0")}:00
							</time>
						</div>
					))}
				</div>
				{days.map((day, index) => (
					<div
						className="relative min-w-0 border-l"
						key={civilDay(day)}
					>
						{hours.map((hour) => (
							<div
								className="h-18 border-t"
								key={hour}
							/>
						))}
						{placed[index]?.map(({ entry, start, end, lane, lanes }) => (
							<div
								key={entry.id}
								className="absolute min-w-0 px-0.5 py-px"
								style={{
									height: Math.max(24, ((end - start) / 60) * 72),
									left: `${(lane / lanes) * 100}%`,
									top: (start / 60 - firstHour) * 72,
									width: `${100 / lanes}%`,
								}}
							>
								{entry.content}
							</div>
						))}
					</div>
				))}
			</div>
		</div>
	)
}

export function DayView(props: ScheduleProps) {
	return (
		<Schedule
			{...props}
			count={1}
		/>
	)
}
export function WeekView(props: ScheduleProps) {
	return (
		<Schedule
			{...props}
			count={7}
		/>
	)
}
