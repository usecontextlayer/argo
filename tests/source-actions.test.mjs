import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, before, test } from "node:test"
import { createServer } from "vite"
import { readTeamsMessages } from "../src/teams.ts"

let server
let directory
let stores
let whatsapp
let teams
let imessage
let calendar
const originalPath = process.env.PATH
const body = {
	content: [
		{
			content: [
				{ marks: [{ type: "bold" }], text: "Hello ", type: "text" },
				{ text: "café 👋", type: "text" },
			],
			type: "paragraph",
		},
		{ content: [{ text: "Second line", type: "text" }], type: "paragraph" },
	],
	type: "doc",
}

// These substitutes exercise Argo's outbound boundary without provider writes.
// They record requests and return scripted results, without implementing provider rules.
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

function draftStore(source, schema = stores.whatsAppDraftSchema) {
	return stores.createChatDraftStore(path.join(directory, "drafts"), source, schema)
}

before(async () => {
	directory = await mkdtemp(path.join(tmpdir(), "argo-source-actions-"))
	const script = `#!${process.execPath}
const fs = require("node:fs")
const path = require("node:path")
const argv = process.argv.slice(2)
const executable = path.basename(process.argv[1])
fs.appendFileSync(path.join(__dirname, "calls.ndjson"), JSON.stringify({ executable, argv }) + "\\n")
const responses = JSON.parse(fs.readFileSync(path.join(__dirname, "responses.json"), "utf8"))
const result = responses[executable === "imsg" ? "imsg" : argv[1]]
if (result?.exit) { process.stderr.write(result.error); process.exit(result.exit) }
process.stdout.write(JSON.stringify(result))
`
	await Promise.all(
		["composio", "imsg"].map((name) =>
			writeFile(path.join(directory, name), script, { mode: 0o700 }),
		),
	)
	process.env.PATH = `${directory}${path.delimiter}${originalPath}`
	server = await createServer({
		appType: "custom",
		configFile: "vite.renderer.config.mts",
		server: { middlewareMode: true, ws: false },
	})
	stores = await server.ssrLoadModule("/src/chat-drafts.ts")
	whatsapp = await server.ssrLoadModule("/src/whatsapp-service.ts")
	teams = await server.ssrLoadModule("/src/teams-service.ts")
	imessage = await server.ssrLoadModule("/src/imessage-service.ts")
	calendar = await server.ssrLoadModule("/src/calendar-service.ts")
})

after(async () => {
	process.env.PATH = originalPath
	await server?.close()
	await rm(directory, { force: true, recursive: true })
})

test("local drafts survive reopening with rich text and quotes, isolated by source, account and conversation", async () => {
	const draft = {
		body,
		replyTo: { id: "message-older", senderId: "sender@s.whatsapp.net", text: "Original" },
	}
	const store = draftStore("whatsapp/Personal")
	await store.save("same/chat:id", draft)
	const reopened = draftStore("whatsapp/Personal")
	assert.deepEqual(await reopened.read("same/chat:id"), draft)
	assert.equal(await reopened.read("another-chat"), null)
	assert.equal(await draftStore("whatsapp/Work").read("same/chat:id"), null)
	assert.equal(
		await draftStore("teams/Personal", stores.teamsDraftSchema).read("same/chat:id"),
		null,
	)
	await reopened.remove("same/chat:id")
	assert.equal(await store.read("same/chat:id"), null)
})

test("WhatsApp sends the selected native quote and retains the latest draft when delivery fails", async () => {
	const requests = []
	let succeeds = false
	const service = whatsapp.createWhatsAppService(
		{
			client: async () => ({
				callTool: async (request) => {
					requests.push(request)
					return {
						structuredContent: {
							message: succeeds ? "Sent" : "Offline",
							success: succeeds,
						},
					}
				},
			}),
		},
		draftStore("whatsapp/Send"),
	)
	const draft = {
		body,
		replyTo: {
			id: "selected-old-message",
			senderId: "person@s.whatsapp.net",
			text: "Earlier question",
		},
	}
	await service.saveDraft("group@g.us", draft)
	await assert.rejects(service.sendDraft("group@g.us"), /Offline/)
	assert.deepEqual(await service.draft("group@g.us"), draft)
	assert.deepEqual(requests[0], {
		arguments: {
			message: "*Hello* café 👋\n\nSecond line",
			quoted_content: "Earlier question",
			quoted_message_id: "selected-old-message",
			quoted_sender_jid: "person@s.whatsapp.net",
			recipient: "group@g.us",
		},
		name: "send_message",
	})
	succeeds = true
	await service.sendDraft("group@g.us")
	assert.equal(await service.draft("group@g.us"), null)
	await service.saveDraft("direct@s.whatsapp.net", { body })
	await service.sendDraft("direct@s.whatsapp.net")
	assert.deepEqual(requests.at(-1).arguments, {
		message: "*Hello* café 👋\n\nSecond line",
		recipient: "direct@s.whatsapp.net",
	})
})

