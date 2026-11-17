import { z } from "zod"

export type CalendarDate = { date?: string; dateTime?: string; timeZone?: string }

export const calendarResponseSchema = z.enum(["accepted", "tentative", "declined"])
export type CalendarResponse = z.infer<typeof calendarResponseSchema>

export type CalendarEvent = {
	id: string
	native?: { calendarId: string; eventId: string }
	invitation?: { response: CalendarResponse | "needsAction" }
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
	organizer?: { email?: string; displayName?: string; self?: boolean }
	hangoutLink?: string
	calendarNames?: string[]
}

export type CalendarPage = { events: CalendarEvent[]; timeZone: string }

export type CalendarApi = {
	list: (account: string, month: string) => Promise<CalendarPage>
	refresh: () => Promise<void>
	respond: (
		account: string,
		event: CalendarEvent,
		response: CalendarResponse,
	) => Promise<void>
}

export function invitationResponse(
	response = "needsAction",
): CalendarResponse | "needsAction" {
	if (response === "tentativelyAccepted") return "tentative"
	if (response === "none" || response === "notResponded") return "needsAction"
	return response === "needsAction" ? response : calendarResponseSchema.parse(response)
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
