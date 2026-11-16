import { execute, memoize } from "@/composio"
import {
	readTeamsMessages as decodeMessages,
	type TeamsChat,
	type TeamsChatPage,
	type TeamsMessagePage,
	type TeamsSourceMessage,
} from "@/teams"

const account = "microsoft_teams_turps-hairen"
const userId = "ec4f32b1-3898-40bb-bff5-529bf1884dfd"
const chatPages = new Map<string, Promise<TeamsChatPage>>()
const messagePages = new Map<string, Promise<TeamsMessagePage>>()
const chatTitles = new Map<string, Promise<string>>()

type Page<T> = { value: T[]; next_page_token?: string | null }
type SourceChat = {
	id: string
	topic: string | null
	chatType: string
	lastUpdatedDateTime: string
}
type Member = { userId: string; displayName: string; email?: string }

function chatTitle(chat: SourceChat): Promise<string> {
	if (chat.topic) return Promise.resolve(chat.topic)
	return memoize(chatTitles, chat.id, async () => {
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
	})
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
	const chats: TeamsChat[] = await Promise.all(
		page.value.map(async (chat) => ({
			id: chat.id,
			title: await chatTitle(chat),
			type: chat.chatType,
			updatedAt: Date.parse(chat.lastUpdatedDateTime),
		})),
	)
	return {
		chats: chats.sort((a, b) => b.updatedAt - a.updatedAt),
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
		messages: decodeMessages(page.value),
		nextPageToken: page.next_page_token ?? undefined,
	}
}

export function listTeamsChats(pageToken?: string): Promise<TeamsChatPage> {
	return memoize(chatPages, pageToken ?? "", () => fetchChats(pageToken))
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
	chatTitles.clear()
}
