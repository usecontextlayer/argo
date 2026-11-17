import { getAccount } from "@/accounts"
import { proxy } from "@/composio"
import { documentToHtml } from "@/editor"
import type { MailAddress, MailDraft, ReplyMode } from "@/mail"
import { mailBodyDocument } from "@/mail-drafts"

type Recipient = { emailAddress: MailAddress }
type OutlookDraft = {
	id: string
	conversationId: string
	from: Recipient
	toRecipients: Recipient[]
	ccRecipients: Recipient[]
	bccRecipients: Recipient[]
	replyTo: Recipient[]
	body: { contentType: string; content: string }
	internetMessageId: string
	internetMessageHeaders?: { name: string; value: string }[]
	lastModifiedDateTime: string
}
const graph = "https://graph.microsoft.com/v1.0/me"

function request<T>(
	account: string,
	path: string,
	method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
	data?: unknown,
) {
	return proxy<T>(
		getAccount(account).mail,
		"outlook",
		path.startsWith("https:") ? path : `${graph}${path}`,
		method,
		data,
	)
}

const select =
	"id,conversationId,from,toRecipients,ccRecipients,bccRecipients,replyTo,body,internetMessageId,internetMessageHeaders,lastModifiedDateTime"

async function getMessage(account: string, id: string): Promise<OutlookDraft> {
	return request(account, `/messages/${encodeURIComponent(id)}?$select=${select}`)
}

async function messageIdForHeader(
	account: string,
	draft: OutlookDraft,
): Promise<string | undefined> {
	const inReplyTo = draft.internetMessageHeaders?.find(
		(header) => header.name.toLowerCase() === "in-reply-to",
	)?.value
	if (!inReplyTo) return undefined
	const params = new URLSearchParams({
		$filter: `internetMessageId eq '${inReplyTo.replaceAll("'", "''")}'`,
		$select: "id",
		$top: "1",
	})
	const page = await request<{ value: { id: string }[] }>(account, `/messages?${params}`)
	return page.value[0]?.id
}

function readDraft(draft: OutlookDraft, replyToMessageId?: string): MailDraft {
	return {
		bcc: draft.bccRecipients.map((recipient) => recipient.emailAddress),
		body: mailBodyDocument(
			draft.body.content,
			draft.body.contentType.toLowerCase() === "html",
		),
		cc: draft.ccRecipients.map((recipient) => recipient.emailAddress),
		id: draft.id,
		replyToMessageId,
		threadId: draft.conversationId,
		to: draft.toRecipients.map((recipient) => recipient.emailAddress),
	}
}

async function findDraft(
	account: string,
	threadId: string,
): Promise<OutlookDraft | null> {
	const params = new URLSearchParams({
		$filter: `conversationId eq '${threadId.replaceAll("'", "''")}' and isDraft eq true`,
		$select: select,
		$top: "100",
	})
	const drafts: OutlookDraft[] = []
	let next: string | undefined = `/messages?${params}`
	while (next) {
		const page: { value: OutlookDraft[]; "@odata.nextLink"?: string } = await request(
			account,
			next,
		)
		drafts.push(...page.value)
		next = page["@odata.nextLink"]
	}
	const draft = drafts.sort((a, b) =>
		b.lastModifiedDateTime.localeCompare(a.lastModifiedDateTime),
	)[0]
	return draft ?? null
}

export async function readOutlookDraft(
	account: string,
	threadId: string,
): Promise<MailDraft | null> {
	const draft = await findDraft(account, threadId)
	return draft ? readDraft(draft, await messageIdForHeader(account, draft)) : null
}

export async function createOutlookDraft(
	account: string,
	threadId: string,
	messageId: string,
	mode: ReplyMode,
): Promise<MailDraft> {
	const [existing, original] = await Promise.all([
		findDraft(account, threadId),
		getMessage(account, messageId),
	])
	if (original.conversationId !== threadId)
		throw new Error("The reply message does not belong to this conversation.")
	const sameTarget = existing?.internetMessageHeaders?.some(
		(header) =>
			header.name.toLowerCase() === "in-reply-to" &&
			header.value.trim() === original.internetMessageId,
	)
	if (existing && !sameTarget) {
		const attachments = await request<{ value: { id: string }[] }>(
			account,
			`/messages/${encodeURIComponent(existing.id)}/attachments?$top=1&$select=id`,
		)
		if (attachments.value.length)
			throw new Error(
				"This draft has attachments. Change its reply target in Outlook to keep them. The original draft is unchanged.",
			)
	}
	const created = await request<OutlookDraft>(
		account,
		`/messages/${encodeURIComponent(messageId)}/${mode === "reply-all" ? "createReplyAll" : "createReply"}`,
		"POST",
	)
	let result: MailDraft
	try {
		const draft = await getMessage(account, created.id)
		if (!existing) return readDraft(draft, messageId)
		if (sameTarget) {
			await request(account, `/messages/${encodeURIComponent(existing.id)}`, "PATCH", {
				ccRecipients: draft.ccRecipients,
				toRecipients: draft.toRecipients,
			})
			result = readDraft(
				{
					...existing,
					ccRecipients: draft.ccRecipients,
					toRecipients: draft.toRecipients,
				},
				messageId,
			)
		} else {
			draft.bccRecipients = existing.bccRecipients
			draft.body = existing.body
			await request(account, `/messages/${encodeURIComponent(draft.id)}`, "PATCH", {
				bccRecipients: draft.bccRecipients,
				body: draft.body,
			})
			result = readDraft(draft, messageId)
		}
	} catch (error) {
		try {
			await discardOutlookDraft(account, created.id)
		} catch (cleanupError) {
			throw new AggregateError(
				[error, cleanupError],
				"The reply change failed and its temporary draft could not be removed. The original draft remains available.",
			)
		}
		throw error
	}
	await discardOutlookDraft(account, sameTarget ? created.id : existing.id)
	return result
}

export async function saveOutlookDraft(
	account: string,
	draft: MailDraft,
): Promise<MailDraft> {
	await request(account, `/messages/${encodeURIComponent(draft.id)}`, "PATCH", {
		bccRecipients: draft.bcc.map((emailAddress) => ({ emailAddress })),
		body: { content: documentToHtml(draft.body), contentType: "HTML" },
		ccRecipients: draft.cc.map((emailAddress) => ({ emailAddress })),
		toRecipients: draft.to.map((emailAddress) => ({ emailAddress })),
	})
	return draft
}

export async function sendOutlookDraft(account: string, id: string): Promise<void> {
	await request(account, `/messages/${encodeURIComponent(id)}/send`, "POST")
}

export async function discardOutlookDraft(account: string, id: string): Promise<void> {
	await request(account, `/messages/${encodeURIComponent(id)}`, "DELETE")
}
