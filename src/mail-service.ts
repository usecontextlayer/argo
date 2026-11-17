import { getAccount } from "@/accounts"
import { memoize } from "@/cache"
import { execute } from "@/composio"
import { decodeGmailThread, type GmailPart, type GmailThread } from "@/gmail"
import {
	createGmailDraft,
	discardGmailDraft,
	readGmailDraft,
	saveGmailDraft,
	sendGmailDraft,
} from "@/gmail-drafts"
import type { MailDraft, MailPage, MailThread, ReplyMode } from "@/mail"
import { listOutlookMail, readOutlookThread } from "@/outlook"
import {
	createOutlookDraft,
	discardOutlookDraft,
	readOutlookDraft,
	saveOutlookDraft,
	sendOutlookDraft,
} from "@/outlook-drafts"

const pages = new Map<string, Promise<MailPage>>()
const threads = new Map<string, Promise<MailThread>>()

async function fetchMailPage(accountId: string, pageToken?: string): Promise<MailPage> {
	const account = getAccount(accountId)
	if (account.provider === "microsoft") return listOutlookMail(account.mail, pageToken)
	const result = await execute<{ threads: GmailThread[]; nextPageToken?: string }>(
		account.mail,
		"GMAIL_LIST_THREADS",
		{ max_results: 20, verbose: true, ...(pageToken ? { page_token: pageToken } : {}) },
	)
	const page = {
		nextPageToken: result.nextPageToken,
		threads: result.threads
			.filter((thread) =>
				thread.messages.some((message) => !message.labelIds.includes("DRAFT")),
			)
			.map(decodeGmailThread),
	}
	for (const thread of page.threads)
		threads.set(JSON.stringify([accountId, thread.id]), Promise.resolve(thread))
	return page
}

async function fetchMailThread(accountId: string, id: string): Promise<MailThread> {
	const account = getAccount(accountId)
	if (account.provider === "microsoft") return readOutlookThread(account.mail, id)
	const thread = await execute<{
		threadId: string
		messages: {
			messageId: string
			messageTimestamp: string
			labelIds: string[]
			messageText: string
			payload: GmailPart
		}[]
	}>(account.mail, "GMAIL_FETCH_MESSAGE_BY_THREAD_ID", { thread_id: id })
	return decodeGmailThread({
		id: thread.threadId,
		messages: thread.messages.map((message) => ({
			id: message.messageId,
			internalDate: String(new Date(message.messageTimestamp).getTime()),
			labelIds: message.labelIds,
			payload: message.payload,
			snippet: message.messageText,
		})),
	})
}

export function listMail(account: string, pageToken?: string): Promise<MailPage> {
	return memoize(pages, JSON.stringify([account, pageToken]), () =>
		fetchMailPage(account, pageToken),
	)
}

export function readMailThread(account: string, id: string): Promise<MailThread> {
	return memoize(threads, JSON.stringify([account, id]), () =>
		fetchMailThread(account, id),
	)
}

export function refreshMail() {
	pages.clear()
	threads.clear()
}

export function readMailDraft(
	account: string,
	threadId: string,
): Promise<MailDraft | null> {
	return getAccount(account).provider === "google"
		? readGmailDraft(account, threadId)
		: readOutlookDraft(account, threadId)
}

export function createMailDraft(
	account: string,
	threadId: string,
	messageId: string,
	mode: ReplyMode,
): Promise<MailDraft> {
	return getAccount(account).provider === "google"
		? createGmailDraft(account, threadId, messageId, mode)
		: createOutlookDraft(account, threadId, messageId, mode)
}

export function saveMailDraft(account: string, draft: MailDraft): Promise<MailDraft> {
	return getAccount(account).provider === "google"
		? saveGmailDraft(account, draft)
		: saveOutlookDraft(account, draft)
}

export async function sendMailDraft(account: string, id: string): Promise<void> {
	await (getAccount(account).provider === "google"
		? sendGmailDraft(account, id)
		: sendOutlookDraft(account, id))
	refreshMail()
}

export async function discardMailDraft(account: string, id: string): Promise<void> {
	await (getAccount(account).provider === "google"
		? discardGmailDraft(account, id)
		: discardOutlookDraft(account, id))
}