test("Teams ordinary messages and native quoted replies use their respective provider operations", async () => {
	const service = teams.createTeamsDraftService(
		draftStore("teams/Send", stores.teamsDraftSchema),
	)
	const chatId = "19:group/chat@thread.v2"
	const quoteUrl = `https://graph.microsoft.com/v1.0/chats/${encodeURIComponent(chatId)}/messages/replyWithQuote`
	await respond({
		MICROSOFT_TEAMS_TEAMS_POST_CHAT_MESSAGE: {
			data: { id: "sent-normal" },
			error: null,
			successful: true,
		},
		[quoteUrl]: { id: "sent-quote" },
	})
	await service.saveDraft(chatId, { body })
	await service.sendDraft(chatId)
	let request = (await calls())[0]
	assert.equal(request.argv[0], "execute")
	assert.equal(request.argv[1], "MICROSOFT_TEAMS_TEAMS_POST_CHAT_MESSAGE")
	assert.equal(
		request.argv[request.argv.indexOf("--account") + 1],
		"microsoft_teams_turps-hairen",
	)
	assert.deepEqual(JSON.parse(request.argv[request.argv.indexOf("-d") + 1]), {
		chat_id: chatId,
		content: "<p><strong>Hello </strong>café 👋</p><p>Second line</p>",
		content_type: "html",
	})
	await service.saveDraft(chatId, {
		body,
		replyTo: { id: "selected-message", sender: "Ada", text: "Question" },
	})
	await service.sendDraft(chatId)
	request = (await calls())[1]
	assert.equal(request.argv[0], "proxy")
	assert.equal(request.argv[1], quoteUrl)
	assert.equal(request.argv[request.argv.indexOf("--method") + 1], "POST")
	assert.deepEqual(JSON.parse(request.argv[request.argv.indexOf("--data") + 1]), {
		messageIds: ["selected-message"],
		replyMessage: {
			body: {
				content: "<p><strong>Hello </strong>café 👋</p><p>Second line</p>",
				contentType: "html",
			},
		},
	})
	assert.equal(await service.draft(chatId), null)
})

test("Teams provider send failure leaves the editable quoted draft available", async () => {
	const service = teams.createTeamsDraftService(
		draftStore("teams/Failure", stores.teamsDraftSchema),
	)
	const chatId = "19:failure@thread.v2"
	const url = `https://graph.microsoft.com/v1.0/chats/${encodeURIComponent(chatId)}/messages/replyWithQuote`
	const draft = { body, replyTo: { id: "original", sender: "Ada", text: "Question" } }
	await respond({ [url]: { error: "Provider rejected the quote", exit: 1 } })
	await service.saveDraft(chatId, draft)
	await assert.rejects(service.sendDraft(chatId), /Provider rejected the quote/)
	assert.deepEqual(await service.draft(chatId), draft)
})

test("Teams history exposes a native quoted reply separately from file attachments", () => {
	// Minimal synthetic example of Microsoft's documented replyWithQuote response;
	// this is not a recorded provider fixture.
	// https://learn.microsoft.com/en-us/graph/api/chatmessage-replywithquote?view=graph-rest-1.0
	const [message] = readTeamsMessages(
		[
			{
				attachments: [
					{
						content: JSON.stringify({
							messageId: "original-message",
							messagePreview: "Earlier question",
							messageSender: {
								application: null,
								device: null,
								user: { displayName: "Ada", id: "original-sender" },
							},
						}),
						contentType: "messageReference",
						contentUrl: null,
						id: "original-message",
						name: null,
					},
					{
						contentType: "reference",
						contentUrl: "https://example.test/plan.pdf",
						id: "file-attachment",
						name: "Plan.pdf",
					},
				],
				body: {
					content:
						'<p></p><attachment id="original-message"></attachment><p>My reply</p>',
					contentType: "html",
				},
				createdDateTime: "2026-11-17T15:18:54.196Z",
				from: { user: { displayName: "Me", id: "current-user" } },
				id: "reply-message",
				messageType: "message",
			},
		],
		"current-user",
	)
	assert.deepEqual(message.quote, {
		messageId: "original-message",
		sender: "Ada",
		text: "Earlier question",
	})
	assert.deepEqual(message.attachments, [
		{ id: "file-attachment", name: "Plan.pdf", url: "https://example.test/plan.pdf" },
	])
	assert.equal(message.mine, true)
	assert.equal(message.sender, "You")
})

