export type MailMessage = {
	id: string
	from: string
	to: string
	date: number
	text: string
	html: string
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
	list: (pageToken?: string) => Promise<MailPage>
	refresh: () => Promise<void>
	thread: (id: string) => Promise<MailThread>
}

declare global {
	interface Window {
		mail: MailApi
	}
}
