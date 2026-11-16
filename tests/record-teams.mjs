// Refresh: node tests/record-teams.mjs /absolute/path/to/MICROSOFT_TEAMS_LIST_USER_CHAT_MESSAGES_OUTPUT.json
// Input: an authorized read-only Composio response containing an HTML message
// with both a named linked attachment and an unnamed attachment without a URL,
// plus an older HTML message without attachments. All private values are replaced.
import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"

const source = JSON.parse(await readFile(process.argv[2], "utf8"))
const latest = source.data.value.find(
	(message) =>
		message.messageType === "message" &&
		message.body.contentType === "html" &&
		message.attachments.length === 2 &&
		message.attachments.some((attachment) => attachment.name && attachment.contentUrl) &&
		message.attachments.some(
			(attachment) => attachment.name === null && attachment.contentUrl === null,
		),
)
assert.ok(latest, "Recording needs both observed attachment shapes")
const earlier = source.data.value.find(
	(message) =>
		message.messageType === "message" &&
		message.body.contentType === "html" &&
		message.attachments.length === 0 &&
		Date.parse(message.createdDateTime) < Date.parse(latest.createdDateTime),
)
assert.ok(earlier, "Recording needs an older HTML message without attachments")

function normalize(value, key = "") {
	if (Array.isArray(value)) return value.map((item) => normalize(item, key))
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([name, item]) => [name, normalize(item, name)]),
		)
	}
	if (typeof value === "string") return `fixture-${key}`
	if (typeof value === "number") return 0
	return value
}

const messages = [latest, earlier].map((message, index) => {
	assert.ok(message.from.user, "Recording needs messages sent by users")
	const result = normalize(message)
	result.id = index === 0 ? "later-message" : "earlier-message"
	result.createdDateTime =
		index === 0 ? "2023-11-14T22:14:20.000Z" : "2023-11-14T22:13:20.000Z"
	result.messageType = message.messageType
	result.from.user.displayName = index === 0 ? "Ada" : "Lin"
	result.body.contentType = message.body.contentType
	result.body.content = index === 0 ? "<p>Plan — café.</p>" : "<p>Earlier reply.</p>"
	result.attachments = message.attachments.map((attachment, attachmentIndex) => ({
		...normalize(attachment),
		contentUrl: attachment.contentUrl ? "https://example.test/plan.pdf" : null,
		id: `attachment-${attachmentIndex + 1}`,
		name: attachment.name ? "Plan.pdf" : null,
	}))
	return result
})

await writeFile(
	new URL("fixtures/teams-messages.json", import.meta.url),
	`${JSON.stringify(messages, null, "\t")}\n`,
)
