import { getAccount } from "@/accounts"
import type { CalendarEvent, CalendarPage } from "@/calendar"
import { execute, memoize } from "@/composio"
import { listOutlookCalendar } from "@/outlook"

const months = new Map<string, Promise<CalendarPage>>()

async function fetchCalendar(accountId: string, month: string): Promise<CalendarPage> {
	const account = getAccount(accountId)
	if (account.provider === "microsoft")
		return listOutlookCalendar(account.calendar, month)
	const start = new Date(`${month}-01T00:00:00`)
	const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
	const page = await execute<{
		calendars_queried: { id: string; summary: string }[]
		errors_by_calendar: Record<string, unknown>
		events: {
			event: CalendarEvent
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
		events: page.events.map(({ event, all_calendar_ids, source_calendar_id }) => ({
			...event,
			calendarNames: (all_calendar_ids ?? [source_calendar_id]).map(
				(id) => calendarNames.get(id) ?? id,
			),
			id: `${accountId}:${source_calendar_id}:${event.id}`,
		})),
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
