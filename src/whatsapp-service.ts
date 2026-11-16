import type { McpConnections } from "@/mcp"
import {
	readWhatsAppChat,
	readWhatsAppChats,
	readWhatsAppContext,
	readWhatsAppMessages,
	type WhatsAppApi,
	whatsappPageSize,
} from "@/whatsapp"

export function createWhatsAppService(connections: McpConnections): WhatsAppApi {
	async function read(name: string, args: Record<string, unknown>) {
		const client = await connections.client("whatsapp")
		const result = await client.callTool({ arguments: args, name })
		if (result.isError) throw new Error(JSON.stringify(result.content))
		return result.structuredContent
	}

	return {
		async chat(id) {
			return readWhatsAppChat(await read("get_chat", { chat_jid: id }))
		},
		async context(messageId) {
			return readWhatsAppContext(
				await read("get_message_context", { after: 0, before: 0, message_id: messageId }),
			)
		},
		async list(page) {
			return readWhatsAppChats(
				await read("list_chats", { limit: whatsappPageSize, page }),
			)
		},
		async messages(chatId, page) {
			return readWhatsAppMessages(
				await read("list_messages", {
					chat_jid: chatId,
					include_context: false,
					limit: whatsappPageSize,
					page,
					sort_by: "newest",
				}),
			)
		},
	}
}
