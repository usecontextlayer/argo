import type { MailThread } from "@/mail"

export type GmailPart = {
	mimeType: string
	filename?: string
	headers?: { name: string; value: string }[]
	body: { data?: string; size?: number; attachmentId?: string }
	parts?: GmailPart[]
}

export type GmailThread = {
	id: string
	messages: {
		id: string
		internalDate: string
		labelIds: string[]
		snippet: string
		payload: GmailPart
	}[]
}

function header(part: GmailPart, name: string) {
	return part.headers?.find((value) => value.name.toLowerCase() === name)?.value ?? ""
}

function body(part: GmailPart, mimeType: string): string {
	if (part.filename) return ""
	if (part.mimeType === mimeType && part.body.data)
		return Buffer.from(part.body.data, "base64url").toString("utf8")
	return (part.parts ?? [])
		.map((child) => body(child, mimeType))
		.filter(Boolean)
		.join("\n")
}

export function readGmailThread(thread: GmailThread): MailThread {
	const messages = [...thread.messages].sort(
		(a, b) => Number(a.internalDate) - Number(b.internalDate),
	)
	const first = messages[0]
	const last = messages.at(-1)
	if (!first || !last) throw new Error(`Gmail conversation ${thread.id} has no messages`)
	return {
		date: Number(last.internalDate),
		id: thread.id,
		messages: messages.map((message) => ({
			date: Number(message.internalDate),
			from: header(message.payload, "from"),
			html: body(message.payload, "text/html"),
			id: message.id,
			text: body(message.payload, "text/plain"),
			to: header(message.payload, "to"),
		})),
		participants: [
			...new Set(messages.map((message) => header(message.payload, "from"))),
		].join(", "),
		snippet: last.snippet,
		subject: header(first.payload, "subject"),
		unread: messages.some((message) => message.labelIds.includes("UNREAD")),
	}
}
