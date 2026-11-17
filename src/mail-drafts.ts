import type { EditorDocument } from "@/editor"
import { htmlToDocument } from "@/editor"
import type { MailAddress, ReplyMode } from "@/mail"

export function mailBodyDocument(content: string, html: boolean): EditorDocument {
	if (html) return htmlToDocument(content)
	return {
		content: content.split(/\r?\n/).map((text) => ({
			type: "paragraph",
			...(text ? { content: [{ text, type: "text" }] } : {}),
		})),
		type: "doc",
	}
}

export function replyRecipients(
	message: {
		from: MailAddress[]
		to: MailAddress[]
		cc: MailAddress[]
		replyTo: MailAddress[]
	},
	accountEmail: string,
	mode: ReplyMode,
): { to: MailAddress[]; cc: MailAddress[] } {
	const seen = new Set([accountEmail.toLowerCase()])
	function distinct(addresses: MailAddress[]) {
		return addresses.filter(({ address }) => {
			const key = address.toLowerCase()
			if (seen.has(key)) return false
			seen.add(key)
			return true
		})
	}
	const ownMessage = message.from.some(
		({ address }) => address.toLowerCase() === accountEmail.toLowerCase(),
	)
	const recipients = ownMessage
		? message.to
		: message.replyTo.length
			? message.replyTo
			: message.from
	const to = distinct(mode === "reply-all" ? [...recipients, ...message.to] : recipients)
	return { cc: mode === "reply-all" ? distinct(message.cc) : [], to }
}
