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
	const moreChats = new URLSearchParams(params)
	moreChats.set("chatsLimit", String(chats.limit + imessagePageSize))
	function query(values: Record<string, string | number | null>) {
		const next = new URLSearchParams()
		for (const [key, value] of Object.entries(values))
			if (value !== null) next.set(key, String(value))
		return `?${next}`
	}
	return (
		<div className="flex min-h-0 min-w-0 flex-1">
			<aside
				className={`flex min-h-0 w-80 shrink-0 flex-col border-r bg-muted/30 @4xl/content:w-96 @max-3xl/content:w-full @max-3xl/content:border-r-0 ${chat ? "@max-3xl/content:hidden" : ""}`}
				aria-label="iMessage chats"
			>
				<header className="flex items-center justify-between gap-4 p-6">
					<div>
						<h1 className="mb-2 text-lg font-semibold">Chats</h1>
						<SourceIdentity
							provider="imessage"
							account={singleConnectionAccounts.imessage}
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
					aria-label="iMessage conversations"
					aria-busy={navigation.state !== "idle"}
				>
					{chats.items.map((item) => (
						<Link
							key={item.id}
							aria-current={Number(chat) === item.id ? "page" : undefined}
							className={`block rounded-md px-3 py-4 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${Number(chat) === item.id ? "bg-accent" : ""}`}
							to={query({ chat: item.id, chatsLimit: chats.limit })}
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
									<Timestamp
										value={item.updatedAt}
										format="date"
									/>
								}
								identity={
									<SourceIdentity
										provider="imessage"
										account={singleConnectionAccounts.imessage}
									/>
								}
							>
								{item.isGroup ? `Group conversation · ${item.service}` : item.service}
							</Preview>
						</Link>
					))}
					{chats.items.length === 0 && (
						<p className="px-3 py-6 text-sm text-muted-foreground">No chats here yet.</p>
					)}
					{chats.hasMore && (
						<div className="flex flex-wrap items-center justify-between gap-4 px-3 py-6">
							<Link
								className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
								to={`?${moreChats}`}
							>
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
				className={`min-h-0 min-w-0 flex-1 overflow-y-auto p-6 @4xl/content:p-10 ${chat ? "" : "@max-3xl/content:hidden"}`}
				aria-label="iMessage messages"
				aria-busy={navigation.state !== "idle"}
			>
				{selected && messages ? (
					<IMessageDocument
						chat={selected}
						messages={messages.items}
						highlightedId={message ?? undefined}
						quoteHref={(id) =>
							query({ chat, chatsLimit: chats.limit, limit: messages.limit, message: id })
						}
						actions={
							<Link
								className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline @3xl/content:hidden"
								to={query({ chatsLimit: chats.limit })}
							>
								← Chats
							</Link>
						}
					>
						{(messages.hasMore || messages.limit > imessagePageSize || message) && (
							<nav
								className="flex flex-wrap items-center gap-4 py-6"
								aria-label="Message history"
							>
								{messages.hasMore && (
									<Link
										className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
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
									<Link
										className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
										to={query({ chat, chatsLimit: chats.limit })}
									>
										Latest messages
									</Link>
								)}
							</nav>
						)}
					</IMessageDocument>
				) : (
					<div className="flex min-h-full w-full flex-col items-center justify-center gap-4 p-10 text-center">
						<MessageSquare
							size={24}
							aria-hidden="true"
						/>
						<h2 className="text-xl font-semibold">Pick up a conversation.</h2>
						<p className="max-w-prose text-sm text-muted-foreground">
							Choose an iMessage chat to read its messages.
						</p>
					</div>
				)}
			</main>
		</div>
	)
}

export function LoadingIMessage() {
	return (
		<main
			className="flex min-h-full w-full flex-col items-center justify-center gap-4 p-10 text-center"
			role="status"
		>
			<h2 className="text-xl font-semibold">Opening iMessage…</h2>
			<p className="max-w-prose text-sm text-muted-foreground">
				Reading Messages on this Mac.
			</p>
		</main>
	)
}

export function IMessageError() {
	const error = useRouteError()
	return (
		<main
			className="flex min-h-full w-full flex-col items-center justify-center gap-4 p-10 text-center"
			role="alert"
		>
			<h2 className="text-xl font-semibold">iMessage couldn’t load.</h2>
			<p className="max-w-prose text-sm text-muted-foreground">
				{error instanceof Error ? error.message : "The iMessage read failed."}
			</p>
			<Button onClick={() => window.location.reload()}>Try again</Button>
		</main>
	)
}
