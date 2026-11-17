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
import { singleConnectionAccounts } from "@/accounts"
import { TeamsDocument } from "@/components/presentation/chat"
import { Preview, SourceIdentity, Timestamp } from "@/components/presentation/primitives"
import { Button } from "@/components/ui/button"
import type { TeamsChat, TeamsChatPage, TeamsMessagePage } from "@/teams"

type TeamsViewData = {
	chats: TeamsChatPage
	selected: TeamsChat | null
	messages: TeamsMessagePage | null
}

export async function teamsLoader({
	request,
}: LoaderFunctionArgs): Promise<TeamsViewData> {
	const params = new URL(request.url).searchParams
	const chat = params.get("chat")
	const [chats, selected, messages] = await Promise.all([
		window.teams.list(params.get("chatsPage") ?? undefined),
		chat ? window.teams.chat(chat) : null,
		chat ? window.teams.messages(chat, params.get("messagesPage") ?? undefined) : null,
	])
	return { chats, messages, selected }
}

export function TeamsView() {
	const { chats, messages, selected } = useLoaderData() as TeamsViewData
	const [params] = useSearchParams()
	const navigation = useNavigation()
	const revalidator = useRevalidator()
	const chat = params.get("chat")
	const refreshing = revalidator.state !== "idle"
	const moreChats = new URLSearchParams(params)
	if (chats.nextPageToken) moreChats.set("chatsPage", chats.nextPageToken)
	function query(values: Record<string, string | undefined>) {
		const next = new URLSearchParams({ account: singleConnectionAccounts.teams })
		for (const [key, value] of Object.entries(values)) if (value) next.set(key, value)
		return `?${next}`
	}
	return (
		<div className="flex min-h-0 min-w-0 flex-1">
			<aside
				className={`flex min-h-0 w-80 shrink-0 flex-col border-r bg-muted/30 @4xl/content:w-96 @max-3xl/content:w-full @max-3xl/content:border-r-0 ${chat ? "@max-3xl/content:hidden" : ""}`}
				aria-label="Teams chats"
			>
				<header className="flex items-center justify-between gap-4 p-6">
					<div>
						<h1 className="mb-2 text-lg font-semibold">Chats</h1>
						<SourceIdentity
							provider="teams"
							account={singleConnectionAccounts.teams}
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
					className="min-h-0 flex-1 overflow-y-auto px-3 pb-6"
					aria-label="Chat conversations"
					aria-busy={navigation.state !== "idle"}
				>
					{chats.chats.map((item) => (
						<Link
							key={item.id}
							aria-current={chat === item.id ? "page" : undefined}
							className={`block rounded-md px-3 py-4 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${chat === item.id ? "bg-accent" : ""}`}
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
										account={singleConnectionAccounts.teams}
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
					{chats.chats.length === 0 && (
						<p className="px-3 py-6 text-sm text-muted-foreground">No chats here yet.</p>
					)}
					{chats.nextPageToken && (
						<Link
							className="mt-4 flex items-center justify-between px-3 py-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
							to={`?${moreChats}`}
						>
							More chats <span aria-hidden="true">→</span>
						</Link>
					)}
				</nav>
			</aside>
			<main
				className={`min-h-0 min-w-0 flex-1 overflow-y-auto p-6 @4xl/content:p-10 ${chat ? "" : "@max-3xl/content:hidden"}`}
				aria-label="Chat messages"
				aria-busy={navigation.state !== "idle"}
			>
				{selected && messages ? (
					<TeamsDocument
						title={selected.title}
						messages={messages.messages}
						actions={
							<Link
								className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline @3xl/content:hidden"
								to={query({ chatsPage: params.get("chatsPage") ?? undefined })}
							>
								← Chats
							</Link>
						}
					>
						{messages.nextPageToken && (
							<Link
								className="mb-6 mr-4 inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
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
								className="mb-6 mr-4 inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
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
					<div className="flex min-h-full w-full flex-col items-center justify-center gap-4 p-10 text-center">
						<MessageSquare size={24} />
						<h2 className="text-xl font-semibold">Pick up a conversation.</h2>
						<p className="max-w-prose text-sm text-muted-foreground">
							Choose a chat to read its messages.
						</p>
					</div>
				)}
			</main>
		</div>
	)
}

export function LoadingTeams() {
	return (
		<main
			className="flex min-h-full w-full flex-col items-center justify-center gap-4 p-10 text-center"
			role="status"
		>
			<h2 className="text-xl font-semibold">Opening Teams…</h2>
			<p className="max-w-prose text-sm text-muted-foreground">
				Getting chats from your CodeCreators account.
			</p>
		</main>
	)
}

export function TeamsError() {
	const error = useRouteError()
	return (
		<main
			className="flex min-h-full w-full flex-col items-center justify-center gap-4 p-10 text-center"
			role="alert"
		>
			<h2 className="text-xl font-semibold">Teams couldn’t load.</h2>
			<p className="max-w-prose text-sm text-muted-foreground">
				{error instanceof Error ? error.message : "The Teams request failed."}
			</p>
			<Button onClick={() => window.location.reload()}>Try again</Button>
		</main>
	)
}
