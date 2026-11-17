import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, before, test } from "node:test"
import { simpleParser } from "mailparser"
import MailComposer from "nodemailer/lib/mail-composer/index.js"
import { createServer } from "vite"

let directory
let server
let mail
let editor
const originalPath = process.env.PATH
const gmail = "https://gmail.googleapis.com/gmail/v1/users/me"
const outlook = "https://graph.microsoft.com/v1.0/me"
const body = {
	content: [
		{
			content: [
				{ marks: [{ type: "bold" }], text: "Reviewed", type: "text" },
				{ text: " — café", type: "text" },
			],
			type: "paragraph",
		},
	],
	type: "doc",
}

// Scripted responses replace only the external CLI. MIME and editor conversion
// run through the production service and the installed mail libraries.
async function respond(responses) {
	await writeFile(path.join(directory, "responses.json"), JSON.stringify(responses))
	await writeFile(path.join(directory, "calls.ndjson"), "")
}

async function calls() {
	return (await readFile(path.join(directory, "calls.ndjson"), "utf8"))
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line))
}

async function rawMail(overrides = {}) {
	return (
		await new MailComposer({
			cc: 'Planning <planning@example.test>, "Duplicate" <other@example.test>',
			from: '"Sender, Ada" <ada@example.test>',
			html: "<p>The earlier question</p>",
			messageId: "<selected@example.test>",
			references: ["<previous@example.test>"],
			replyTo: "Replies <replies@example.test>",
			subject: "Café plans",
			to: "Me <ALIZAIN@FEERASTA.NET>, Other <other@example.test>",
			...overrides,
		})
			.compile()
			.build()
	).toString("base64url")
}

function nativeGmailDraft(raw, id = "native-draft") {
	return { id, message: { id: "mutable-message-id", raw, threadId: "conversation" } }
}

function graphMessage(overrides = {}) {
	return {
		bccRecipients: [],
		body: { content: "<p>Provider <strong>signature</strong></p>", contentType: "html" },
		ccRecipients: [],
		conversationId: "conversation",
		from: { emailAddress: { address: "sender@example.test", name: "Sender" } },
		id: "selected-message",
		internetMessageHeaders: [],
		internetMessageId: "<selected@example.test>",
		lastModifiedDateTime: "2026-11-17T10:00:00Z",
		replyTo: [{ emailAddress: { address: "replies@example.test", name: "Replies" } }],
		toRecipients: [{ emailAddress: { address: "alizain@alnujefferson.com" } }],
		...overrides,
	}
}

before(async () => {
	directory = await mkdtemp(path.join(tmpdir(), "argo-mail-drafts-"))
	await writeFile(
		path.join(directory, "composio"),
		`#!${process.execPath}
const fs = require("node:fs")
const path = require("node:path")
const argv = process.argv.slice(2)
const option = (name) => argv[argv.indexOf(name) + 1]
const request = argv[0] === "proxy"
  ? { url: argv[1], method: option("--method"), account: option("--account"), data: argv.includes("--data") ? JSON.parse(option("--data")) : undefined }
  : { tool: argv[1], account: option("--account"), data: JSON.parse(option("-d")) }
fs.appendFileSync(path.join(__dirname, "calls.ndjson"), JSON.stringify(request) + "\\n")
const responses = JSON.parse(fs.readFileSync(path.join(__dirname, "responses.json"), "utf8"))
const key = request.tool || request.method + " " + request.url
if (!Object.hasOwn(responses, key)) { process.stderr.write("Unscripted provider request: " + key); process.exit(1) }
const result = responses[key]
if (result?.exit) { process.stderr.write(result.error); process.exit(result.exit) }
process.stdout.write(JSON.stringify(result))
`,
		{ mode: 0o700 },
	)
	process.env.PATH = `${directory}${path.delimiter}${originalPath}`
	server = await createServer({
		appType: "custom",
		configFile: "vite.renderer.config.mts",
		server: { middlewareMode: true, ws: false },
	})
	mail = await server.ssrLoadModule("/src/mail-service.ts")
	editor = await server.ssrLoadModule("/src/editor.ts")
})

after(async () => {
	process.env.PATH = originalPath
	await server?.close()
	await rm(directory, { force: true, recursive: true })
})

