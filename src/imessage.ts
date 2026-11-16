import { z } from "zod"

export type IMessageChat = {
	id: number
	title: string
	identifier: string
	service: string
	isGroup: boolean
	updatedAt: number
	unread: boolean
}

export type IMessageMessage = {
	id: string
	rowId: number
	chatId: number
	senderId: string
	sender: string
	createdAt: number
	text: string
	isFromMe: boolean
	attachments: { id: string; name: string; mimeType: string }[]
	replyToGuid?: string
	destinationCallerId?: string
}

export type IMessagePage<T> = { items: T[]; hasMore: boolean; limit: number }

export type IMessageApi = {
	list(limit: number): Promise<IMessagePage<IMessageChat>>
	chat(id: number): Promise<IMessageChat>
	messages(
		chatId: number,
		limit: number,
		messageId?: string,
	): Promise<IMessagePage<IMessageMessage>>
}

declare global {
	interface Window {
		imessage: IMessageApi
	}
}

export const imessagePageSize = 50
const timestamp = z.iso.datetime({ offset: true }).transform(Date.parse)
const chatSchema = z
	.object({
		contact_name: z.string().optional(),
		id: z.number().int().positive(),
		identifier: z.string(),
		is_group: z.boolean(),
		last_message_at: timestamp,
		name: z.string(),
		service: z.string(),
		unread_count: z.number().int().nonnegative().optional(),
	})
	.transform(
		(chat): IMessageChat => ({
			id: chat.id,
			identifier: chat.identifier,
			isGroup: chat.is_group,
			service: chat.service,
			title: chat.contact_name || chat.name || chat.identifier,
			unread: (chat.unread_count ?? 0) > 0,
			updatedAt: chat.last_message_at,
		}),
	)

const messageSchema = z
	.object({
		attachments: z.array(
			z.object({
				filename: z.string(),
				mime_type: z.string(),
				transfer_name: z.string(),
			}),
		),
		chat_id: z.number().int().positive(),
		created_at: timestamp,
		destination_caller_id: z.string().optional(),
		guid: z.string(),
		id: z.number().int().positive(),
		is_from_me: z.boolean(),
		reply_to_guid: z.string().optional(),
		sender: z.string(),
		sender_name: z.string().optional(),
		text: z.string(),
	})
	.transform(
		(message): IMessageMessage => ({
			attachments: message.attachments.map((attachment, index) => ({
				id: `${message.guid}:${index}`,
				mimeType: attachment.mime_type,
				name: attachment.transfer_name || attachment.filename,
			})),
			chatId: message.chat_id,
			createdAt: message.created_at,
			destinationCallerId: message.destination_caller_id,
			id: message.guid,
			isFromMe: message.is_from_me,
			replyToGuid: message.reply_to_guid,
			rowId: message.id,
			sender: message.is_from_me ? "You" : message.sender_name || message.sender,
			senderId: message.sender,
			text: message.text,
		}),
	)

export function parseIMessageJson(output: string): unknown[] {
	return output
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => JSON.parse(line))
}

export function readIMessageChats(source: unknown): IMessageChat[] {
	return z.array(chatSchema).parse(source)
}

export function readIMessageMessages(source: unknown): IMessageMessage[] {
	return z
		.array(messageSchema)
		.parse(source)
		.sort((a, b) => a.createdAt - b.createdAt || a.rowId - b.rowId)
}
