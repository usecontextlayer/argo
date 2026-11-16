import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { readGmailThread } from "../src/gmail.ts"

// MIME structure recorded from a real Composio GMAIL_LIST_THREADS read on
// 2026-11-16. record-gmail.mjs replaces all correspondence with owned test text.
test("a conversation presents chronological messages with decoded multipart bodies", async () => {
	const source = JSON.parse(
		await readFile(new URL("fixtures/gmail-thread.json", import.meta.url), "utf8"),
	)
	source.messages.reverse()

	assert.deepEqual(readGmailThread(source), {
		date: 1700000060000,
		id: "conversation",
		messages: [
			{
				date: 1700000000000,
				from: "Ada <ada@example.test>",
				html: "<p>Message 1 — café.</p>",
				id: "message-1",
				text: "Message 1 — café.\nSecond line.",
				to: "Reader <reader@example.test>",
			},
			{
				date: 1700000060000,
				from: "Lin <lin@example.test>",
				html: "<p>Message 2 — café.</p>",
				id: "message-2",
				text: "Message 2 — café.\nSecond line.",
				to: "Reader <reader@example.test>",
			},
		],
		participants: "Ada <ada@example.test>, Lin <lin@example.test>",
		snippet: "Message 2 — café.",
		subject: "Café plans",
		unread: true,
	})
})