test("Gmail replies target the selected message and resolve reply-all without the sending identity", async () => {
	const original = await rawMail()
	for (const mode of ["reply", "reply-all"]) {
		await respond({
			[`GET ${gmail}/drafts?maxResults=500`]: {},
			[`GET ${gmail}/messages/selected-message?format=raw`]: {
				id: "selected-message",
				raw: original,
				threadId: "conversation",
			},
			[`POST ${gmail}/drafts`]: { id: "native-draft" },
		})
		const draft = await mail.createMailDraft(
			"feerasta",
			"conversation",
			"selected-message",
			mode,
		)
		const create = (await calls()).find((request) => request.method === "POST")
		const parsed = await simpleParser(Buffer.from(create.data.message.raw, "base64url"))
		assert.equal(create.account, "gmail_yurt-giber")
		assert.equal(create.data.message.threadId, "conversation")
		assert.equal(parsed.inReplyTo, "<selected@example.test>")
		assert.deepEqual(parsed.references, [
			"<previous@example.test>",
			"<selected@example.test>",
		])
		assert.equal(parsed.subject, "Café plans")
		assert.deepEqual(
			parsed.to.value.map(({ address }) => address),
			mode === "reply"
				? ["replies@example.test"]
				: ["replies@example.test", "other@example.test"],
		)
		assert.deepEqual(
			parsed.cc?.value.map(({ address }) => address) ?? [],
			mode === "reply" ? [] : ["planning@example.test"],
		)
		assert.equal(draft.id, "native-draft")
		assert.equal(draft.replyToMessageId, "selected-message")
	}
})

test("Gmail resumes provider content and preserves one native draft when recipients, body and enclosed message change", async () => {
	const nativeHtml =
		'<div style="color:#336699"><p>Existing <strong>draft</strong></p><table><tr><td>Signature</td></tr></table><img src="cid:logo"><blockquote><p>Earlier question</p></blockquote></div>'
	const native = nativeGmailDraft(
		await rawMail({
			attachments: [
				{ content: Buffer.from("Project notes"), filename: "notes.txt" },
				{
					cid: "logo",
					content: Buffer.from("logo bytes"),
					contentDisposition: "inline",
					contentType: "image/png",
					filename: "logo.png",
				},
			],
			from: "Work alias <alias@example.test>",
			html: nativeHtml,
			inReplyTo: "<selected@example.test>",
			messageId: "<draft@example.test>",
			replyTo: "Alias replies <alias-replies@example.test>",
		}),
	)
	const responses = {
		[`GET ${gmail}/drafts?maxResults=500`]: { drafts: [native] },
		[`GET ${gmail}/drafts/native-draft?format=raw`]: native,
		[`GET ${gmail}/threads/conversation?format=metadata&metadataHeaders=Message-ID`]: {
			messages: [
				{
					id: "selected-message",
					payload: {
						headers: [{ name: "Message-ID", value: "<selected@example.test>" }],
					},
				},
			],
		},
		[`GET ${gmail}/messages/selected-message?format=raw`]: {
			id: "selected-message",
			raw: await rawMail(),
			threadId: "conversation",
		},
		[`PUT ${gmail}/drafts/native-draft`]: {
			id: "native-draft",
			message: { id: "new-enclosed-message" },
		},
		[`POST ${gmail}/drafts/send`]: { id: "sent-message" },
	}
	await respond(responses)
	const resumed = await mail.readMailDraft("feerasta", "conversation")
	assert.equal(resumed.id, "native-draft")
	assert.equal(resumed.replyToMessageId, "selected-message")
	assert.match(editor.documentToHtml(resumed.body), /Existing <strong>draft<\/strong>/)
	const changed = await mail.createMailDraft(
		"feerasta",
		"conversation",
		"selected-message",
		"reply-all",
	)
	assert.equal(changed.id, resumed.id)
	assert.deepEqual(changed.body, resumed.body)
	const saved = await mail.saveMailDraft("feerasta", { ...changed, body })
	await mail.sendMailDraft("feerasta", saved.id)
	const writes = (await calls()).filter((request) => request.method !== "GET")
	assert.deepEqual(
		writes.map(({ method, url }) => [method, url]),
		[
			["PUT", `${gmail}/drafts/native-draft`],
			["PUT", `${gmail}/drafts/native-draft`],
			["POST", `${gmail}/drafts/send`],
		],
	)
	const contextChange = await simpleParser(
		Buffer.from(writes[0].data.message.raw, "base64url"),
		{ skipImageLinks: true },
	)
	const originalDraft = await simpleParser(Buffer.from(native.message.raw, "base64url"), {
		skipImageLinks: true,
	})
	assert.equal(contextChange.html, originalDraft.html)
	const parsed = await simpleParser(
		Buffer.from(writes[1].data.message.raw, "base64url"),
		{ skipImageLinks: true },
	)
	const attachments = (message) =>
		message.attachments
			.map(({ filename, content, cid, contentDisposition, contentType }) => ({
				cid,
				content,
				contentDisposition,
				contentType,
				filename,
			}))
			.sort((a, b) => a.filename.localeCompare(b.filename))
	for (const message of [contextChange, parsed]) {
		assert.deepEqual(attachments(message), attachments(originalDraft))
		assert.deepEqual(message.from.value, [
			{ address: "alias@example.test", name: "Work alias" },
		])
		assert.deepEqual(message.replyTo.value, [
			{ address: "alias-replies@example.test", name: "Alias replies" },
		])
	}
	assert.equal(parsed.html, "<p><strong>Reviewed</strong> — café</p>")
	assert.equal(parsed.inReplyTo, "<selected@example.test>")
	assert.equal(parsed.messageId, "<draft@example.test>")
	assert.deepEqual(writes[2].data, { id: "native-draft" })
})