test("Teams history reads quoted application messages whose user identity is null", () => {
	const [message] = readTeamsMessages([
		{
			attachments: [
				{
					content: JSON.stringify({
						messageId: "application-message",
						messagePreview: "Build completed",
						messageSender: {
							application: { displayName: "Build bot", id: "application-id" },
							device: null,
							user: null,
						},
					}),
					contentType: "messageReference",
					contentUrl: null,
					id: "application-message",
					name: null,
				},
			],
			body: { content: "<p>Thanks</p>", contentType: "html" },
			createdDateTime: "2026-11-17T15:18:54.196Z",
			from: { user: { displayName: "Ada", id: "ada" } },
			id: "reply-message",
			messageType: "message",
		},
	])
	assert.deepEqual(message.quote, {
		messageId: "application-message",
		sender: undefined,
		text: "Build completed",
	})
	assert.deepEqual(message.attachments, [])
	assert.equal(message.html, "<p>Thanks</p>")
})

test("iMessage sends readable plain text to the existing native chat and preserves failed drafts", async () => {
	const service = imessage.createIMessageDraftService(
		draftStore("imessage/Personal", stores.iMessageDraftSchema),
	)
	await respond({ imsg: { error: "Messages unavailable", exit: 1 } })
	await service.saveDraft(42, { body })
	await assert.rejects(service.sendDraft(42), /Messages unavailable/)
	assert.deepEqual(await service.draft(42), { body })
	await respond({ imsg: { success: true } })
	await service.sendDraft(42)
	assert.deepEqual(await calls(), [
		{
			argv: [
				"send",
				"--chat-id",
				"42",
				"--text",
				"Hello café 👋\n\nSecond line",
				"--json",
			],
			executable: "imsg",
		},
	])
	assert.equal(await service.draft(42), null)
})

function googleEvent(id, overrides = {}) {
	return {
		attendees: [
			{ email: "ALIZAIN@FEERASTA.NET", responseStatus: "tentative", self: false },
		],
		end: { dateTime: "2026-11-17T15:00:00Z" },
		id,
		organizer: { email: "organizer@example.test" },
		start: { dateTime: "2026-11-17T14:00:00Z" },
		summary: "Planning",
		...overrides,
	}
}

function outlookEvent(id, overrides = {}) {
	return {
		attendees: [
			{
				emailAddress: { address: "ALIZAIN@ALNUJEFFERSON.COM", name: "Me" },
				status: { response: "tentativelyAccepted" },
			},
		],
		end: { dateTime: "2026-11-17T15:00:00", timeZone: "UTC" },
		id,
		isAllDay: false,
		isCancelled: false,
		isOrganizer: false,
		organizer: { emailAddress: { address: "organizer@example.test", name: "Organizer" } },
		responseStatus: { response: "tentativelyAccepted" },
		start: { dateTime: "2026-11-17T14:00:00", timeZone: "UTC" },
		subject: "Planning",
		...overrides,
	}
}

function success(data) {
	return { data, error: null, successful: true }
}

