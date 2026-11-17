import { z } from "zod"
import { getAccount } from "@/accounts"
import { memoize } from "@/cache"
import {
	type CalendarEvent,
	type CalendarPage,
	type CalendarResponse,
	calendarResponseSchema,
	invitationResponse,
} from "@/calendar"
import { execute } from "@/composio"
import { listOutlookCalendar } from "@/outlook"

const months = new Map<string, Promise<CalendarPage>>()

async function fetchCalendar(accountId: string, month: string): Promise<CalendarPage> {
	const account = getAccount(accountId)
	if (account.provider === "microsoft")
		return listOutlookCalendar(account.calendar, month, account.email)
	const start = new Date(`${month}-01T00:00:00`)
	const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
	const page = await execute<{
		calendars_queried: { id: string; summary: string }[]
		errors_by_calendar: Record<string, unknown>
		events: {
			event: CalendarEvent & { eventType?: string; status?: string }
			all_calendar_ids: string[] | null
			source_calendar_id: string
		}[]
	}>(account.calendar, "GOOGLECALENDAR_EVENTS_LIST_ALL_CALENDARS", {
		max_results_per_calendar: 2500,
		response_detail: "full",
		single_events: true,
		time_max: end.toISOString(),
		time_min: start.toISOString(),
	})
	if (Object.keys(page.errors_by_calendar).length) {
		throw new Error(
			`Some calendars could not be read: ${JSON.stringify(page.errors_by_calendar)}`,
		)
	}
	const calendarNames = new Map(
		page.calendars_queried.map((calendar) => [calendar.id, calendar.summary]),
	)
	return {
		events: page.events.map(({ event, all_calendar_ids, source_calendar_id }) => {
			const email = account.email.toLowerCase()
			const attendees = event.attendees?.map((person) => ({
				...person,
				self: person.email.toLowerCase() === email,
			}))
			const attendee = attendees?.find((person) => person.self)
			const isOrganizer = event.organizer?.email?.toLowerCase() === email
			const calendarIds = all_calendar_ids ?? [source_calendar_id]
			return {
				...event,
				attendees,
				calendarNames: calendarIds.map((id) => calendarNames.get(id) ?? id),
				id: `${accountId}:${source_calendar_id}:${event.id}`,
				invitation:
					attendee &&
					!isOrganizer &&
					event.status !== "cancelled" &&
					(!event.eventType || event.eventType === "default")
						? { response: invitationResponse(attendee.responseStatus) }
						: undefined,
				native: {
					calendarId:
						calendarIds.find((id) => id.toLowerCase() === email) ?? source_calendar_id,
					eventId: event.id,
				},
			}
		}),
		timeZone: "America/Toronto",
	}
}

export function listCalendar(account: string, month: string): Promise<CalendarPage> {
	return memoize(months, JSON.stringify([account, month]), () =>
		fetchCalendar(account, month),
	)
}

export function refreshCalendar() {
	months.clear()
}

export async function respondCalendar(
	accountId: string,
	event: CalendarEvent,
	response: CalendarResponse,
): Promise<void> {
	const account = getAccount(accountId)
	const native = z
		.object({ calendarId: z.string().min(1), eventId: z.string().min(1) })
		.parse(event.native)
	const value = calendarResponseSchema.parse(response)
	if (!event.invitation)
		throw new Error("This event is not an invitation for this account.")
	if (account.provider === "google") {
		await execute(account.calendar, "GOOGLECALENDAR_PATCH_EVENT", {
			calendar_id: native.calendarId,
			event_id: native.eventId,
			rsvp_response: value,
			send_updates: "all",
		})
	} else {
		await execute(
			account.calendar,
			value === "declined" ? "OUTLOOK_DECLINE_EVENT" : "OUTLOOK_ACCEPT_EVENT",
			{
				event_id: native.eventId,
				send_response: true,
				...(value === "declined"
					? {}
					: { response_type: value === "accepted" ? "accept" : "tentative" }),
			},
		)
	}
	refreshCalendar()
}
