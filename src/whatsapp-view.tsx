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
import { WhatsAppConversation, WhatsAppDocument } from "@/components/presentation/chat"
import { Preview, SourceIdentity, Timestamp } from "@/components/presentation/primitives"
import { Button } from "@/components/ui/button"
import type {
	WhatsAppChat,
	WhatsAppContext,
	WhatsAppMessage,
	WhatsAppPage,
} from "@/whatsapp"

type WhatsAppViewData = {
	chats: WhatsAppPage<WhatsAppChat>
	selected: WhatsAppChat | null
	messages: WhatsAppPage<WhatsAppMessage> | null
	context: WhatsAppContext | null
}

export async function whatsappLoader({
	request,
}: LoaderFunctionArgs): Promise<WhatsAppViewData> {
	const params = new URL(request.url).searchParams
	const chat = params.get("chat")
	const quote = params.get("quote")
	const [chats, selected, messages, context] = await Promise.all([
		window.whatsapp.list(Number(params.get("chatsPage") ?? 0)),
		chat ? window.whatsapp.chat(chat) : null,
		chat ? window.whatsapp.messages(chat, Number(params.get("messagesPage") ?? 0)) : null,
		quote ? window.whatsapp.context(quote) : null,
	])
	return { chats, context, messages, selected }
}

export function WhatsAppView() {
	const { chats, selected, messages, context } = useLoaderData() as WhatsAppViewData
	const [params] = useSearchParams()
	const navigation = useNavigation()
	const revalidator = useRevalidator()
	const chat = params.get("chat")
	const chatsPage = Number(params.get("chatsPage") ?? 0)
	const messagesPage = Number(params.get("messagesPage") ?? 0)
	const refreshing = revalidator.state !== "idle"
	function query(values: Record<string, string | number | null>) {
		const next = new URLSearchParams()
		for (const [key, value] of Object.entries(values))
			if (value !== null && value !== 0) next.set(key, String(value))
		return `?${next}`
	}
	return (
		<div className={`whatsapp-workspace ${chat ? "has-selection" : ""}`}>
			<aside
				className="conversation-sidebar whatsapp-sidebar"
				aria-label="WhatsApp chats"
			>
				<header className="sidebar-heading">
					<div>
						<h1>Chats</h1>
						<SourceIdentity
							provider="whatsapp"
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
					aria-label="WhatsApp conversations"
					aria-busy={navigation.state !== "idle"}
				>
					{chats.items.map((item) => (
						<Link
							key={item.id}
							className={`conversation-row ${chat === item.id ? "is-active" : ""}`}
							to={query({ chat: item.id, chatsPage })}
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
									item.updatedAt !== null && (
										<Timestamp
											value={item.updatedAt}
											format="date"
										/>
									)
								}
								identity={
									<SourceIdentity
										provider="whatsapp"
										account="Personal"
									/>
								}
							>
								{item.preview}
							</Preview>
						</Link>
					))}
					{chats.items.length === 0 && (
						<p className="empty-list">No chats on this page.</p>
					)}
					<div className="whatsapp-page-links">
						{chatsPage > 0 && (
							<Link to={query({ chatsPage: chatsPage - 1 })}>
								<ArrowLeft
									size={14}
									aria-hidden="true"
								/>{" "}
								Previous chats
							</Link>
						)}
						{chats.hasMore && (
							<Link to={query({ chatsPage: chatsPage + 1 })}>
								More chats{" "}
								<ArrowRight
									size={14}
									aria-hidden="true"
								/>
							</Link>
						)}
					</div>
				</nav>
			</aside>
			<main
				className="reading-pane whatsapp-reader"
				aria-label="WhatsApp messages"
				aria-busy={navigation.state !== "idle"}
			>
				{selected && messages ? (
					<WhatsAppDocument
						title={selected.title}
						messages={messages.items}
						quoteHref={(id) => query({ chat, chatsPage, messagesPage, quote: id })}
						actions={
							<Link
								className="back-link"
								to={query({ chatsPage })}
							>
								← Chats
							</Link>
						}
					>
						<nav
							className="whatsapp-message-pages"
							aria-label="Message pages"
						>
							{messages.hasMore && (
								<Link to={query({ chat, chatsPage, messagesPage: messagesPage + 1 })}>
									<ArrowLeft
										size={14}
										aria-hidden="true"
									/>{" "}
									Older messages
								</Link>
							)}
							{messagesPage > 0 && (
								<Link to={query({ chat, chatsPage, messagesPage: messagesPage - 1 })}>
									Newer messages{" "}
									<ArrowRight
										size={14}
										aria-hidden="true"
									/>
								</Link>
							)}
							{messagesPage > 1 && (
								<Link to={query({ chat, chatsPage })}>Latest messages</Link>
							)}
						</nav>
						{context && (
							<section
								className="whatsapp-context"
								aria-label="Quoted message"
							>
								<div className="whatsapp-context-heading">
									<h3>Quoted message</h3>
									<Link to={query({ chat, chatsPage, messagesPage })}>Close context</Link>
								</div>
								<WhatsAppConversation
									messages={[...context.before, context.message, ...context.after]}
									highlightedId={context.message.id}
								/>
							</section>
						)}
					</WhatsAppDocument>
				) : (
					<div className="reader-empty">
						<MessageSquare
							size={24}
							strokeWidth={1.5}
							aria-hidden="true"
						/>
						<h2>Pick up a conversation.</h2>
						<p>Choose a WhatsApp chat to read its messages.</p>
					</div>
				)}
			</main>
		</div>
	)
}

export function LoadingWhatsApp() {
	return (
		<main
			className="reader-empty"
			role="status"
		>
			<h2>Opening WhatsApp…</h2>
			<p>Reading your chats.</p>
		</main>
	)
}

export function WhatsAppError() {
	const error = useRouteError()
	return (
		<main
			className="reader-empty"
			role="alert"
		>
			<h2>WhatsApp couldn’t load.</h2>
			<p>{error instanceof Error ? error.message : "The WhatsApp read failed."}</p>
			<Button onClick={() => window.location.reload()}>Try again</Button>
		</main>
	)
}
