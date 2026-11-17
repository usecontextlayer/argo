import type { EditorDocument } from "@/editor"

export type MailAddress = { address: string; name?: string }

export function formatMailAddress(value: MailAddress): string {
	return value.name ? `${value.name} <${value.address}>` : value.address
}

export function formatMailAddresses(values: MailAddress[]): string {
	return values.map(formatMailAddress).join(", ")
}

export type MailMessage = {
	id: string
	from: MailAddress
	to: MailAddress[]
	cc: MailAddress[]
	replyTo: MailAddress[]
	internetMessageId: string
	references: string[]
	date: number
	text: string
	html: string
}

export type ReplyMode = "reply" | "reply-all"

export type MailDraft = {
	id: string
	threadId: string
	replyToMessageId?: string
	to: MailAddress[]
	cc: MailAddress[]
	bcc: MailAddress[]
	body: EditorDocument
}

export type MailThread = {
	id: string
	subject: string
	participants: string
	snippet: string
	date: number
	unread: boolean
	messages: MailMessage[]
}

export type MailPage = {
	threads: MailThread[]
	nextPageToken?: string
}

export type MailApi = {
	list: (account: string, pageToken?: string) => Promise<MailPage>
	refresh: () => Promise<void>
	thread: (account: string, id: string) => Promise<MailThread>
	draft: (account: string, threadId: string) => Promise<MailDraft | null>
	createDraft: (
		account: string,
		threadId: string,
		messageId: string,
		mode: ReplyMode,
	) => Promise<MailDraft>
	saveDraft: (account: string, draft: MailDraft) => Promise<MailDraft>
	sendDraft: (account: string, id: string) => Promise<void>
	discardDraft: (account: string, id: string) => Promise<void>
}

declare global {
	interface Window {
		mail: MailApi
	}
}