test("calendar readers expose RSVP only for the owning account's invited attendee", async () => {
	calendar.refreshCalendar()
	const google = [
		googleEvent("invited/raw:id"),
		googleEvent("other", {
			attendees: [
				{ email: "other@example.test", responseStatus: "needsAction", self: true },
			],
		}),
		googleEvent("organizer", { organizer: { email: "ALIZAIN@FEERASTA.NET" } }),
		googleEvent("cancelled", { status: "cancelled" }),
		googleEvent("focus", { eventType: "focusTime" }),
	]
	const outlook = [
		outlookEvent("invited/raw:id"),
		outlookEvent("other", {
			attendees: [
				{
					emailAddress: { address: "other@example.test" },
					status: { response: "notResponded" },
				},
			],
		}),
		outlookEvent("organizer", { isOrganizer: true }),
		outlookEvent("organizer-email", {
			organizer: { emailAddress: { address: "ALIZAIN@ALNUJEFFERSON.COM" } },
		}),
		outlookEvent("cancelled", { isCancelled: true }),
	]
	await respond({
		GOOGLECALENDAR_EVENTS_LIST_ALL_CALENDARS: success({
			calendars_queried: [
				{ id: "shared/calendar", summary: "Shared" },
				{ id: "alizain@feerasta.net", summary: "Personal" },
			],
			errors_by_calendar: {},
			events: google.map((event) => ({
				all_calendar_ids: ["shared/calendar", "alizain@feerasta.net"],
				event,
				source_calendar_id: "shared/calendar",
			})),
		}),
		OUTLOOK_GET_CALENDAR_VIEW: success({ value: outlook }),
		OUTLOOK_LIST_CALENDARS: success({
			value: [{ id: "calendar/raw:id", name: "Calendar" }],
		}),
	})
	const googlePage = await calendar.listCalendar("feerasta", "2026-11")
	assert.deepEqual(
		googlePage.events.filter((event) => event.invitation).map((event) => event.id),
		["feerasta:shared/calendar:invited/raw:id"],
	)
	assert.deepEqual(googlePage.events[0].invitation, { response: "tentative" })
	assert.deepEqual(googlePage.events[0].native, {
		calendarId: "alizain@feerasta.net",
		eventId: "invited/raw:id",
	})
	assert.deepEqual(
		googlePage.events[0].attendees.map((attendee) => attendee.self),
		[true],
	)
	assert.deepEqual(
		googlePage.events[1].attendees.map((attendee) => attendee.self),
		[false],
	)
	const outlookPage = await calendar.listCalendar("alnu", "2026-11")
	assert.deepEqual(
		outlookPage.events.filter((event) => event.invitation).map((event) => event.id),
		["calendar/raw:id:invited/raw:id"],
	)
	assert.deepEqual(outlookPage.events[0].invitation, { response: "tentative" })
	assert.deepEqual(outlookPage.events[0].native, {
		calendarId: "calendar/raw:id",
		eventId: "invited/raw:id",
	})
	assert.equal(
		outlookPage.events.some((event) => event.id.endsWith(":cancelled")),
		false,
	)
})

test("RSVP targets the selected raw occurrence and owning account and notifies the organizer", async () => {
	await respond({
		GOOGLECALENDAR_PATCH_EVENT: success({}),
		OUTLOOK_ACCEPT_EVENT: success({}),
		OUTLOOK_DECLINE_EVENT: success({}),
	})
	const event = {
		end: { date: "2026-11-18" },
		id: "presentation:id:must:not:be:parsed",
		invitation: { response: "needsAction" },
		native: { calendarId: "owner/calendar:id", eventId: "raw/occurrence:id" },
		start: { date: "2026-11-17" },
		summary: "Selected recurring occurrence",
	}
	for (const response of ["accepted", "tentative", "declined"]) {
		await calendar.respondCalendar("eightzerothree", event, response)
		await calendar.respondCalendar("codecreators", event, response)
	}
	const requests = (await calls()).map(({ argv }) => ({
		account: argv[argv.indexOf("--account") + 1],
		data: JSON.parse(argv[argv.indexOf("-d") + 1]),
		slug: argv[1],
	}))
	assert.deepEqual(requests, [
		{
			account: "googlecalendar_ler-fetal",
			data: {
				calendar_id: "owner/calendar:id",
				event_id: "raw/occurrence:id",
				rsvp_response: "accepted",
				send_updates: "all",
			},
			slug: "GOOGLECALENDAR_PATCH_EVENT",
		},
		{
			account: "outlook_vina-calf",
			data: {
				event_id: "raw/occurrence:id",
				response_type: "accept",
				send_response: true,
			},
			slug: "OUTLOOK_ACCEPT_EVENT",
		},
		{
			account: "googlecalendar_ler-fetal",
			data: {
				calendar_id: "owner/calendar:id",
				event_id: "raw/occurrence:id",
				rsvp_response: "tentative",
				send_updates: "all",
			},
			slug: "GOOGLECALENDAR_PATCH_EVENT",
		},
		{
			account: "outlook_vina-calf",
			data: {
				event_id: "raw/occurrence:id",
				response_type: "tentative",
				send_response: true,
			},
			slug: "OUTLOOK_ACCEPT_EVENT",
		},
		{
			account: "googlecalendar_ler-fetal",
			data: {
				calendar_id: "owner/calendar:id",
				event_id: "raw/occurrence:id",
				rsvp_response: "declined",
				send_updates: "all",
			},
			slug: "GOOGLECALENDAR_PATCH_EVENT",
		},
		{
			account: "outlook_vina-calf",
			data: { event_id: "raw/occurrence:id", send_response: true },
			slug: "OUTLOOK_DECLINE_EVENT",
		},
	])
	await assert.rejects(
		calendar.respondCalendar(
			"eightzerothree",
			{ ...event, invitation: undefined },
			"accepted",
		),
		/not an invitation/,
	)
	assert.equal((await calls()).length, 6)
})