test("Gmail native drafts stay out of message history and draft-only conversations stay out of the list", async () => {
	const source = JSON.parse(
		await readFile(new URL("fixtures/gmail-thread.json", import.meta.url), "utf8"),
	)
	const draft = {
		...source.messages[1],
		id: "unsent",
		internalDate: "1900000000000",
		labelIds: ["DRAFT", "UNREAD"],
		snippet: "Not sent",
	}
	source.messages.forEach((message) => {
		message.labelIds = ["INBOX"]
	})
	source.messages.push(draft)
	await respond({
		GMAIL_LIST_THREADS: {
			data: { threads: [source, { id: "draft-only", messages: [draft] }] },
			error: null,
			successful: true,
		},
	})
	mail.refreshMail()
	const page = await mail.listMail("feerasta")
	assert.deepEqual(
		page.threads.map(({ id }) => id),
		["conversation"],
	)
	assert.deepEqual(
		page.threads[0].messages.map(({ id }) => id),
		["message-1", "message-2"],
	)
	assert.equal(page.threads[0].snippet, "Message 2 — café.")
	assert.equal(page.threads[0].date, 1700000060000)
	assert.equal(page.threads[0].unread, false)
})

test("Outlook uses native reply and reply-all recipients and saves and sends the created draft", async () => {
	for (const mode of ["reply", "reply-all"]) {
		const operation = mode === "reply" ? "createReply" : "createReplyAll"
		const native = graphMessage({
			ccRecipients:
				mode === "reply-all"
					? [{ emailAddress: { address: "provider-group@example.test" } }]
					: [],
			id: "outlook-draft",
			toRecipients: [
				{
					emailAddress: {
						address: "provider-reply@example.test",
						name: "Resolved reply",
					},
				},
			],
		})
		const query = `id,conversationId,from,toRecipients,ccRecipients,bccRecipients,replyTo,body,internetMessageId,internetMessageHeaders,lastModifiedDateTime`
		const list = new URL(`${outlook}/messages`)
		list.search = new URLSearchParams({
			$filter: "conversationId eq 'conversation' and isDraft eq true",
			$select: query,
			$top: "100",
		})
		await respond({
			[`GET ${list}`]: { value: [] },
			[`GET ${outlook}/messages/selected-message?$select=${query}`]: graphMessage(),
			[`POST ${outlook}/messages/selected-message/createReply`]: { id: native.id },
			[`POST ${outlook}/messages/selected-message/createReplyAll`]: { id: native.id },
			[`GET ${outlook}/messages/outlook-draft?$select=${query}`]: native,
			[`PATCH ${outlook}/messages/outlook-draft`]: {},
			[`POST ${outlook}/messages/outlook-draft/send`]: {},
		})
		const draft = await mail.createMailDraft(
			"alnu",
			"conversation",
			"selected-message",
			mode,
		)
		assert.equal(draft.replyToMessageId, "selected-message")
		assert.deepEqual(draft.to, [
			{ address: "provider-reply@example.test", name: "Resolved reply" },
		])
		assert.deepEqual(
			draft.cc,
			mode === "reply-all" ? [{ address: "provider-group@example.test" }] : [],
		)
		assert.equal(
			editor.documentToHtml(draft.body),
			"<p>Provider <strong>signature</strong></p>",
		)
		const saved = await mail.saveMailDraft("alnu", { ...draft, body })
		await mail.sendMailDraft("alnu", saved.id)
		const writes = (await calls()).filter((request) => request.method !== "GET")
		assert.deepEqual(
			writes.map(({ method, url }) => [method, url]),
			[
				["POST", `${outlook}/messages/selected-message/${operation}`],
				["PATCH", `${outlook}/messages/outlook-draft`],
				["POST", `${outlook}/messages/outlook-draft/send`],
			],
		)
		assert.equal(writes[0].account, "outlook_nation-thug")
		assert.equal(writes[1].data.body.content, "<p><strong>Reviewed</strong> — café</p>")
		assert.deepEqual(writes[1].data.toRecipients, native.toRecipients)
	}
})

