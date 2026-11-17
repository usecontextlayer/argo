import { type CalendarEvent, type CalendarPage, invitationResponse } from "@/calendar"
import { execute } from "@/composio"
import {
	formatMailAddress,
	type MailAddress,
	type MailPage,
	type MailThread,
} from "@/mail"

type Address = MailAddress
type Recipient = { emailAddress: Address }
type OutlookMessage = {
	id: string
	conversationId: string
	subject: string
	from: Recipient
	toRecipients: Recipient[]
	ccRecipients?: Recipient[]
	replyTo?: Recipient[]
	internetMessageId?: string
	internetMessageHeaders?: { name: string; value: string }[]
	isDraft?: boolean
	receivedDateTime: string
	bodyPreview: string
	body: { contentType: string; content: string }
	isRead: boolean
}
type Page<T> = { value: T[]; next_page_token?: string | null }
type OutlookEvent = {
	id: string
	subject: string
	start: { dateTime: string; timeZone: string }
	end: { dateTime: string; timeZone: string }
	isAllDay: boolean
	isCancelled: boolean
	isOrganizer?: boolean
	responseStatus?: { response: string }
	body?: { contentType: string; content: string }
	location?: { displayName: string }
	organizer?: Recipient
	attendees?: (Recipient & { status: { response: string } })[]
	onlineMeeting?: { joinUrl: string } | null
}

function readOutlookConversation(messages: OutlookMessage[]): MailThread {
	const ordered = messages
		.filter((message) => !message.isDraft)
		.sort((a, b) => Date.parse(a.receivedDateTime) - Date.parse(b.receivedDateTime))
	const first = ordered[0]
	const last = ordered.at(-1)
	if (!first || !last) throw new Error("Outlook conversation has no messages")
	return {
		date: Date.parse(last.receivedDateTime),
		id: first.conversationId,
		messages: ordered.map((message) => ({
			cc: (message.ccRecipients ?? []).map((recipient) => recipient.emailAddress),
			date: Date.parse(message.receivedDateTime),
			from: message.from.emailAddress,
			html: message.body.contentType.toLowerCase() === "html" ? message.body.content : "",
			id: message.id,
			internetMessageId: message.internetMessageId ?? "",
			references:
				message.internetMessageHeaders
					?.find((header) => header.name.toLowerCase() === "references")
					?.value.match(/<[^>]+>/g) ?? [],
			replyTo: (message.replyTo ?? []).map((recipient) => recipient.emailAddress),
			text: message.body.contentType.toLowerCase() === "text" ? message.body.content : "",
			to: message.toRecipients.map((recipient) => recipient.emailAddress),
		})),
		participants: [
			...new Set(ordered.map((message) => formatMailAddress(message.from.emailAddress))),
		].join(", "),
		snippet: last.bodyPreview,
		subject: first.subject,
		unread: ordered.some((message) => !message.isRead),
	}
}

export async function listOutlookMail(
	account: string,
	pageToken?: string,
): Promise<MailPage> {
	const result = await execute<Page<OutlookMessage>>(account, "OUTLOOK_LIST_MESSAGES", {
		folder: "allfolders",
		response_detail: "full",
		top: 20,
		...(pageToken ? { page_token: pageToken } : {}),
	})
	const conversations = new Map<string, OutlookMessage[]>()
	for (const message of result.value.filter((message) => !message.isDraft)) {
		const messages = conversations.get(message.conversationId) ?? []
		messages.push(message)
		conversations.set(message.conversationId, messages)
	}
	return {
		nextPageToken: result.next_page_token ?? undefined,
		threads: [...conversations.values()]
			.map(readOutlookConversation)
			.sort((a, b) => b.date - a.date),
	}
}

