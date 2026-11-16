// Refresh: node tests/record-imessage.mjs CHAT_NDJSON HISTORY_NDJSON NAMED_CHAT_NDJSON NAMED_HISTORY_NDJSON
// Inputs are authorized `imsg chats --json` and `imsg history --json` captures.
// Keep wire shapes and relationships; replace correspondence and local paths.
// This script reads captures only and never contacts or writes to Messages.
import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"

const names = ["chats", "history", "chats-named", "history-named"]
assert.equal(
	process.argv.length,
	6,
	"Provide chat and history captures before and after Contacts access",
)
const captures = await Promise.all(
	process.argv.slice(2).map(async (file) =>
		(await readFile(file, "utf8"))
			.split("\n")
			.filter((line) => line.trim())
			.map((line) => JSON.parse(line)),
	),
)
const [chats, history, namedChats, namedHistory] = captures
assert.ok(chats.some((chat) => chat.is_group))
assert.ok(history.some((message) => message.is_from_me))
assert.ok(history.some((message) => !message.is_from_me))
assert.ok(history.some((message) => message.attachments.length))
assert.ok(namedChats.some((chat) => chat.contact_name))
assert.ok(namedHistory.some((message) => message.sender_name))

const identities = new Map()
const chatIds = new Map()
const rowIds = new Map()
const dates = [
	...new Set(
		captures
			.flat()
			.flatMap((row) =>
				["last_message_at", "created_at", "date_read"]
					.map((key) => row[key])
					.filter((value) => value != null),
			),
	),
].sort((a, b) => Date.parse(a) - Date.parse(b))
for (const row of [...chats, ...namedChats])
	if (!chatIds.has(row.id)) chatIds.set(row.id, chatIds.size + 1)
for (const rows of [history, namedHistory])
	for (const row of [...rows].sort((a, b) => a.id - b.id))
		if (!rowIds.has(row.id)) rowIds.set(row.id, rowIds.size + 1)

function identity(value) {
	if (!identities.has(value)) identities.set(value, `identity-${identities.size + 1}`)
	return identities.get(value)
}

function normalize(value, key, kind) {
	if (Array.isArray(value)) return value.map((item) => normalize(item, key, kind))
	if (value && typeof value === "object")
		return Object.fromEntries(
			Object.entries(value).map(([name, item]) => [name, normalize(item, name, kind)]),
		)
	if (value == null || typeof value === "boolean" || value === "") return value
	if (key === "chat_id" || (key === "id" && kind.startsWith("chats"))) {
		if (!chatIds.has(value)) chatIds.set(value, chatIds.size + 1)
		return chatIds.get(value)
	}
	if (key === "id" && kind.startsWith("history")) return rowIds.get(value)
	if (["last_message_at", "created_at", "date_read"].includes(key)) {
		assert.ok(Number.isFinite(Date.parse(value)), "Capture timestamp must be valid")
		return new Date(1700000000000 + dates.indexOf(value) * 60000).toISOString()
	}
	if (key === "service") {
		assert.ok(["SMS", "RCS", "iMessage"].includes(value))
		return value
	}
	if (key === "mime_type" || key === "uti") {
		assert.ok(["image/jpeg", "public.jpeg"].includes(value))
		return value
	}
	if (key === "text") return "Plan — café.\nمرحبا 👋"
	if (key === "transfer_name") return "Plan.jpeg"
	if (key === "filename" || key === "original_path")
		return "/tmp/argo-test-attachment/Plan.jpeg"
	if (typeof value === "number") return key === "unread_count" ? Number(value > 0) : 1
	assert.equal(typeof value, "string", "Unexpected capture value")
	return identity(value)
}

for (const [index, capture] of captures.entries()) {
	await writeFile(
		new URL(`fixtures/imessage-${names[index]}.ndjson`, import.meta.url),
		`${capture.map((row) => JSON.stringify(normalize(row, "", names[index]))).join("\n")}\n`,
	)
}
