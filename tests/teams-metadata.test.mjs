import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server
let teamsLoader
let sourceItemLoader
let sourceItemHref
let service
let directory
const originalPath = process.env.PATH
const source = JSON.parse(
	await readFile(new URL("fixtures/teams-metadata.json", import.meta.url), "utf8"),
)
const selectedChat = {
	id: "selected-chat",
	title: "Ada",
	type: "oneOnOne",
	updatedAt: 1700000060000,
}

async function respond(chat = source.chat, list = source.list) {
	await writeFile(
		path.join(directory, "responses.json"),
		JSON.stringify({
			MICROSOFT_TEAMS_CHATS_GET_ALL_CHATS: list,
			MICROSOFT_TEAMS_GET_CHAT: chat,
			MICROSOFT_TEAMS_LIST_USER_CHAT_MEMBERS: source.members,
		}),
	)
}

before(async () => {
	directory = await mkdtemp(path.join(tmpdir(), "argo-teams-test-"))
	await writeFile(
		path.join(directory, "composio"),
		`#!${process.execPath}
const { readFileSync } = require("node:fs")
const { join } = require("node:path")
const responses = JSON.parse(readFileSync(join(__dirname, "responses.json"), "utf8"))
process.stdout.write(JSON.stringify({ successful: true, error: null, data: responses[process.argv[3]] }))
`,
		{ mode: 0o700 },
	)
	process.env.PATH = `${directory}${path.delimiter}${originalPath}`
	server = await createServer({
		appType: "custom",
		configFile: "vite.renderer.config.mts",
		server: { middlewareMode: true, ws: false },
	})
	;({ teamsLoader } = await server.ssrLoadModule("/src/teams-view.tsx"))
	;({ sourceItemLoader, sourceItemHref } = await server.ssrLoadModule(
		"/src/source-item-loader.ts",
	))
	service = await server.ssrLoadModule("/src/teams-service.ts")
})

after(async () => {
	process.env.PATH = originalPath
	await server?.close()
	await rm(directory, { force: true, recursive: true })
})

test("Teams selection retains its metadata when the chat is outside the current list page", async (t) => {
	const selected = {
		id: "selected-chat",
		title: "Ada, Lin",
		type: "oneOnOne",
		updatedAt: 1700000000000,
	}
	const chats = {
		chats: [{ ...selected, id: "different-chat", title: "Another conversation" }],
		nextPageToken: "next-chats",
	}
	const messages = { messages: [], nextPageToken: "older-messages" }
	globalThis.window = {
		teams: {
			async chat(id) {
				return id === selected.id ? selected : undefined
			},
			async list(pageToken) {
				return pageToken === "later-chats" ? chats : { chats: [] }
			},
			async messages(chatId, pageToken) {
				return chatId === selected.id && pageToken === "earlier-messages"
					? messages
					: { messages: [] }
			},
		},
	}
	t.after(() => {
		delete globalThis.window
	})

	const data = await teamsLoader({
		request: new Request(
			"https://argo.test/teams?chat=selected-chat&chatsPage=later-chats&messagesPage=earlier-messages",
		),
	})

	assert.deepEqual(data, { chats, messages, selected })
})

test("an embedded Teams reference uses the selected chat title independently of its description", async (t) => {
	const messages = { messages: [], nextPageToken: "older-messages" }
	globalThis.window = {
		teams: {
			async chat() {
				return selectedChat
			},
			async messages() {
				return messages
			},
		},
	}
	t.after(() => {
		delete globalThis.window
	})
	const href = sourceItemHref({
		chatId: selectedChat.id,
		label: "Discussion requesting a proposal",
		source: "teams",
	})

	const result = await sourceItemLoader({
		request: new Request(new URL(href, "https://argo.test")),
	})

	assert.deepEqual(result, {
		content: { page: messages, source: "teams", title: "Ada" },
	})
})

test("Teams lookup reads a member-named chat outside the listed page", async () => {
	service.refreshTeams()
	await respond(source.chat, {
		...source.list,
		value: source.list.value.filter((chat) => chat.id !== "selected-chat"),
	})

	const page = await service.listTeamsChats()
	assert.ok(page.chats.every((chat) => chat.id !== "selected-chat"))
	assert.deepEqual(await service.readTeamsChat("selected-chat"), selectedChat)
})

test("Teams list and lookup share metadata until refresh", async () => {
	service.refreshTeams()
	await respond()
	const listed = await service.listTeamsChats()
	assert.deepEqual(
		listed.chats.find((chat) => chat.id === "selected-chat"),
		selectedChat,
	)

	const renamed = { ...source.chat, topic: "Updated planning" }
	await respond(renamed)
	assert.deepEqual(await service.readTeamsChat("selected-chat"), selectedChat)

	service.refreshTeams()
	assert.deepEqual(await service.readTeamsChat("selected-chat"), {
		...selectedChat,
		title: "Updated planning",
	})
	const pageAfterLookup = await service.listTeamsChats()
	assert.deepEqual(
		pageAfterLookup.chats.find((chat) => chat.id === "selected-chat"),
		{ ...selectedChat, title: "Updated planning" },
	)
})
