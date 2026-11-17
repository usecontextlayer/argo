import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { decodeGmailThread } from "../src/gmail.ts"

// MIME structure recorded from a real Composio GMAIL_LIST_THREADS read on
// 2026-11-16. record-gmail.mjs replaces all correspondence with owned test text.
test("a conversation presents chronological messages with decoded multipart bodies", async () => {
	const source = JSON.parse(
		await readFile(new URL("fixtures/gmail-thread.json", import.meta.url), "utf8"),
	)
	source.messages.reverse()
	for (const message of source.messages) {
		message.payload.headers = message.payload.headers.filter(
			({ name }) =>
				!["cc", "reply-to", "message-id", "references"].includes(name.toLowerCase()),
		)
		message.payload.headers.push(
			{ name: "Cc", value: '"Team, Planning" <planning@example.test>' },
			{ name: "Reply-To", value: "Replies <replies@example.test>" },
			{ name: "Message-ID", value: `<${message.id}@example.test>` },
			{ name: "References", value: "<previous@example.test>" },
		)
	}

	assert.deepEqual(decodeGmailThread(source), {
		date: 1700000060000,
		id: "conversation",
		messages: [
			{
				cc: [{ address: "planning@example.test", name: "Team, Planning" }],
				date: 1700000000000,
				from: { address: "ada@example.test", name: "Ada" },
				html: "<p>Message 1 — café.</p>",
				id: "message-1",
				internetMessageId: "<message-1@example.test>",
				references: ["<previous@example.test>"],
				replyTo: [{ address: "replies@example.test", name: "Replies" }],
				text: "Message 1 — café.\nSecond line.",
				to: [{ address: "reader@example.test", name: "Reader" }],
			},
			{
				cc: [{ address: "planning@example.test", name: "Team, Planning" }],
				date: 1700000060000,
				from: { address: "lin@example.test", name: "Lin" },
				html: "<p>Message 2 — café.</p>",
				id: "message-2",
				internetMessageId: "<message-2@example.test>",
				references: ["<previous@example.test>"],
				replyTo: [{ address: "replies@example.test", name: "Replies" }],
				text: "Message 2 — café.\nSecond line.",
				to: [{ address: "reader@example.test", name: "Reader" }],
			},
		],
		participants: "Ada <ada@example.test>, Lin <lin@example.test>",
		snippet: "Message 2 — café.",
		subject: "Café plans",
		unread: true,
	})
})
