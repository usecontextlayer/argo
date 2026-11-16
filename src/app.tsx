import {
	createHashRouter,
	Link,
	NavLink,
	Outlet,
	RouterProvider,
	redirect,
	useLoaderData,
	useNavigation,
	useRevalidator,
	useRouteError,
} from "react-router"
import { Button } from "@/components/ui/button"
import type { MailPage, MailThread } from "@/mail"

const date = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" })
const fullDate = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
})

function Mailbox() {
	const page = useLoaderData() as MailPage
	const navigation = useNavigation()
	const revalidator = useRevalidator()
	const refreshing = revalidator.state !== "idle"
	return (
		<div className="mail-shell">
			<header className="app-header">
				<Link
					to="/mail"
					className="app-name"
				>
					argo<span className="app-name-dot">.</span>
				</Link>
				<span className="header-divider" />
				<span className="header-section">Mail</span>
				<span className="account-name">alizain@feerasta.net</span>
			</header>
			<div className="mail-workspace">
				<aside
					className="conversation-sidebar"
					aria-label="Conversations"
				>
					<div className="sidebar-heading">
						<div>
							<h1>Conversations</h1>
							<p>Your mail, together.</p>
						</div>
						<Button
							variant="outline"
							size="sm"
							disabled={refreshing}
							onClick={async () => {
								await window.mail.refresh()
								revalidator.revalidate()
							}}
						>
							{refreshing ? "Refreshing…" : "Refresh"}
						</Button>
					</div>
					<nav
						className="conversation-list"
						aria-label="Email conversations"
						aria-busy={navigation.state !== "idle"}
					>
						{page.threads.map((thread) => (
							<NavLink
								className={({ isActive }) =>
									`conversation-row ${isActive ? "is-active" : ""}`
								}
								key={thread.id}
								to={`/mail/${thread.id}`}
							>
								<div className="conversation-meta">
									<span className="conversation-sender">{thread.participants}</span>
									<time dateTime={new Date(thread.date).toISOString()}>
										{date.format(thread.date)}
									</time>
								</div>
								<div className="conversation-subject">
									{thread.unread && (
										<span
											className="unread-dot"
											role="img"
											aria-label="Unread"
										/>
									)}
									{thread.subject || "(No subject)"}
									{thread.messages.length > 1 && (
										<span className="message-count">{thread.messages.length}</span>
									)}
								</div>
								<p className="conversation-preview">{thread.snippet}</p>
							</NavLink>
						))}
						{page.threads.length === 0 && (
							<p className="empty-list">No conversations here yet.</p>
						)}
						{page.nextPageToken && (
							<Link
								className="older-link"
								to={`/mail?page=${encodeURIComponent(page.nextPageToken)}`}
							>
								Older conversations <span aria-hidden="true">→</span>
							</Link>
						)}
					</nav>
				</aside>
				<main
					className="reading-pane"
					aria-busy={navigation.state !== "idle"}
				>
					<Outlet />
				</main>
			</div>
		</div>
	)
}

function EmptyReader() {
	return (
		<div className="reader-empty">
			<span className="empty-rule" />
			<h2>A little room to read.</h2>
			<p>Choose a conversation to pick up where you left off.</p>
		</div>
	)
}

function LoadingMail() {
	return (
		<main
			className="reader-empty"
			role="status"
		>
			<h2>Opening your mail…</h2>
			<p>Getting conversations from alizain@feerasta.net.</p>
		</main>
	)
}

function htmlDocument(html: string) {
	return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none';"><style>body{margin:0;padding:0;color:#302f2b;font:15px/1.65 Arial,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}a{color:#657549}</style></head><body>${html}</body></html>`
}

function Thread() {
	const thread = useLoaderData() as MailThread
	return (
		<article className="thread">
			<header className="thread-header">
				<Link
					className="back-link"
					to="/mail"
				>
					← Conversations
				</Link>
				<h2>{thread.subject || "(No subject)"}</h2>
				<p>
					{thread.messages.length} {thread.messages.length === 1 ? "message" : "messages"}{" "}
					<span aria-hidden="true">·</span> {date.format(thread.date)}
				</p>
			</header>
			<div className="thread-messages">
				{thread.messages.map((message) => (
					<section
						className="message"
						key={message.id}
					>
						<header className="message-header">
							<div>
								<h3>{message.from}</h3>
								<p>To {message.to}</p>
							</div>
							<time dateTime={new Date(message.date).toISOString()}>
								{fullDate.format(message.date)}
							</time>
						</header>
						{message.html ? (
							<iframe
								className="message-html"
								title={`Message from ${message.from}`}
								sandbox=""
								srcDoc={htmlDocument(message.html)}
							/>
						) : (
							<div className="message-text">{message.text}</div>
						)}
					</section>
				))}
			</div>
		</article>
	)
}

function MailError() {
	const error = useRouteError()
	return (
		<main
			className="reader-empty"
			role="alert"
		>
			<h2>Mail couldn’t load.</h2>
			<p>{error instanceof Error ? error.message : "The email request failed."}</p>
			<Button onClick={() => window.location.reload()}>Try again</Button>
		</main>
	)
}

const router = createHashRouter([
	{
		Component: LoadingMail,
		HydrateFallback: LoadingMail,
		loader: () => redirect("/mail"),
		path: "/",
	},
	{
		Component: Mailbox,
		children: [
			{ Component: EmptyReader, index: true },
			{
				Component: Thread,
				loader: ({ params }) => window.mail.thread(params.threadId as string),
				path: ":threadId",
			},
		],
		ErrorBoundary: MailError,
		HydrateFallback: LoadingMail,
		loader: ({ request }) =>
			window.mail.list(new URL(request.url).searchParams.get("page") ?? undefined),
		path: "/mail",
	},
])

export default function App() {
	return <RouterProvider router={router} />
}
