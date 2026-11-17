import { z } from "zod"
import type { ChatDraftStore } from "@/chat-drafts"
import { documentToText, documentToWhatsApp } from "@/editor"
import type { McpConnections } from "@/mcp"
import {
	readWhatsAppChat,
	readWhatsAppChats,
	readWhatsAppContext,
	readWhatsAppMessages,
	type WhatsAppApi,
	type WhatsAppDraft,
	whatsappPageSize,
} from "@/whatsapp"

export function createWhatsAppService(
	connections: McpConnections,
	drafts: ChatDraftStore<WhatsAppDraft>,
): WhatsAppApi {
	async function call(name: string, args: Record<string, unknown>) {
		const client = await connections.client("whatsapp")
		const result = await client.callTool({ arguments: args, name })
		if (result.isError) throw new Error(JSON.stringify(result.content))
		return result.structuredContent
	}

	return {
		async chat(id) {
			return readWhatsAppChat(await call("get_chat", { chat_jid: id }))
		},
		async context(messageId) {
			return readWhatsAppContext(
				await call("get_message_context", { after: 0, before: 0, message_id: messageId }),
			)
		},
		discardDraft: (chatId) => drafts.remove(chatId),
		draft: (chatId) => drafts.read(chatId),
		async list(page) {
			return readWhatsAppChats(
				await call("list_chats", { limit: whatsappPageSize, page }),
			)
		},
		async messages(chatId, page) {
			return readWhatsAppMessages(
				await call("list_messages", {
					chat_jid: chatId,
					include_context: false,
					limit: whatsappPageSize,
					page,
					sort_by: "newest",
				}),
			)
		},
		saveDraft: (chatId, draft) => drafts.save(chatId, draft),
		async sendDraft(chatId) {
			const draft = await drafts.read(chatId)
			if (!draft) throw new Error("This conversation has no saved draft.")
			if (!documentToText(draft.body).trim())
				throw new Error("Write a message before sending.")
			const result = z.object({ message: z.string(), success: z.boolean() }).parse(
				await call("send_message", {
					message: documentToWhatsApp(draft.body),
					recipient: chatId,
					...(draft.replyTo
						? {
								quoted_content: draft.replyTo.text,
								quoted_message_id: draft.replyTo.id,
								quoted_sender_jid: draft.replyTo.senderId,
							}
						: {}),
				}),
			)
			if (!result.success) throw new Error(result.message)
			await drafts.remove(chatId)
		},
	}
}
