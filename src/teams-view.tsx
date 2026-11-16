import { MessageSquare } from "lucide-react"
import {
	Link,
	type LoaderFunctionArgs,
	useLoaderData,
	useNavigation,
	useRevalidator,
	useRouteError,
	useSearchParams,
} from "react-router"
import { getAccount } from "@/accounts"
import { TeamsDocument } from "@/components/presentation/chat"
import { Preview, SourceIdentity, Timestamp } from "@/components/presentation/primitives"
import { Button } from "@/components/ui/button"
import type { TeamsChatPage, TeamsMessagePage } from "@/teams"

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
						<SourceIdentity
							provider="teams"
							account={getAccount("codecreators").email}
						/>
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
							<Preview
								title={item.title}
								meta={
									<Timestamp
										value={item.updatedAt}
										format="date"
									/>
								}
								identity={
									<SourceIdentity
										provider="teams"
										account={getAccount("codecreators").email}
									/>
								}
							>
								{item.type === "oneOnOne"
									? "Direct chat"
									: item.type === "meeting"
										? "Meeting"
										: "Group chat"}
							</Preview>
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
					<TeamsDocument
						title={selected?.title ?? "Conversation"}
						messages={messages.messages}
						actions={
							<Link
								className="back-link"
								to={query({ chatsPage: params.get("chatsPage") ?? undefined })}
							>
								← Chats
							</Link>
						}
					>
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
					</TeamsDocument>
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
