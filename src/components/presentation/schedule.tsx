import type { CSSProperties, ReactNode } from "react"
import { civilDay, scheduleDate, scheduleDays } from "./schedule-dates"
import "./schedule.css"

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
	return (
		<div
			className={`presentation-schedule presentation-schedule-${count === 1 ? "day" : "week"}`}
			style={{ "--schedule-days": count } as CSSProperties}
		>
			<div className="schedule-heading-row">
				<div className="schedule-timezone">
					{timeZone.split("/").at(-1)?.replaceAll("_", " ")}
				</div>
				{days.map((day) => (
					<div
						key={civilDay(day)}
						className="schedule-day-heading"
						data-today={civilDay(day) === today}
					>
						<span>
							{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day)}
						</span>
						<strong>{day.getDate()}</strong>
					</div>
				))}
			</div>
			<div className="schedule-all-day-row">
				<span className="schedule-axis-label">All day</span>
				{days.map((day) => (
					<div
						key={civilDay(day)}
						className="schedule-all-day-cell"
					>
						{entries
							.filter(
								(entry) =>
									entry.allDay &&
									entry.start <= civilDay(day) &&
									entry.end > civilDay(day),
							)
							.map((entry) => (
								<div
									className="schedule-all-day-entry"
									key={entry.id}
								>
									{entry.content}
								</div>
							))}
					</div>
				))}
			</div>
			<div
				className="schedule-time-grid"
				style={{ height: hours.length * 72 }}
			>
				<div className="schedule-hours">
					{hours.map((hour) => (
						<div
							className="schedule-hour"
							key={hour}
						>
							<time>{String(hour).padStart(2, "0")}:00</time>
						</div>
					))}
				</div>
				{days.map((day, index) => (
					<div
						className="schedule-day-column"
						key={civilDay(day)}
					>
						{hours.map((hour) => (
							<div
								className="schedule-hour-line"
								key={hour}
							/>
						))}
						{placed[index]?.map(({ entry, start, end, lane, lanes }) => (
							<div
								key={entry.id}
								className="schedule-timed-entry"
								style={{
									height: Math.max(25, ((end - start) / 60) * 72),
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
