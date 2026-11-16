import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { z } from "zod"
import {
	readIMessageMessages as decodeMessages,
	type IMessageChat,
	type IMessageMessage,
	type IMessagePage,
	imessagePageSize,
	parseIMessageJson,
	readIMessageChats,
} from "@/imessage"

const executeFile = promisify(execFile)
const positiveInteger = z.number().int().positive()

async function read(args: string[]): Promise<unknown[]> {
	const { stdout } = await executeFile("imsg", [...args, "--json"], {
		maxBuffer: 16 * 1024 * 1024,
	})
	return parseIMessageJson(stdout)
}

export async function listIMessageChats(
	limit: number,
): Promise<IMessagePage<IMessageChat>> {
	positiveInteger.parse(limit)
	const items = readIMessageChats(await read(["chats", "--limit", String(limit)]))
	return { hasMore: items.length === limit, items, limit }
}

export async function readIMessageChat(id: number): Promise<IMessageChat> {
	positiveInteger.parse(id)
	let limit = imessagePageSize
	while (true) {
		const page = await listIMessageChats(limit)
		const chat = page.items.find((item) => item.id === id)
		if (chat) return chat
		if (!page.hasMore) throw new Error(`iMessage conversation ${id} was not found.`)
		limit *= 2
	}
}

export async function readIMessageMessages(
	chatId: number,
	limit: number,
	messageId?: string,
): Promise<IMessagePage<IMessageMessage>> {
	positiveInteger.parse(chatId)
	positiveInteger.parse(limit)
	while (true) {
		const items = decodeMessages(
			await read(["history", "--chat-id", String(chatId), "--limit", String(limit)]),
		)
		const hasMore = items.length === limit
		if (!messageId || items.some((message) => message.id === messageId))
			return { hasMore, items, limit }
		if (!hasMore)
			throw new Error("The referenced iMessage was not found in this conversation.")
		limit *= 2
	}
}
