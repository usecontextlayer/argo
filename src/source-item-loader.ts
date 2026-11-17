import type { LoaderFunctionArgs } from "react-router"
import type { CalendarEvent } from "@/calendar"
import {
	decodeGranolaMeetings,
	type GranolaMeeting,
	type GranolaTranscript,
} from "@/granola"
import type { IMessageChat, IMessageMessage } from "@/imessage"
import type { MailThread } from "@/mail"
import { type SourceReference, sourceReferenceSchema } from "@/source-reference"
import type { TeamsChat, TeamsMessage } from "@/teams"
import type { WhatsAppChat, WhatsAppMessage } from "@/whatsapp"
import type { WorkflowyPage } from "@/workflowy"

export type SourceContent =
	| {
			source: "imessage"
			chat: IMessageChat
			messages: IMessageMessage[]
			messageId?: string
	  }
	| { source: "mail"; account: string; thread: MailThread }
	| { source: "calendar"; account: string; event: CalendarEvent; timeZone: string }
	| { source: "granola"; meeting: GranolaMeeting; transcript?: GranolaTranscript }
	| { source: "workflowy"; page: WorkflowyPage; nodeId: string }
	| { source: "teams"; messages: TeamsMessage[]; chat: TeamsChat }
	| {
			source: "whatsapp"
			messages: WhatsAppMessage[]
			messageId?: string
			chat: WhatsAppChat
	  }

export type SourceItemResult = { content: SourceContent } | { error: string }

export async function loadSourceItem(
	reference: SourceReference,
	transcript = false,
): Promise<SourceContent> {
	switch (reference.source) {
		case "imessage": {
			const [chat, page] = await Promise.all([
				window.imessage.chat(reference.chatId),
				window.imessage.messages(reference.chatId, 50, reference.messageId),
			])
			return {
				chat,
				messageId: reference.messageId,
				messages: page.items,
				source: "imessage",
			}
		}
		case "mail":
			return {
				account: reference.account,
				source: "mail",
				thread: await window.mail.thread(reference.account, reference.threadId),
			}
		case "calendar": {
			const page = await window.calendar.list(reference.account, reference.month)
			const event = page.events.find((item) => item.id === reference.eventId)
			if (!event) throw new Error("The referenced event is no longer in this month.")
			return {
				account: reference.account,
				event,
				source: "calendar",
				timeZone: page.timeZone,
			}
		}
		case "granola": {
			const [meeting] = decodeGranolaMeetings(
				await window.granola.meeting(reference.meetingId),
			)
			if (!meeting) throw new Error("The referenced meeting could not be found.")
			return {
				meeting,
				source: "granola",
				...(transcript
					? { transcript: await window.granola.transcript(reference.meetingId) }
					: {}),
			}
		}
		case "workflowy":
			return {
				nodeId: reference.nodeId,
				page: await window.workflowy.read(reference.nodeId, 50),
				source: "workflowy",
			}
		case "teams": {
			const [chat, page] = await Promise.all([
				window.teams.chat(reference.chatId),
				window.teams.messages(reference.chatId),
			])
			return {
				chat,
				messages: page.messages,
				source: "teams",
			}
		}
		case "whatsapp": {
			const chat = await window.whatsapp.chat(reference.chatId)
			if (reference.messageId) {
				const context = await window.whatsapp.context(reference.messageId)
				return {
					chat,
					messageId: reference.messageId,
					messages: [...context.before, context.message, ...context.after],
					source: "whatsapp",
				}
			}
			return {
				chat,
				messages: (await window.whatsapp.messages(reference.chatId, 0)).items,
				source: "whatsapp",
			}
		}
	}
}

export function sourceItemHref(reference: SourceReference, transcript = false) {
	return `/source-item?${new URLSearchParams({ reference: JSON.stringify(reference), ...(transcript ? { transcript: "1" } : {}) })}`
}

export async function sourceItemLoader({
	request,
}: LoaderFunctionArgs): Promise<SourceItemResult> {
	const params = new URL(request.url).searchParams
	const reference = sourceReferenceSchema.parse(
		JSON.parse(params.get("reference") ?? "null"),
	)
	try {
		return { content: await loadSourceItem(reference, params.get("transcript") === "1") }
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error) }
	}
}
