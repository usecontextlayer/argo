import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import {
	decodeIMessageChats,
	decodeIMessageMessages,
	parseIMessageJson,
} from "../src/imessage.ts"

// imsg 0.21.1 output recorded on 2026-11-16. record-imessage.mjs preserves
// observed wire fields and identity relationships, replacing all private values.
const fixture = (name) =>
	readFile(new URL(`fixtures/imessage-${name}.ndjson`, import.meta.url), "utf8")

test("iMessage chat NDJSON preserves conversation identity, titles, services and unread state", async () => {
	const chats = decodeIMessageChats(parseIMessageJson(await fixture("chats")))
	assert.equal(chats.length, 50)
	assert.deepEqual(chats[2], {
		id: 3,
		identifier: "identity-10",
		isGroup: false,
		service: "SMS",
		title: "identity-10",
		unread: true,
		updatedAt: 1700011760000,
	})
	assert.deepEqual(chats[33], {
		id: 34,
		identifier: "identity-88",
		isGroup: true,
		service: "RCS",
		title: "identity-90",
		unread: true,
		updatedAt: 1700009660000,
	})
	assert.equal(chats[12].service, "iMessage")
	assert.equal(chats[12].unread, false)
})

test("iMessage history reads chronologically from newest-first CLI NDJSON", async () => {
	const messages = decodeIMessageMessages(parseIMessageJson(await fixture("history")))
	assert.equal(messages.length, 100)
	assert.equal(messages[0].id, "identity-223")
	assert.equal(messages[0].createdAt, 1700000000000)
	assert.equal(messages.at(-1).id, "identity-124")
	assert.equal(messages.at(-1).createdAt, 1700011760000)
	for (let index = 1; index < messages.length; index++) {
		assert.ok(
			messages[index - 1].createdAt <= messages[index].createdAt,
			"Messages must read oldest first",
		)
	}
})

test("iMessage messages preserve direction, sender, UTF-8 text and attachment metadata", async () => {
	const messages = decodeIMessageMessages(parseIMessageJson(await fixture("history")))
	assert.deepEqual(
		messages.find(({ id }) => id === "identity-209"),
		{
			attachments: [{ id: "identity-209:0", mimeType: "image/jpeg", name: "Plan.jpeg" }],
			chatId: 3,
			createdAt: 1700001080000,
			destinationCallerId: "identity-5",
			id: "identity-209",
			isFromMe: false,
			replyToGuid: undefined,
			rowId: 15,
			sender: "identity-10",
			senderId: "identity-10",
			text: "Plan — café.\nمرحبا 👋",
		},
	)
	const outgoing = messages.find(({ id }) => id === "identity-223")
	assert.equal(outgoing.isFromMe, true)
	assert.equal(outgoing.sender, "You")
	assert.equal(outgoing.senderId, "identity-5")
	assert.equal(outgoing.chatId, 3)
})

test("iMessage uses resolved contact names for conversations and incoming senders", async () => {
	const chats = decodeIMessageChats(parseIMessageJson(await fixture("chats-named")))
	const messages = decodeIMessageMessages(
		parseIMessageJson(await fixture("history-named")),
	)
	assert.equal(chats.find(({ id }) => id === 2).title, "identity-224")
	assert.equal(chats.find(({ id }) => id === 2).identifier, "identity-6")
	assert.deepEqual(
		messages.map(({ sender, senderId, isFromMe }) => ({ isFromMe, sender, senderId })),
		[
			{ isFromMe: true, sender: "You", senderId: "identity-5" },
			{ isFromMe: false, sender: "identity-224", senderId: "identity-6" },
			{ isFromMe: true, sender: "You", senderId: "identity-5" },
			{ isFromMe: false, sender: "identity-224", senderId: "identity-6" },
		],
	)
})
