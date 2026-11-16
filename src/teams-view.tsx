import { MessageSquare, Paperclip } from "lucide-react"
import {
	Link,
	type LoaderFunctionArgs,
	useLoaderData,
	useNavigation,
	useRevalidator,
	useRouteError,
	useSearchParams,
} from "react-router"
import { Button } from "@/components/ui/button"
import type { TeamsChatPage, TeamsMessagePage } from "@/teams"

const date = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" })
const messageDate = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
})

type TeamsViewData = {
	chats: TeamsChatPage
	messages: TeamsMessagePage | null
}

export async function teamsLoader({
	request,
}: LoaderFunctionArgs): Promise<TeamsViewData> {
	const params = new URL(request.url).searchParams
	const chat = params.get("chat")
	const [chats, messages] = await Promise.all([
		window.teams.list(params.get("chatsPage") ?? undefined),
		chat ? window.teams.messages(chat, params.get("messagesPage") ?? undefined) : null,
	])
	return { chats, messages }
}

function messageText(html: string, text: string) {
	if (!html) return text
	return (
		new DOMParser().parseFromString(
			html.replace(/<br\s*\/?\s*>|<\/(?:p|div|li)>/gi, "\n"),
			"text/html",
		).body.textContent ?? ""
	)
}

export function TeamsView() {
	const { chats, messages } = useLoaderData() as TeamsViewData
	const [params] = useSearchParams()
	const navigation = useNavigation()
	const revalidator = useRevalidator()
	const selected = chats.chats.find((chat) => chat.id === params.get("chat"))
	const chat = params.get("chat")
	const refreshing = revalidator.state !== "idle"
	function query(values: Record<string, string | undefined>) {
		const next = new URLSearchParams({ account: "codecreators" })
		for (const [key, value] of Object.entries(values)) if (value) next.set(key, value)
		return `?${next}`
	}
	return (
		<div className={`teams-workspace ${chat ? "has-selection" : ""}`}>
			<aside
				className="conversation-sidebar teams-sidebar"
				aria-label="Teams chats"
			>
				<header className="sidebar-heading">
					<div>
						<h1>Chats</h1>
						<p>Microsoft Teams</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						disabled={refreshing}
						onClick={async () => {
							await window.teams.refresh()
							revalidator.revalidate()
						}}
					>
						{refreshing ? "Refreshing…" : "Refresh"}
					</Button>
				</header>
				<nav
					className="conversation-list"
					aria-label="Chat conversations"
					aria-busy={navigation.state !== "idle"}
				>
					{chats.chats.map((item) => (
						<Link
							key={item.id}
							className={`conversation-row ${chat === item.id ? "is-active" : ""}`}
							to={query({
								chat: item.id,
								chatsPage: params.get("chatsPage") ?? undefined,
							})}
						>
							<div className="conversation-meta">
								<span className="teams-chat-type">
									{item.type === "oneOnOne"
										? "Direct chat"
										: item.type === "meeting"
											? "Meeting"
											: "Group chat"}
								</span>
								<time dateTime={new Date(item.updatedAt).toISOString()}>
									{date.format(item.updatedAt)}
								</time>
							</div>
							<div className="conversation-subject">{item.title}</div>
						</Link>
					))}
					{chats.chats.length === 0 && <p className="empty-list">No chats here yet.</p>}
					{chats.nextPageToken && (
						<Link
							className="older-link"
							to={query({ chatsPage: chats.nextPageToken })}
						>
							More chats <span aria-hidden="true">→</span>
						</Link>
					)}
				</nav>
			</aside>
			<main
				className="reading-pane teams-reader"
				aria-label="Chat messages"
				aria-busy={navigation.state !== "idle"}
			>
				{messages ? (
					<article className="teams-conversation">
						<header className="thread-header">
							<Link
								className="teams-back"
								to={query({ chatsPage: params.get("chatsPage") ?? undefined })}
							>
								← Chats
							</Link>
							<h2>{selected?.title ?? "Conversation"}</h2>
							<p>{messages.messages.length} messages on this page</p>
						</header>
						{messages.nextPageToken && (
							<Link
								className="teams-older"
								to={query({
									chat: chat ?? undefined,
									chatsPage: params.get("chatsPage") ?? undefined,
									messagesPage: messages.nextPageToken,
								})}
							>
								Read older messages
							</Link>
						)}
						{params.has("messagesPage") && (
							<Link
								className="teams-older"
								to={query({
									chat: chat ?? undefined,
									chatsPage: params.get("chatsPage") ?? undefined,
								})}
							>
								Back to latest messages
							</Link>
						)}
						<div className="teams-messages">
							{messages.messages.map((message) => (
								<section
									className="teams-message"
									key={message.id}
								>
									<header className="message-header">
										<h3>{message.sender}</h3>
										<time dateTime={new Date(message.createdAt).toISOString()}>
											{messageDate.format(message.createdAt)}
										</time>
									</header>
									<div className="teams-message-text">
										{messageText(message.html, message.text)}
									</div>
									{message.attachments.length > 0 && (
										<ul
											className="teams-attachments"
											aria-label="Attachments"
										>
											{message.attachments.map((attachment) => (
												<li key={attachment.id}>
													<Paperclip
														size={14}
														aria-hidden="true"
													/>
													<span>{attachment.name}</span>
												</li>
											))}
										</ul>
									)}
								</section>
							))}
						</div>
						{messages.messages.length === 0 && (
							<p className="empty-list">No messages on this page.</p>
						)}
					</article>
				) : (
					<div className="reader-empty">
						<MessageSquare
							size={24}
							strokeWidth={1.5}
						/>
						<h2>Pick up a conversation.</h2>
						<p>Choose a chat to read its messages.</p>
					</div>
				)}
			</main>
		</div>
	)
}

export function LoadingTeams() {
	return (
		<main
			className="reader-empty"
			role="status"
		>
			<h2>Opening Teams…</h2>
			<p>Getting chats from your CodeCreators account.</p>
		</main>
	)
}

export function TeamsError() {
	const error = useRouteError()
	return (
		<main
			className="reader-empty"
			role="alert"
		>
			<h2>Teams couldn’t load.</h2>
			<p>{error instanceof Error ? error.message : "The Teams request failed."}</p>
			<Button onClick={() => window.location.reload()}>Try again</Button>
		</main>
	)
}
