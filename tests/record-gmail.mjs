// Refresh: node tests/record-gmail.mjs /absolute/path/to/GMAIL_LIST_THREADS_OUTPUT.json
// Input: a read-only Composio GMAIL_LIST_THREADS response containing at least two
// messages in its second thread. Only MIME structure and header names survive.
import { readFile, writeFile } from "node:fs/promises"

const source = JSON.parse(await readFile(process.argv[2], "utf8"))
const messages = source.data.threads[1].messages.slice(0, 2)
if (messages.length !== 2) throw new Error("The source needs two messages")

function normalize(value, key = "") {
	if (Array.isArray(value)) return value.map((item) => normalize(item, key))
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.sort()
				.map(([name, item]) => [name, normalize(item, name)]),
		)
	}
	if (typeof value === "string") return `fixture-${key}`
	if (typeof value === "number") return 0
	return value
}

function part(sourcePart, index) {
	const result = normalize(sourcePart)
	result.mimeType = sourcePart.mimeType
	result.filename = sourcePart.filename ? "fixture-attachment" : ""
	if (sourcePart.headers)
		result.headers = sourcePart.headers.map(({ name }) => ({
			name,
			value:
				{
					from: index === 0 ? "Ada <ada@example.test>" : "Lin <lin@example.test>",
					subject: index === 0 ? "Café plans" : "Re: Café plans",
					to: "Reader <reader@example.test>",
				}[name.toLowerCase()] ?? "fixture-header",
		}))
	if (sourcePart.body.data) {
		const text =
			sourcePart.mimeType === "text/html"
				? `<p>Message ${index + 1} — café.</p>`
				: `Message ${index + 1} — café.\nSecond line.`
		result.body.data = Buffer.from(text).toString("base64url")
		result.body.size = Buffer.byteLength(text)
	}
	if (sourcePart.parts) result.parts = sourcePart.parts.map((child) => part(child, index))
	return result
}

const thread = {
	id: "conversation",
	messages: messages.map((message, index) => ({
		...normalize(message),
		id: `message-${index + 1}`,
		internalDate: String(1700000000000 + index * 60000),
		labelIds: index === 0 ? ["INBOX"] : ["INBOX", "UNREAD"],
		payload: part(message.payload, index),
		snippet: `Message ${index + 1} — café.`,
	})),
}
await writeFile(
	new URL("fixtures/gmail-thread.json", import.meta.url),
	`${JSON.stringify(thread, null, "\t")}\n`,
)
