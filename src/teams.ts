export type TeamsChat = {
	id: string
	title: string
	type: string
	updatedAt: number
}

export type TeamsMessage = {
	id: string
	sender: string
	createdAt: number
	html: string
	text: string
	attachments: { id: string; name: string; url?: string }[]
}

export type TeamsChatPage = { chats: TeamsChat[]; nextPageToken?: string }
export type TeamsMessagePage = { messages: TeamsMessage[]; nextPageToken?: string }

export type TeamsApi = {
	list: (pageToken?: string) => Promise<TeamsChatPage>
	messages: (chatId: string, pageToken?: string) => Promise<TeamsMessagePage>
	refresh: () => Promise<void>
}

declare global {
	interface Window {
		teams: TeamsApi
	}
}

export type TeamsSourceMessage = {
	id: string
	createdDateTime: string
	messageType: string
	from: { user?: { displayName: string }; application?: { displayName: string } } | null
	body: { contentType: string; content: string }
	attachments: { id: string; name: string | null; contentUrl: string | null }[]
}

export function readTeamsMessages(messages: TeamsSourceMessage[]): TeamsMessage[] {
	return messages
		.filter((message) => message.messageType === "message")
		.map((message) => ({
			attachments: message.attachments.map((attachment) => ({
				id: attachment.id,
				name: attachment.name ?? "Attachment",
				url: attachment.contentUrl ?? undefined,
			})),
			createdAt: Date.parse(message.createdDateTime),
			html: message.body.contentType === "html" ? message.body.content : "",
			id: message.id,
			sender:
				message.from?.user?.displayName ??
				message.from?.application?.displayName ??
				"Unknown sender",
			text: message.body.contentType === "text" ? message.body.content : "",
		}))
		.sort((a, b) => a.createdAt - b.createdAt)
}
