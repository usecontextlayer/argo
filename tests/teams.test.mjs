import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { decodeTeamsMessages } from "../src/teams.ts"

// Provider structure recorded on 2026-11-16. record-teams.mjs replaces private
// content with test-owned values while preserving observed nullable fields.
const source = JSON.parse(
	await readFile(new URL("fixtures/teams-messages.json", import.meta.url), "utf8"),
)

test("Teams messages are presented chronologically despite provider ordering", () => {
	assert.deepEqual(
		decodeTeamsMessages(source).map(({ id, createdAt }) => ({ createdAt, id })),
		[
			{ createdAt: 1700000000000, id: "earlier-message" },
			{ createdAt: 1700000060000, id: "later-message" },
		],
	)
})

test("Teams messages retain sender, HTML content and attachment metadata", () => {
	const messages = decodeTeamsMessages(source)
	assert.deepEqual(
		messages.find((message) => message.id === "later-message"),
		{
			attachments: [
				{ id: "attachment-1", name: "Attachment", url: undefined },
				{
					id: "attachment-2",
					name: "Plan.pdf",
					url: "https://example.test/plan.pdf",
				},
			],
			createdAt: 1700000060000,
			html: "<p>Plan — café.</p>",
			id: "later-message",
			sender: "Ada",
			text: "",
		},
	)
	assert.deepEqual(
		messages.find((message) => message.id === "earlier-message"),
		{
			attachments: [],
			createdAt: 1700000000000,
			html: "<p>Earlier reply.</p>",
			id: "earlier-message",
			sender: "Lin",
			text: "",
		},
	)
})
