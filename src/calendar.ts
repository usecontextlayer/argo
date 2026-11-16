export type CalendarDate = { date?: string; dateTime?: string; timeZone?: string }

export type CalendarEvent = {
	id: string
	summary: string
	start: CalendarDate
	end: CalendarDate
	description?: string
	location?: string
	attendees?: {
		email: string
		displayName?: string
		responseStatus?: string
		self?: boolean
	}[]
	organizer?: { email?: string; displayName?: string }
	hangoutLink?: string
	calendarNames?: string[]
}

export type CalendarPage = { events: CalendarEvent[]; timeZone: string }

export type CalendarApi = {
	list: (account: string, month: string) => Promise<CalendarPage>
	refresh: () => Promise<void>
}

declare global {
	interface Window {
		calendar: CalendarApi
	}
}

export function civilDate(value: string) {
	return new Date(
		Number(value.slice(0, 4)),
		Number(value.slice(5, 7)) - 1,
		Number(value.slice(8, 10)),
	)
}

function dayKey(event: CalendarEvent, timeZone: string) {
	if (event.start.date) return event.start.date
	const parts = new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		month: "2-digit",
		timeZone,
		year: "numeric",
	}).formatToParts(new Date(event.start.dateTime as string))
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
	return `${values.year}-${values.month}-${values.day}`
}

export function eventTime(event: CalendarEvent, timeZone: string) {
	if (event.start.date) return "All day"
	const format = new Intl.DateTimeFormat(undefined, {
		hour: "numeric",
		minute: "2-digit",
		timeZone,
	})
	return `${format.format(new Date(event.start.dateTime as string))} – ${format.format(new Date(event.end.dateTime as string))}`
}

export function eventDate(event: CalendarEvent, timeZone: string) {
	const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "full" })
	if (event.start.date) {
		const start = civilDate(event.start.date)
		const last = civilDate(event.end.date as string)
		last.setDate(last.getDate() - 1)
		return `${dayFormat.format(start)}${start.getTime() === last.getTime() ? "" : ` – ${dayFormat.format(last)}`} · All day`
	}
	const format = new Intl.DateTimeFormat(undefined, {
		dateStyle: "full",
		timeStyle: "short",
		timeZone,
	})
	return `${format.format(new Date(event.start.dateTime as string))} – ${format.format(new Date(event.end.dateTime as string))}`
}

export function monthLink(month: string, offset: number) {
	const next = new Date(
		Number(month.slice(0, 4)),
		Number(month.slice(5, 7)) - 1 + offset,
		1,
	)
	return `?month=${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`
}

export function groupCalendarEvents(
	events: CalendarEvent[],
	timeZone: string,
): [string, CalendarEvent[]][] {
	const groups = new Map<string, CalendarEvent[]>()
	for (const event of events) {
		const key = dayKey(event, timeZone)
		const group = groups.get(key) ?? []
		group.push(event)
		groups.set(key, group)
	}
	return [...groups]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([day, group]) => [
			day,
			group.sort((a, b) => {
				if (a.start.date) return b.start.date ? 0 : -1
				if (b.start.date) return 1
				return (
					Date.parse(a.start.dateTime as string) - Date.parse(b.start.dateTime as string)
				)
			}),
		])
}