test("Outlook changes reply mode on the existing native draft without rewriting its body or attachments", async () => {
	const query =
		"id,conversationId,from,toRecipients,ccRecipients,bccRecipients,replyTo,body,internetMessageId,internetMessageHeaders,lastModifiedDateTime"
	const list = new URL(`${outlook}/messages`)
	list.search = new URLSearchParams({
		$filter: "conversationId eq 'conversation' and isDraft eq true",
		$select: query,
		$top: "100",
	})
	const target = new URL(`${outlook}/messages`)
	target.search = new URLSearchParams({
		$filter: "internetMessageId eq '<selected@example.test>'",
		$select: "id",
		$top: "1",
	})
	const existing = graphMessage({
		bccRecipients: [{ emailAddress: { address: "copy@example.test" } }],
		body: {
			content:
				'<div style="color:#336699"><p>In progress <strong>reply</strong></p><table><tr><td>Signature</td></tr></table><img src="cid:logo"><blockquote><p>Question</p></blockquote></div>',
			contentType: "html",
		},
		id: "existing-draft",
		internetMessageHeaders: [{ name: "In-Reply-To", value: "<selected@example.test>" }],
	})
	const replacement = graphMessage({
		ccRecipients: [{ emailAddress: { address: "native-group@example.test" } }],
		id: "replacement-draft",
		toRecipients: [{ emailAddress: { address: "native-reply@example.test" } }],
	})
	await respond({
		[`GET ${list}`]: { value: [existing] },
		[`GET ${target}`]: { value: [{ id: "selected-message" }] },
		[`GET ${outlook}/messages/selected-message?$select=${query}`]: graphMessage(),
		[`POST ${outlook}/messages/selected-message/createReplyAll`]: { id: replacement.id },
		[`GET ${outlook}/messages/replacement-draft?$select=${query}`]: replacement,
		[`PATCH ${outlook}/messages/existing-draft`]: {},
		[`PATCH ${outlook}/messages/replacement-draft`]: {},
		[`DELETE ${outlook}/messages/replacement-draft`]: {},
	})
	const resumed = await mail.readMailDraft("alnu", "conversation")
	assert.equal(resumed.id, "existing-draft")
	assert.equal(resumed.replyToMessageId, "selected-message")
	assert.match(editor.documentToHtml(resumed.body), /In progress <strong>reply<\/strong>/)
	assert.equal(
		(await calls()).some(({ method }) => method !== "GET"),
		false,
	)
	const changed = await mail.createMailDraft(
		"alnu",
		"conversation",
		"selected-message",
		"reply-all",
	)
	assert.equal(changed.id, "existing-draft")
	assert.deepEqual(changed.body, resumed.body)
	assert.deepEqual(changed.bcc, [{ address: "copy@example.test" }])
	assert.deepEqual(changed.to, [{ address: "native-reply@example.test" }])
	assert.deepEqual(changed.cc, [{ address: "native-group@example.test" }])
	const writes = (await calls()).filter(({ method }) => method !== "GET")
	assert.deepEqual(
		writes.map(({ method, url }) => [method, url]),
		[
			["POST", `${outlook}/messages/selected-message/createReplyAll`],
			["PATCH", `${outlook}/messages/existing-draft`],
			["DELETE", `${outlook}/messages/replacement-draft`],
		],
	)
	assert.deepEqual(writes[1].data, {
		ccRecipients: replacement.ccRecipients,
		toRecipients: replacement.toRecipients,
	})
})

