import { z } from "zod"
import type { EditorDocument } from "./editor.ts"

export type TeamsDraft = {
	body: EditorDocument
	replyTo?: { id: string; sender: string; text: string }
}

export type TeamsChat = {
	id: string
	title: string
	type: string
	updatedAt: number
}

export type TeamsMessage = {
	id: string
	sender: string
	createdAt: number
	html: string
	text: string
	attachments: { id: string; name: string; url?: string }[]
	mine?: boolean
	quote?: { messageId: string; sender?: string; text: string }
}

export type TeamsChatPage = { chats: TeamsChat[]; nextPageToken?: string }
export type TeamsMessagePage = { messages: TeamsMessage[]; nextPageToken?: string }

export type TeamsApi = {
	draft(chatId: string): Promise<TeamsDraft | null>
	saveDraft(chatId: string, draft: TeamsDraft): Promise<TeamsDraft>
	sendDraft(chatId: string): Promise<void>
	discardDraft(chatId: string): Promise<void>
	chat: (id: string) => Promise<TeamsChat>
	list: (pageToken?: string) => Promise<TeamsChatPage>
	messages: (chatId: string, pageToken?: string) => Promise<TeamsMessagePage>
	refresh: () => Promise<void>
}

declare global {
	interface Window {
		teams: TeamsApi
	}
}

export type TeamsSourceMessage = {
	id: string
	createdDateTime: string
	messageType: string
	from: {
		user?: { id?: string; displayName: string }
		application?: { displayName: string }
	} | null
	body: { contentType: string; content: string }
	attachments: {
		id: string
		name: string | null
		contentUrl: string | null
		contentType?: string
		content?: string | null
	}[]
}

const quoteSchema = z.object({
	messageId: z.string(),
	messagePreview: z.string(),
	messageSender: z
		.object({ user: z.object({ displayName: z.string().optional() }).nullish() })
		.optional(),
})

export function readTeamsMessages(
	messages: TeamsSourceMessage[],
	currentUserId?: string,
): TeamsMessage[] {
	return messages
		.filter((message) => message.messageType === "message")
		.map((message) => {
			const reference = message.attachments.find(
				(attachment) => attachment.contentType === "messageReference",
			)
			const quote = reference?.content
				? quoteSchema.parse(JSON.parse(reference.content))
				: undefined
			return {
				attachments: message.attachments
					.filter((attachment) => attachment.contentType !== "messageReference")
					.map((attachment) => ({
						id: attachment.id,
						name: attachment.name ?? "Attachment",
						url: attachment.contentUrl ?? undefined,
					})),
				createdAt: Date.parse(message.createdDateTime),
				html: message.body.contentType === "html" ? message.body.content : "",
				id: message.id,
				sender:
					currentUserId && message.from?.user?.id === currentUserId
						? "You"
						: (message.from?.user?.displayName ??
							message.from?.application?.displayName ??
							"Unknown sender"),
				text: message.body.contentType === "text" ? message.body.content : "",
				...(currentUserId ? { mine: message.from?.user?.id === currentUserId } : {}),
				...(quote
					? {
							quote: {
								messageId: quote.messageId,
								sender: quote.messageSender?.user?.displayName,
								text: quote.messagePreview,
							},
						}
					: {}),
			}
		})
		.sort((a, b) => a.createdAt - b.createdAt)
}
