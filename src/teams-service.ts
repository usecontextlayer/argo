import { memoize } from "@/cache"
import type { ChatDraftStore } from "@/chat-drafts"
import { execute, proxy } from "@/composio"
import { documentToHtml, documentToText } from "@/editor"
import {
	decodeTeamsMessages,
	type TeamsApi,
	type TeamsChat,
	type TeamsChatPage,
	type TeamsDraft,
	type TeamsMessagePage,
	type TeamsSourceMessage,
} from "@/teams"

const account = "microsoft_teams_turps-hairen"
const userId = "ec4f32b1-3898-40bb-bff5-529bf1884dfd"
const chatPages = new Map<string, Promise<TeamsChatPage>>()
const messagePages = new Map<string, Promise<TeamsMessagePage>>()
const chats = new Map<string, Promise<TeamsChat>>()

type Page<T> = { value: T[]; next_page_token?: string | null }
type SourceChat = {
	id: string
	topic: string | null
	chatType: string
	lastUpdatedDateTime: string
}
type Member = { userId: string; displayName: string; email?: string }

async function chatTitle(chat: SourceChat): Promise<string> {
	if (chat.topic) return chat.topic
	const page = await execute<Page<Member>>(
		account,
		"MICROSOFT_TEAMS_LIST_USER_CHAT_MEMBERS",
		{
			chat_id: chat.id,
			user_id: userId,
		},
	)
	const others = page.value.filter((member) => member.userId !== userId)
	return (
		others.map((member) => member.displayName || member.email).join(", ") ||
		"Chat with yourself"
	)
}

async function readChat(chat: SourceChat): Promise<TeamsChat> {
	return {
		id: chat.id,
		title: await chatTitle(chat),
		type: chat.chatType,
		updatedAt: Date.parse(chat.lastUpdatedDateTime),
	}
}

async function fetchChats(pageToken?: string): Promise<TeamsChatPage> {
	const page = await execute<Page<SourceChat>>(
		account,
		"MICROSOFT_TEAMS_CHATS_GET_ALL_CHATS",
		{
			top: 50,
			user_id: userId,
			...(pageToken ? { page_token: pageToken } : {}),
		},
	)
	const items = await Promise.all(
		page.value.map((chat) => memoize(chats, chat.id, () => readChat(chat))),
	)
	return {
		chats: items.sort((a, b) => b.updatedAt - a.updatedAt),
		nextPageToken: page.next_page_token ?? undefined,
	}
}

async function fetchMessages(
	chatId: string,
	pageToken?: string,
): Promise<TeamsMessagePage> {
	const page = await execute<Page<TeamsSourceMessage>>(
		account,
		"MICROSOFT_TEAMS_LIST_USER_CHAT_MESSAGES",
		{
			chat_id: chatId,
			top: 50,
			user_id: userId,
			...(pageToken ? { page_token: pageToken } : {}),
		},
	)
	return {
		messages: decodeTeamsMessages(page.value, userId),
		nextPageToken: page.next_page_token ?? undefined,
	}
}

export function listTeamsChats(pageToken?: string): Promise<TeamsChatPage> {
	return memoize(chatPages, pageToken ?? "", () => fetchChats(pageToken))
}

export function readTeamsChat(id: string): Promise<TeamsChat> {
	return memoize(chats, id, async () =>
		readChat(
			await execute<SourceChat>(account, "MICROSOFT_TEAMS_GET_CHAT", { chat_id: id }),
		),
	)
}

export function readTeamsMessages(
	chatId: string,
	pageToken?: string,
): Promise<TeamsMessagePage> {
	return memoize(messagePages, JSON.stringify([chatId, pageToken]), () =>
		fetchMessages(chatId, pageToken),
	)
}

export function refreshTeams() {
	chatPages.clear()
	messagePages.clear()
	chats.clear()
}

export function createTeamsDraftService(
	drafts: ChatDraftStore<TeamsDraft>,
): Pick<TeamsApi, "draft" | "saveDraft" | "sendDraft" | "discardDraft"> {
	return {
		discardDraft: (chatId) => drafts.remove(chatId),
		draft: (chatId) => drafts.read(chatId),
		saveDraft: (chatId, draft) => drafts.save(chatId, draft),
		async sendDraft(chatId) {
			const draft = await drafts.read(chatId)
			if (!draft) throw new Error("This conversation has no saved draft.")
			if (!documentToText(draft.body).trim())
				throw new Error("Write a message before sending.")
			const html = documentToHtml(draft.body)
			if (draft.replyTo) {
				await proxy(
					account,
					"microsoft_teams",
					`https://graph.microsoft.com/v1.0/chats/${encodeURIComponent(chatId)}/messages/replyWithQuote`,
					"POST",
					{
						messageIds: [draft.replyTo.id],
						replyMessage: { body: { content: html, contentType: "html" } },
					},
				)
			} else {
				await execute(account, "MICROSOFT_TEAMS_TEAMS_POST_CHAT_MESSAGE", {
					chat_id: chatId,
					content: html,
					content_type: "html",
				})
			}
			await drafts.remove(chatId)
			refreshTeams()
		},
	}
}