test("Outlook retargets an attachment-free draft with its native HTML and Bcc intact", async () => {
	const query =
		"id,conversationId,from,toRecipients,ccRecipients,bccRecipients,replyTo,body,internetMessageId,internetMessageHeaders,lastModifiedDateTime"
	const list = new URL(`${outlook}/messages`)
	list.search = new URLSearchParams({
		$filter: "conversationId eq 'conversation' and isDraft eq true",
		$select: query,
		$top: "100",
	})
	const existing = graphMessage({
		bccRecipients: [{ emailAddress: { address: "private-copy@example.test" } }],
		body: {
			content:
				'<table style="color:#336699"><tr><td>Existing signature</td></tr></table>',
			contentType: "html",
		},
		id: "previous-draft",
		internetMessageHeaders: [{ name: "In-Reply-To", value: "<previous@example.test>" }],
	})
	const replacement = graphMessage({ id: "retargeted-draft" })
	await respond({
		[`GET ${list}`]: { value: [existing] },
		[`GET ${outlook}/messages/selected-message?$select=${query}`]: graphMessage(),
		[`GET ${outlook}/messages/previous-draft/attachments?$top=1&$select=id`]: {
			value: [],
		},
		[`POST ${outlook}/messages/selected-message/createReply`]: { id: replacement.id },
		[`GET ${outlook}/messages/retargeted-draft?$select=${query}`]: replacement,
		[`PATCH ${outlook}/messages/retargeted-draft`]: {},
		[`DELETE ${outlook}/messages/previous-draft`]: {},
	})
	const changed = await mail.createMailDraft(
		"alnu",
		"conversation",
		"selected-message",
		"reply",
	)
	assert.equal(changed.id, replacement.id)
	assert.equal(changed.replyToMessageId, "selected-message")
	assert.deepEqual(changed.bcc, [{ address: "private-copy@example.test" }])
	const writes = (await calls()).filter(({ method }) => method !== "GET")
	assert.deepEqual(
		writes.map(({ method, url }) => [method, url]),
		[
			["POST", `${outlook}/messages/selected-message/createReply`],
			["PATCH", `${outlook}/messages/retargeted-draft`],
			["DELETE", `${outlook}/messages/previous-draft`],
		],
	)
	assert.deepEqual(writes[1].data, {
		bccRecipients: existing.bccRecipients,
		body: existing.body,
	})
})

test("Outlook leaves a native draft with attachments untouched when its reply target changes", async () => {
	const query =
		"id,conversationId,from,toRecipients,ccRecipients,bccRecipients,replyTo,body,internetMessageId,internetMessageHeaders,lastModifiedDateTime"
	const list = new URL(`${outlook}/messages`)
	list.search = new URLSearchParams({
		$filter: "conversationId eq 'conversation' and isDraft eq true",
		$select: query,
		$top: "100",
	})
	await respond({
		[`GET ${list}`]: {
			value: [
				graphMessage({
					id: "attached-draft",
					internetMessageHeaders: [
						{ name: "In-Reply-To", value: "<previous@example.test>" },
					],
				}),
			],
		},
		[`GET ${outlook}/messages/selected-message?$select=${query}`]: graphMessage(),
		[`GET ${outlook}/messages/attached-draft/attachments?$top=1&$select=id`]: {
			value: [{ id: "attachment" }],
		},
	})
	await assert.rejects(
		mail.createMailDraft("alnu", "conversation", "selected-message", "reply"),
		/attachments.*original draft is unchanged/i,
	)
	assert.deepEqual(
		(await calls()).filter(({ method }) => method !== "GET"),
		[],
	)
})

test("failed native saves and sends leave the editable mail draft available for retry", async () => {
	const draft = {
		bcc: [],
		body,
		cc: [],
		id: "native-draft",
		threadId: "conversation",
		to: [{ address: "recipient@example.test" }],
	}
	const before = structuredClone(draft)
	const native = nativeGmailDraft(await rawMail())
	await respond({
		[`GET ${gmail}/drafts/native-draft?format=raw`]: native,
		[`PUT ${gmail}/drafts/native-draft`]: { error: "Source unavailable", exit: 1 },
		[`POST ${gmail}/drafts/send`]: { error: "Delivery rejected", exit: 1 },
	})
	await assert.rejects(mail.saveMailDraft("feerasta", draft), /Source unavailable/)
	assert.deepEqual(draft, before)
	await assert.rejects(mail.sendMailDraft("feerasta", draft.id), /Delivery rejected/)
	assert.deepEqual(draft, before)
	await respond({
		[`GET ${gmail}/drafts/native-draft?format=raw`]: native,
		[`PUT ${gmail}/drafts/native-draft`]: { id: draft.id },
		[`POST ${gmail}/drafts/send`]: {},
	})
	const saved = await mail.saveMailDraft("feerasta", draft)
	await mail.sendMailDraft("feerasta", saved.id)
	const writes = (await calls()).filter((request) => request.method !== "GET")
	const parsed = await simpleParser(Buffer.from(writes[0].data.message.raw, "base64url"))
	assert.equal(parsed.html, "<p><strong>Reviewed</strong> — café</p>")
	assert.deepEqual(writes[1].data, { id: draft.id })
})
