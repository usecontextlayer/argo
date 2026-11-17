import {
	type AddressObject,
	type EmailAddress,
	type ParsedMail,
	simpleParser,
} from "mailparser"
import MailComposer from "nodemailer/lib/mail-composer"
import { getAccount } from "@/accounts"
import { proxy } from "@/composio"
import {
	documentToHtml,
	documentToText,
	type EditorDocument,
	emptyDocument,
} from "@/editor"
import type { MailAddress, MailDraft, ReplyMode } from "@/mail"
import { mailBodyDocument, replyRecipients } from "@/mail-drafts"

type GmailMessage = { id: string; threadId: string; raw: string }
type GmailDraft = { id: string; message: GmailMessage }
const gmail = "https://gmail.googleapis.com/gmail/v1/users/me"

function request<T>(
	account: string,
	path: string,
	method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
	data?: unknown,
) {
	return proxy<T>(getAccount(account).mail, "gmail", `${gmail}${path}`, method, data)
}

function addresses(value: AddressObject | AddressObject[] | undefined): MailAddress[] {
	function flatten(values: EmailAddress[]): MailAddress[] {
		return values.flatMap(({ address, name, group }) =>
			group
				? flatten(group)
				: [
						{
							address: address ?? "",
							...(name ? { name } : {}),
						},
					],
		)
	}
	return (Array.isArray(value) ? value : value ? [value] : []).flatMap((group) =>
		flatten(group.value),
	)
}

async function parse(message: GmailMessage): Promise<ParsedMail> {
	return simpleParser(Buffer.from(message.raw, "base64url"), {
		skipHtmlToText: true,
		skipImageLinks: true,
	})
}

async function findDraft(account: string, threadId: string): Promise<GmailDraft | null> {
	let pageToken: string | undefined
	do {
		const params = new URLSearchParams({
			maxResults: "500",
			...(pageToken ? { pageToken } : {}),
		})
		const page = await request<{ drafts?: GmailDraft[]; nextPageToken?: string }>(
			account,
			`/drafts?${params}`,
		)
		const draft = page.drafts?.find((item) => item.message.threadId === threadId)
		if (draft)
			return request<GmailDraft>(
				account,
				`/drafts/${encodeURIComponent(draft.id)}?format=raw`,
			)
		pageToken = page.nextPageToken
	} while (pageToken)
	return null
}

async function replyTarget(
	account: string,
	threadId: string,
	mail: ParsedMail,
): Promise<string | undefined> {
	if (!mail.inReplyTo) return undefined
	const thread = await request<{
		messages: { id: string; payload: { headers: { name: string; value: string }[] } }[]
	}>(
		account,
		`/threads/${encodeURIComponent(threadId)}?format=metadata&metadataHeaders=Message-ID`,
	)
	return thread.messages.find((message) =>
		message.payload.headers.some(
			(header) =>
				header.name.toLowerCase() === "message-id" && header.value === mail.inReplyTo,
		),
	)?.id
}

async function readDraft(account: string, draft: GmailDraft): Promise<MailDraft> {
	const mail = await parse(draft.message)
	return {
		bcc: addresses(mail.bcc),
		body: mailBodyDocument(mail.html || mail.text || "", Boolean(mail.html)),
		cc: addresses(mail.cc),
		id: draft.id,
		replyToMessageId: await replyTarget(account, draft.message.threadId, mail),
		threadId: draft.message.threadId,
		to: addresses(mail.to),
	}
}