export async function readOutlookThread(
	account: string,
	id: string,
): Promise<MailThread> {
	const messages: OutlookMessage[] = []
	let pageToken: string | undefined
	do {
		const page = await execute<Page<OutlookMessage>>(account, "OUTLOOK_LIST_MESSAGES", {
			filter: `conversationId eq '${id.replaceAll("'", "''")}'`,
			folder: "allfolders",
			orderby: [],
			response_detail: "full",
			top: 1000,
			...(pageToken ? { page_token: pageToken } : {}),
		})
		messages.push(...page.value)
		pageToken = page.next_page_token ?? undefined
	} while (pageToken)
	return readOutlookConversation(messages)
}

function readOutlookEvent(
	event: OutlookEvent,
	calendar: { id: string; name: string },
	accountEmail: string,
): CalendarEvent {
	const email = accountEmail.toLowerCase()
	const attendee = event.attendees?.find(
		(person) => person.emailAddress.address.toLowerCase() === email,
	)
	const isOrganizer =
		event.isOrganizer || event.organizer?.emailAddress.address.toLowerCase() === email
	return {
		attendees: event.attendees?.map((attendee) => ({
			displayName: attendee.emailAddress.name,
			email: attendee.emailAddress.address,
			responseStatus:
				attendee.status.response === "tentativelyAccepted"
					? "tentative"
					: attendee.status.response,
			self: attendee.emailAddress.address.toLowerCase() === email,
		})),
		calendarNames: [calendar.name],
		description: event.body?.content,
		end: event.isAllDay
			? { date: event.end.dateTime.slice(0, 10) }
			: { dateTime: `${event.end.dateTime}Z` },
		hangoutLink: event.onlineMeeting?.joinUrl,
		id: `${calendar.id}:${event.id}`,
		invitation:
			attendee && !isOrganizer
				? {
						response: invitationResponse(
							event.responseStatus?.response ?? attendee.status.response,
						),
					}
				: undefined,
		location: event.location?.displayName,
		native: { calendarId: calendar.id, eventId: event.id },
		organizer: event.organizer
			? {
					displayName: event.organizer.emailAddress.name,
					email: event.organizer.emailAddress.address,
				}
			: undefined,
		start: event.isAllDay
			? { date: event.start.dateTime.slice(0, 10) }
			: { dateTime: `${event.start.dateTime}Z` },
		summary: event.subject,
	}
}

export async function listOutlookCalendar(
	account: string,
	month: string,
	accountEmail: string,
): Promise<CalendarPage> {
	const start = new Date(`${month}-01T00:00:00`)
	const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
	const calendars: { id: string; name: string }[] = []
	let pageToken: string | undefined
	do {
		const page = await execute<Page<{ id: string; name: string }>>(
			account,
			"OUTLOOK_LIST_CALENDARS",
			{ top: 100, ...(pageToken ? { page_token: pageToken } : {}) },
		)
		calendars.push(...page.value)
		pageToken = page.next_page_token ?? undefined
	} while (pageToken)
	const results = await Promise.all(
		calendars.map(async (calendar) => {
			const events: CalendarEvent[] = []
			let eventPageToken: string | undefined
			do {
				const page = await execute<Page<OutlookEvent>>(
					account,
					"OUTLOOK_GET_CALENDAR_VIEW",
					{
						calendar_id: calendar.id,
						end_datetime: end.toISOString(),
						select: [
							"id",
							"subject",
							"start",
							"end",
							"body",
							"location",
							"organizer",
							"attendees",
							"isAllDay",
							"isCancelled",
							"isOrganizer",
							"responseStatus",
							"onlineMeeting",
						],
						start_datetime: start.toISOString(),
						timezone: "UTC",
						top: 1000,
						...(eventPageToken ? { page_token: eventPageToken } : {}),
					},
				)
				events.push(
					...page.value
						.filter((event) => !event.isCancelled)
						.map((event) => readOutlookEvent(event, calendar, accountEmail)),
				)
				eventPageToken = page.next_page_token ?? undefined
			} while (eventPageToken)
			return events
		}),
	)
	return { events: results.flat(), timeZone: "America/Toronto" }
}
