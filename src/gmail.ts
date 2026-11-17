import addressParser from "nodemailer/lib/addressparser"
import type { MailAddress, MailThread } from "@/mail"

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

function gmailHeader(part: GmailPart, name: string) {
	return part.headers?.find((value) => value.name.toLowerCase() === name)?.value ?? ""
}

function parseMailAddresses(value: string): MailAddress[] {
	return addressParser(value, { flatten: true }).map(({ address, name }) => ({
		address,
		...(name ? { name } : {}),
	}))
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

export function decodeGmailThread(thread: GmailThread): MailThread {
	const messages = thread.messages
		.filter((message) => !message.labelIds.includes("DRAFT"))
		.sort((a, b) => Number(a.internalDate) - Number(b.internalDate))
	const first = messages[0]
	const last = messages.at(-1)
	if (!first || !last) throw new Error(`Gmail conversation ${thread.id} has no messages`)
	return {
		date: Number(last.internalDate),
		id: thread.id,
		messages: messages.map((message) => ({
			cc: parseMailAddresses(gmailHeader(message.payload, "cc")),
			date: Number(message.internalDate),
			from: parseMailAddresses(gmailHeader(message.payload, "from"))[0] ?? {
				address: "",
			},
			html: body(message.payload, "text/html"),
			id: message.id,
			internetMessageId: gmailHeader(message.payload, "message-id"),
			references: gmailHeader(message.payload, "references").match(/<[^>]+>/g) ?? [],
			replyTo: parseMailAddresses(gmailHeader(message.payload, "reply-to")),
			text: body(message.payload, "text/plain"),
			to: parseMailAddresses(gmailHeader(message.payload, "to")),
		})),
		participants: [
			...new Set(messages.map((message) => gmailHeader(message.payload, "from"))),
		].join(", "),
		snippet: last.snippet,
		subject: gmailHeader(first.payload, "subject"),
		unread: messages.some((message) => message.labelIds.includes("UNREAD")),
	}
}