async function rawMessage(
	mail: ParsedMail,
	draft: Pick<MailDraft, "to" | "cc" | "bcc">,
	accountEmail: string,
	body?: EditorDocument,
): Promise<string> {
	const composer = new MailComposer({
		attachments: mail.attachments.map((attachment) => ({
			cid: attachment.cid,
			content: attachment.content,
			contentDisposition: attachment.contentDisposition,
			contentType: attachment.contentType,
			filename: attachment.filename,
		})),
		bcc: draft.bcc,
		cc: draft.cc,
		from: addresses(mail.from).length
			? addresses(mail.from)
			: [{ address: accountEmail }],
		html: body ? documentToHtml(body) : mail.html || undefined,
		inReplyTo: mail.inReplyTo,
		messageId: mail.messageId,
		references: mail.references,
		replyTo: addresses(mail.replyTo),
		subject: mail.subject ?? "",
		text: body ? documentToText(body) : mail.text,
		to: draft.to,
	}).compile()
	composer.keepBcc = true
	return (await composer.build()).toString("base64url")
}

export async function readGmailDraft(
	account: string,
	threadId: string,
): Promise<MailDraft | null> {
	const draft = await findDraft(account, threadId)
	return draft ? readDraft(account, draft) : null
}

export async function createGmailDraft(
	account: string,
	threadId: string,
	messageId: string,
	mode: ReplyMode,
): Promise<MailDraft> {
	const [existing, original] = await Promise.all([
		findDraft(account, threadId),
		request<GmailMessage>(
			account,
			`/messages/${encodeURIComponent(messageId)}?format=raw`,
		),
	])
	if (original.threadId !== threadId)
		throw new Error("The reply message does not belong to this conversation.")
	const originalMail = await parse(original)
	if (!originalMail.messageId)
		throw new Error("The original email has no Message-ID for threading the reply.")
	const accountEmail = getAccount(account).email
	const recipients = replyRecipients(
		{
			cc: addresses(originalMail.cc),
			from: addresses(originalMail.from),
			replyTo: addresses(originalMail.replyTo),
			to: addresses(originalMail.to),
		},
		accountEmail,
		mode,
	)
	const previous = existing ? await parse(existing.message) : undefined
	const draft = {
		replyToMessageId: messageId,
		threadId,
		...recipients,
		bcc: previous ? addresses(previous.bcc) : [],
		body: previous
			? mailBodyDocument(previous.html || previous.text || "", Boolean(previous.html))
			: emptyDocument(),
	}
	const source: ParsedMail = {
		...(previous ?? originalMail),
		attachments: previous?.attachments ?? [],
		from: previous?.from ?? {
			html: "",
			text: accountEmail,
			value: [{ address: accountEmail, name: "" }],
		},
		html: previous?.html ?? false,
		inReplyTo: originalMail.messageId,
		messageId: previous?.messageId,
		references: [
			...(Array.isArray(originalMail.references)
				? originalMail.references
				: originalMail.references
					? [originalMail.references]
					: []),
			originalMail.messageId,
		],
		replyTo: previous?.replyTo,
		subject: originalMail.subject,
		text: previous?.text ?? "",
	}
	const saved = await request<GmailDraft>(
		account,
		existing ? `/drafts/${encodeURIComponent(existing.id)}` : "/drafts",
		existing ? "PUT" : "POST",
		{
			...(existing ? { id: existing.id } : {}),
			message: { raw: await rawMessage(source, draft, accountEmail), threadId },
		},
	)
	return { ...draft, id: saved.id }
}

export async function saveGmailDraft(
	account: string,
	draft: MailDraft,
): Promise<MailDraft> {
	const native = await request<GmailDraft>(
		account,
		`/drafts/${encodeURIComponent(draft.id)}?format=raw`,
	)
	const raw = await rawMessage(
		await parse(native.message),
		draft,
		getAccount(account).email,
		draft.body,
	)
	await request<GmailDraft>(account, `/drafts/${encodeURIComponent(draft.id)}`, "PUT", {
		id: draft.id,
		message: { raw, threadId: draft.threadId },
	})
	return draft
}

export async function sendGmailDraft(account: string, id: string): Promise<void> {
	await request(account, "/drafts/send", "POST", { id })
}

export async function discardGmailDraft(account: string, id: string): Promise<void> {
	await request(account, `/drafts/${encodeURIComponent(id)}`, "DELETE")
}
