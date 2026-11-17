// Refresh: node tests/record-teams-metadata.mjs /absolute/path/to/capture.json CURRENT_USER_ID
// Input: authorized Composio read results { list, chat, members } from
// CHATS_GET_ALL_CHATS, GET_CHAT, and LIST_USER_CHAT_MEMBERS for the same chat,
// with another named chat on the list.
// Retains observed structure and nullability, replacing private values. Keeps
// the other member only, so fixtures carry no configured user's identity.
// Never contacts Teams.
import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"

const source = JSON.parse(await readFile(process.argv[2], "utf8"))
const selfId = process.argv[3]
assert.ok(selfId, "Provide the configured user's ID to exclude their membership")
assert.equal(source.chat.topic, null)
assert.ok(source.list.value.some((chat) => chat.id === source.chat.id))
assert.equal(source.members.value.length, 2)
assert.ok(source.members.value.some((member) => member.userId === selfId))
source.members.value = source.members.value.filter((member) => member.userId !== selfId)
const otherChat = source.list.value.find(
	(chat) => chat.id !== source.chat.id && chat.topic,
)
assert.ok(otherChat, "Recording needs another named chat")
source.list.value = [
	otherChat,
	source.list.value.find((chat) => chat.id === source.chat.id),
]

const identities = new Map([[source.chat.id, "selected-chat"]])
const dates = [...new Set(source.list.value.map((chat) => chat.lastUpdatedDateTime))]

function normalize(value, key = "") {
	if (Array.isArray(value)) return value.map((item) => normalize(item, key))
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.sort()
				.map(([name, item]) => [name, normalize(item, name)]),
		)
	}
	if (typeof value === "number") return 0
	if (typeof value !== "string" || value === "") return value
	if (key === "chatType") return value
	if (key === "userId") return "other-user"
	if (key === "id") {
		if (!identities.has(value)) identities.set(value, `identity-${identities.size}`)
		return identities.get(value)
	}
	if (key.endsWith("DateTime"))
		return new Date(
			1700000000000 + Math.max(0, dates.indexOf(value)) * 60000,
		).toISOString()
	if (key === "displayName") return "Ada"
	if (key === "email") return "reader@example.test"
	if (key === "topic") return "Team planning"
	return `fixture-${key}`
}

await writeFile(
	new URL("fixtures/teams-metadata.json", import.meta.url),
	`${JSON.stringify(normalize(source), null, "\t")}\n`,
)
