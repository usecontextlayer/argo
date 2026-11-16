import { z } from "zod"

export type WhatsAppChat = {
	id: string
	title: string
	isGroup: boolean
	updatedAt: number | null
	preview: string
	unread: boolean
}

export type WhatsAppMessage = {
	id: string
	chatId: string
	senderId: string
	sender: string
	createdAt: number
	text: string
	isFromMe: boolean
	mediaType: string | null
	quotedMessageId: string | null
	reactionToMessageId: string | null
}

export type WhatsAppPage<T> = { items: T[]; hasMore: boolean }
export type WhatsAppContext = {
	message: WhatsAppMessage
	before: WhatsAppMessage[]
	after: WhatsAppMessage[]
}

export type WhatsAppApi = {
	list(page: number): Promise<WhatsAppPage<WhatsAppChat>>
	chat(id: string): Promise<WhatsAppChat>
	messages(chatId: string, page: number): Promise<WhatsAppPage<WhatsAppMessage>>
	context(messageId: string): Promise<WhatsAppContext>
}

declare global {
	interface Window {
		whatsapp: WhatsAppApi
	}
}

export const whatsappPageSize = 50
const timestamp = z.coerce.date().transform((value) => value.getTime())
const chatSchema = z
	.object({
		is_group: z.boolean(),
		jid: z.string(),
		last_message: z.string().nullable(),
		last_message_time: timestamp.nullable(),
		name: z.string().nullable(),
		unread: z.boolean(),
	})
	.transform(
		(chat): WhatsAppChat => ({
			id: chat.jid,
			isGroup: chat.is_group,
			preview: chat.last_message ?? "",
			title: chat.name || chat.jid,
			unread: chat.unread,
			updatedAt: chat.last_message_time,
		}),
	)

const messageSchema = z
	.object({
		chat_jid: z.string(),
		content: z.string(),
		id: z.string(),
		is_from_me: z.union([z.boolean(), z.literal(0), z.literal(1)]).transform(Boolean),
		media_type: z
			.string()
			.nullable()
			.transform((value) => value || null),
		quoted_message_id: z.string().nullable(),
		reaction_to_message_id: z.string().nullable(),
		sender_display: z.string().nullable(),
		sender_jid: z.string(),
		timestamp,
	})
	.transform(
		(message): WhatsAppMessage => ({
			chatId: message.chat_jid,
			createdAt: message.timestamp,
			id: message.id,
			isFromMe: message.is_from_me,
			mediaType: message.media_type,
			quotedMessageId: message.quoted_message_id,
			reactionToMessageId: message.reaction_to_message_id,
			sender: message.is_from_me ? "You" : message.sender_display || message.sender_jid,
			senderId: message.sender_jid,
			text: message.content,
		}),
	)

export function readWhatsAppChat(source: unknown): WhatsAppChat {
	return chatSchema.parse(source)
}

export function readWhatsAppChats(source: unknown): WhatsAppPage<WhatsAppChat> {
	const { result } = z.object({ result: z.array(chatSchema) }).parse(source)
	return { hasMore: result.length === whatsappPageSize, items: result }
}

export function readWhatsAppMessages(source: unknown): WhatsAppPage<WhatsAppMessage> {
	const { result } = z.object({ result: z.array(messageSchema) }).parse(source)
	return {
		hasMore: result.length === whatsappPageSize,
		items: result.sort((a, b) => a.createdAt - b.createdAt),
	}
}

export function readWhatsAppContext(source: unknown): WhatsAppContext {
	return z
		.object({
			after: z.array(messageSchema),
			before: z.array(messageSchema),
			message: messageSchema,
		})
		.parse(source)
}
