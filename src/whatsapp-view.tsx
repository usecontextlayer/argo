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
import { singleConnectionAccounts } from "@/accounts"
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
	function chatPageQuery(page: number) {
		const next = new URLSearchParams(params)
		next.set("chatsPage", String(page))
		return `?${next}`
	}
	return (
		<div className="flex min-h-0 min-w-0 flex-1">
			<aside
				className={`flex min-h-0 w-80 shrink-0 flex-col border-r bg-muted/30 @4xl/content:w-96 @max-3xl/content:w-full @max-3xl/content:border-r-0 ${chat ? "@max-3xl/content:hidden" : ""}`}
				aria-label="WhatsApp chats"
			>
				<header className="flex items-center justify-between gap-4 p-6">
					<div>
						<h1 className="mb-2 text-lg font-semibold">Chats</h1>
						<SourceIdentity
							provider="whatsapp"
							account={singleConnectionAccounts.whatsapp}
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
					className="min-h-0 flex-1 overflow-y-auto px-3 pb-6"
					aria-label="WhatsApp conversations"
					aria-busy={navigation.state !== "idle"}
				>
					{chats.items.map((item) => (
						<Link
							key={item.id}
							aria-current={chat === item.id ? "page" : undefined}
							className={`block rounded-md px-3 py-4 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${chat === item.id ? "bg-accent" : ""}`}
							to={query({ chat: item.id, chatsPage })}
						>
							<Preview
								title={
									<>
										{item.unread && (
											<span
												className="mr-2 inline-block size-1.5 shrink-0 rounded-full bg-primary align-middle"
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
										account={singleConnectionAccounts.whatsapp}
									/>
								}
							>
								{item.preview}
							</Preview>
						</Link>
					))}
					{chats.items.length === 0 && (
						<p className="px-3 py-6 text-sm text-muted-foreground">
							No chats on this page.
						</p>
					)}
					<div className="flex flex-wrap items-center justify-between gap-4 px-3 py-6">
						{chatsPage > 0 && (
							<Link
								className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
								to={chatPageQuery(chatsPage - 1)}
							>
								<ArrowLeft
									size={14}
									aria-hidden="true"
								/>{" "}
								Previous chats
							</Link>
						)}
						{chats.hasMore && (
							<Link
								className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
								to={chatPageQuery(chatsPage + 1)}
							>
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
				className={`min-h-0 min-w-0 flex-1 overflow-y-auto p-6 @4xl/content:p-10 ${chat ? "" : "@max-3xl/content:hidden"}`}
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
								className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline @3xl/content:hidden"
								to={query({ chatsPage })}
							>
								← Chats
							</Link>
						}
					>
						<nav
							className="flex flex-wrap items-center gap-4 py-6"
							aria-label="Message pages"
						>
							{messages.hasMore && (
								<Link
									className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
									to={query({ chat, chatsPage, messagesPage: messagesPage + 1 })}
								>
									<ArrowLeft
										size={14}
										aria-hidden="true"
									/>{" "}
									Older messages
								</Link>
							)}
							{messagesPage > 0 && (
								<Link
									className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
									to={query({ chat, chatsPage, messagesPage: messagesPage - 1 })}
								>
									Newer messages{" "}
									<ArrowRight
										size={14}
										aria-hidden="true"
									/>
								</Link>
							)}
							{messagesPage > 1 && (
								<Link
									className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
									to={query({ chat, chatsPage })}
								>
									Latest messages
								</Link>
							)}
						</nav>
						{context && (
							<section
								className="mb-6 rounded-lg bg-muted p-6"
								aria-label="Quoted message"
							>
								<div className="mb-4 flex items-center justify-between gap-4">
									<h3 className="text-sm font-semibold">Quoted message</h3>
									<Link
										className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
										to={query({ chat, chatsPage, messagesPage })}
									>
										Close context
									</Link>
								</div>
								<WhatsAppConversation
									messages={[...context.before, context.message, ...context.after]}
									highlightedId={context.message.id}
								/>
							</section>
						)}
					</WhatsAppDocument>
				) : (
					<div className="flex min-h-full w-full flex-col items-center justify-center gap-4 p-10 text-center">
						<MessageSquare
							size={24}
							aria-hidden="true"
						/>
						<h2 className="text-xl font-semibold">Pick up a conversation.</h2>
						<p className="max-w-prose text-sm text-muted-foreground">
							Choose a WhatsApp chat to read its messages.
						</p>
					</div>
				)}
			</main>
		</div>
	)
}

export function LoadingWhatsApp() {
	return (
		<main
			className="flex min-h-full w-full flex-col items-center justify-center gap-4 p-10 text-center"
			role="status"
		>
			<h2 className="text-xl font-semibold">Opening WhatsApp…</h2>
			<p className="max-w-prose text-sm text-muted-foreground">Reading your chats.</p>
		</main>
	)
}

export function WhatsAppError() {
	const error = useRouteError()
	return (
		<main
			className="flex min-h-full w-full flex-col items-center justify-center gap-4 p-10 text-center"
			role="alert"
		>
			<h2 className="text-xl font-semibold">WhatsApp couldn’t load.</h2>
			<p className="max-w-prose text-sm text-muted-foreground">
				{error instanceof Error ? error.message : "The WhatsApp read failed."}
			</p>
			<Button onClick={() => window.location.reload()}>Try again</Button>
		</main>
	)
}
