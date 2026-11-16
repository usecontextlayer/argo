// Refresh: node tests/record-whatsapp.mjs CHAT_CAPTURE MESSAGE_CAPTURE OLDER_CAPTURE SHORT_CAPTURE
// Inputs are authorized VGP list_chats/list_messages MCP CallToolResult or structuredContent captures.
// The recorder writes only structuredContent, preserves observed shapes, nulls,
// empty strings and identity relationships, and replaces every private value.
// These reads use the existing account; this script never contacts the service.
import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"

const names = ["chats", "messages", "older", "short"]
const captures = await Promise.all(
	process.argv.slice(2).map(async (file) => {
		const source = JSON.parse(await readFile(file, "utf8"))
		const structured = source.structuredContent ?? source
		assert.ok(Array.isArray(structured.result))
		return structured
	}),
)
assert.equal(captures.length, 4, "Provide four captures")

const identities = new Map()
const labels = new Map()
const times = [
	...new Set(
		captures.flatMap(({ result }) =>
			result.flatMap((row) =>
				Object.entries(row)
					.filter(
						([key, value]) => /timestamp|_time$/.test(key) && typeof value === "string",
					)
					.map(([, value]) => value),
			),
		),
	),
].sort((a, b) => Date.parse(a) - Date.parse(b))

function identity(value, key) {
	if (!identities.has(value)) {
		const number = identities.size + 1
		identities.set(
			value,
			key.endsWith("jid")
				? `${number}${value.endsWith("@g.us") ? "@g.us" : "@s.whatsapp.net"}`
				: `message-${number}`,
		)
	}
	return identities.get(value)
}

function normalize(value, key = "") {
	if (Array.isArray(value)) return value.map((item) => normalize(item, key))
	if (value && typeof value === "object")
		return Object.fromEntries(
			Object.entries(value)
				.sort()
				.map(([name, item]) => [name, normalize(item, name)]),
		)
	if (typeof value === "number") return key.endsWith("is_from_me") ? value : 0
	if (typeof value !== "string" || value === "") return value
	if (key === "id" || key.endsWith("_id") || key.endsWith("jid"))
		return identity(value, key)
	if (/timestamp|_time$/.test(key)) {
		assert.ok(Number.isFinite(Date.parse(value)), "Capture contains an invalid timestamp")
		return new Date(1700000000000 + times.indexOf(value) * 60000).toISOString()
	}
	if (key === "media_type") {
		assert.ok(
			["image", "video", "reaction", "sticker", "audio", "document"].includes(value),
			"Unrecognized media type needs review",
		)
		return value
	}
	if (
		["name", "chat_name", "sender_name", "sender_display", "last_sender"].includes(key)
	) {
		if (!labels.has(value)) labels.set(value, `Contact ${labels.size + 1} — café`)
		return labels.get(value)
	}
	if (key === "content" || key === "last_message") return "Plan — café.\nمرحبا 👋"
	return `fixture-${key}`
}

for (const [index, capture] of captures.entries()) {
	await writeFile(
		new URL(`fixtures/whatsapp-${names[index]}.json`, import.meta.url),
		`${JSON.stringify(normalize(capture), null, "\t")}\n`,
	)
}
