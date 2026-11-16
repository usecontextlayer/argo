import type { LoaderFunctionArgs } from "react-router"
import type { CalendarPage } from "@/calendar"
import { type SourceReference, sourceReferenceSchema } from "@/doables"
import {
	type GranolaMeeting,
	type GranolaTranscript,
	readGranolaMeetings,
} from "@/granola"
import type { IMessageMessage } from "@/imessage"
import type { MailThread } from "@/mail"
import type { TeamsMessagePage } from "@/teams"
import type { WhatsAppMessage } from "@/whatsapp"
import type { WorkflowyPage } from "@/workflowy"

export type SourceContent =
	| {
			source: "imessage"
			service: string
			title: string
			chatId: number
			messages: IMessageMessage[]
			messageId?: string
	  }
	| { source: "mail"; account: string; thread: MailThread }
	| { source: "calendar"; account: string; page: CalendarPage; eventId: string }
	| { source: "granola"; meeting: GranolaMeeting; transcript?: GranolaTranscript }
	| { source: "workflowy"; page: WorkflowyPage; nodeId: string }
	| { source: "teams"; page: TeamsMessagePage; title: string }
	| {
			source: "whatsapp"
			messages: WhatsAppMessage[]
			messageId?: string
			title: string
			chatId: string
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
				chatId: chat.id,
				messageId: reference.messageId,
				messages: page.items,
				service: chat.service,
				source: "imessage",
				title: chat.title,
			}
		}
		case "mail":
			return {
				account: reference.account,
				source: "mail",
				thread: await window.mail.thread(reference.account, reference.threadId),
			}
		case "calendar":
			return {
				account: reference.account,
				eventId: reference.eventId,
				page: await window.calendar.list(reference.account, reference.month),
				source: "calendar",
			}
		case "granola": {
			const [meeting] = readGranolaMeetings(
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
		case "teams":
			return {
				page: await window.teams.messages(reference.chatId),
				source: "teams",
				title: reference.label,
			}
		case "whatsapp": {
			const chat = await window.whatsapp.chat(reference.chatId)
			if (reference.messageId) {
				const context = await window.whatsapp.context(reference.messageId)
				return {
					chatId: chat.id,
					messageId: reference.messageId,
					messages: [...context.before, context.message, ...context.after],
					source: "whatsapp",
					title: chat.title,
				}
			}
			return {
				chatId: chat.id,
				messages: (await window.whatsapp.messages(reference.chatId, 0)).items,
				source: "whatsapp",
				title: chat.title,
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
