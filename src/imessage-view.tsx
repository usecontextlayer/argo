import { ArrowLeft, ArrowRight, MessageSquare } from "lucide-react"
import {
	Link,
	type LoaderFunctionArgs,
	useLoaderData,
	useNavigation,
	useRevalidator,
	useRouteError,
	useSearchParams,
} from "react-router"
import { IMessageDocument } from "@/components/presentation/chat"
import { Preview, SourceIdentity, Timestamp } from "@/components/presentation/primitives"
import { Button } from "@/components/ui/button"
import {
	type IMessageChat,
	type IMessageMessage,
	type IMessagePage,
	imessagePageSize,
} from "@/imessage"

type IMessageViewData = {
	chats: IMessagePage<IMessageChat>
	selected: IMessageChat | null
	messages: IMessagePage<IMessageMessage> | null
}

export async function imessageLoader({
	request,
}: LoaderFunctionArgs): Promise<IMessageViewData> {
	const params = new URL(request.url).searchParams
	const chat = params.get("chat")
	const [chats, selected, messages] = await Promise.all([
		window.imessage.list(Number(params.get("chatsLimit") ?? imessagePageSize)),
		chat ? window.imessage.chat(Number(chat)) : null,
		chat
			? window.imessage.messages(
					Number(chat),
					Number(params.get("limit") ?? imessagePageSize),
					params.get("message") ?? undefined,
				)
			: null,
	])
	return { chats, messages, selected }
}

export function IMessageView() {
	const { chats, selected, messages } = useLoaderData() as IMessageViewData
	const [params] = useSearchParams()
	const navigation = useNavigation()
	const revalidator = useRevalidator()
	const chat = params.get("chat")
	const message = params.get("message")
	const refreshing = revalidator.state !== "idle"
	function query(values: Record<string, string | number | null>) {
		const next = new URLSearchParams()
		for (const [key, value] of Object.entries(values))
			if (value !== null) next.set(key, String(value))
		return `?${next}`
	}
	return (
		<div className={`chat-workspace ${chat ? "has-selection" : ""}`}>
			<aside
				className="conversation-sidebar chat-sidebar"
				aria-label="iMessage chats"
			>
				<header className="sidebar-heading">
					<div>
						<h1>Chats</h1>
						<SourceIdentity
							provider="imessage"
							account="Personal"
						/>
					</div>
					<Button
						variant="outline"
						size="sm"
						disabled={refreshing}
						onClick={() => revalidator.revalidate()}
					>
						{refreshing ? "Refreshing…" : "Refresh"}
					</Button>
				</header>
				<nav
					className="conversation-list"
					aria-label="iMessage conversations"
					aria-busy={navigation.state !== "idle"}
				>
					{chats.items.map((item) => (
						<Link
							key={item.id}
							className={`conversation-row ${Number(chat) === item.id ? "is-active" : ""}`}
							to={query({ chat: item.id, chatsLimit: chats.limit })}
						>
							<Preview
								title={
									<>
										{item.unread && (
											<span
												className="unread-dot"
												role="img"
												aria-label="Unread"
											/>
										)}
										{item.title}
									</>
								}
								meta={
									<Timestamp
										value={item.updatedAt}
										format="date"
									/>
								}
								identity={
									<SourceIdentity
										provider="imessage"
										account="Personal"
									/>
								}
							>
								{item.isGroup ? `Group conversation · ${item.service}` : item.service}
							</Preview>
						</Link>
					))}
					{chats.items.length === 0 && <p className="empty-list">No chats here yet.</p>}
					{chats.hasMore && (
						<div className="chat-page-links">
							<Link to={query({ chat, chatsLimit: chats.limit + imessagePageSize })}>
								More chats{" "}
								<ArrowRight
									size={14}
									aria-hidden="true"
								/>
							</Link>
						</div>
					)}
				</nav>
			</aside>
			<main
				className="reading-pane chat-reader"
				aria-label="iMessage messages"
				aria-busy={navigation.state !== "idle"}
			>
				{selected && messages ? (
					<IMessageDocument
						title={selected.title}
						service={selected.service}
						messages={messages.items}
						highlightedId={message ?? undefined}
						quoteHref={(id) =>
							query({ chat, chatsLimit: chats.limit, limit: messages.limit, message: id })
						}
						actions={
							<Link
								className="back-link"
								to={query({ chatsLimit: chats.limit })}
							>
								← Chats
							</Link>
						}
					>
						{(messages.hasMore || messages.limit > imessagePageSize || message) && (
							<nav
								className="chat-message-pages"
								aria-label="Message history"
							>
								{messages.hasMore && (
									<Link
										to={query({
											chat,
											chatsLimit: chats.limit,
											limit: messages.limit + imessagePageSize,
											message,
										})}
									>
										<ArrowLeft
											size={14}
											aria-hidden="true"
										/>{" "}
										Older messages
									</Link>
								)}
								{(messages.limit > imessagePageSize || message) && (
									<Link to={query({ chat, chatsLimit: chats.limit })}>
										Latest messages
									</Link>
								)}
							</nav>
						)}
					</IMessageDocument>
				) : (
					<div className="reader-empty">
						<MessageSquare
							size={24}
							strokeWidth={1.5}
							aria-hidden="true"
						/>
						<h2>Pick up a conversation.</h2>
						<p>Choose an iMessage chat to read its messages.</p>
					</div>
				)}
			</main>
		</div>
	)
}

export function LoadingIMessage() {
	return (
		<main
			className="reader-empty"
			role="status"
		>
			<h2>Opening iMessage…</h2>
			<p>Reading Messages on this Mac.</p>
		</main>
	)
}

export function IMessageError() {
	const error = useRouteError()
	return (
		<main
			className="reader-empty"
			role="alert"
		>
			<h2>iMessage couldn’t load.</h2>
			<p>{error instanceof Error ? error.message : "The iMessage read failed."}</p>
			<Button onClick={() => window.location.reload()}>Try again</Button>
		</main>
	)
}
