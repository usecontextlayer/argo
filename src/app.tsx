import {
	createHashRouter,
	Link,
	NavLink,
	Outlet,
	RouterProvider,
	redirect,
	useLoaderData,
	useLocation,
	useNavigate,
	useNavigation,
	useRevalidator,
	useRouteError,
	useSearchParams,
} from "react-router"
import { accounts, getAccount } from "@/accounts"
import {
	CalendarError,
	CalendarView,
	calendarLoader,
	LoadingCalendar,
} from "@/calendar-view"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DoablesError, DoablesView, doablesLoader, LoadingDoables } from "@/doables-view"
import { GranolaError, GranolaView, granolaLoader, LoadingGranola } from "@/granola-view"
import type { MailPage, MailThread } from "@/mail"
import { LoadingTeams, TeamsError, TeamsView, teamsLoader } from "@/teams-view"
import {
	LoadingWhatsApp,
	WhatsAppError,
	WhatsAppView,
	whatsappLoader,
} from "@/whatsapp-view"
import {
	LoadingWorkflowy,
	WorkflowyError,
	WorkflowyView,
	workflowyLoader,
} from "@/workflowy-view"

const date = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" })
const fullDate = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
})

function Mailbox() {
	const page = useLoaderData() as MailPage
	const [params] = useSearchParams()
	const account = params.get("account") ?? "feerasta"
	const navigation = useNavigation()
	const revalidator = useRevalidator()
	const refreshing = revalidator.state !== "idle"
	return (
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
							to={`/mail/${encodeURIComponent(thread.id)}?${new URLSearchParams({ account })}`}
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
							to={`/mail?${new URLSearchParams({ account, page: page.nextPageToken })}`}
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
	const [params] = useSearchParams()
	const account = getAccount(params.get("account") ?? "feerasta")
	return (
		<main
			className="reader-empty"
			role="status"
		>
			<h2>Opening your mail…</h2>
			<p>Getting conversations from {account.email}.</p>
		</main>
	)
}

function htmlDocument(html: string) {
	return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none';"><style>body{margin:0;padding:0;color:#302f2b;font:15px/1.65 Arial,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}a{color:#657549}</style></head><body>${html}</body></html>`
}

function Thread() {
	const thread = useLoaderData() as MailThread
	const [params] = useSearchParams()
	const account = params.get("account") ?? "feerasta"
	return (
		<article className="thread">
			<header className="thread-header">
				<Link
					className="back-link"
					to={`/mail?${new URLSearchParams({ account })}`}
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

function AppShell() {
	const [params] = useSearchParams()
	const location = useLocation()
	const navigate = useNavigate()
	const account = getAccount(params.get("account") ?? "feerasta")
	const doables = location.pathname.startsWith("/doables")
	const workflowy = location.pathname.startsWith("/workflowy")
	const granola = location.pathname.startsWith("/granola")
	const whatsapp = location.pathname.startsWith("/whatsapp")
	const standalone = doables
		? "doables"
		: workflowy
			? "workflowy"
			: granola
				? "granola"
				: whatsapp
					? "whatsapp"
					: null
	const source = location.pathname.startsWith("/calendar")
		? "calendar"
		: location.pathname.startsWith("/teams")
			? "teams"
			: "mail"
	function openAccount(id: string) {
		const query = new URLSearchParams({ account: id })
		if (source === "calendar" && params.has("month"))
			query.set("month", params.get("month") as string)
		navigate(`/${source === "teams" && id !== "codecreators" ? "mail" : source}?${query}`)
	}
	return (
		<Tabs
			className="mail-shell account-tabs"
			value={standalone ?? account.id}
			onValueChange={(value) =>
				value === "doables" ||
				value === "workflowy" ||
				value === "granola" ||
				value === "whatsapp"
					? navigate(`/${value}`)
					: openAccount(String(value))
			}
		>
			<header className="app-header">
				<Link
					to={`/mail?account=${account.id}`}
					className="app-name"
				>
					argo<span className="app-name-dot">.</span>
				</Link>
				<TabsList
					variant="line"
					className="account-tab-list"
					aria-label="Accounts"
				>
					<TabsTrigger value="doables">Doables</TabsTrigger>
					{accounts.map((item) => (
						<TabsTrigger
							key={item.id}
							value={item.id}
						>
							{item.email}
						</TabsTrigger>
					))}
					<TabsTrigger value="workflowy">Workflowy</TabsTrigger>
					<TabsTrigger value="granola">Granola</TabsTrigger>
					<TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
				</TabsList>
			</header>
			<TabsContent
				value={standalone ?? account.id}
				className="account-tab-content"
			>
				{standalone ? (
					<Outlet />
				) : (
					<Tabs
						value={source}
						className="source-tabs"
						onValueChange={(value) => navigate(`/${value}?account=${account.id}`)}
					>
						<TabsList
							variant="line"
							className="source-tab-list"
							aria-label={`${account.email} sources`}
						>
							<TabsTrigger value="mail">Mail</TabsTrigger>
							<TabsTrigger value="calendar">Calendar</TabsTrigger>
							{account.id === "codecreators" && (
								<TabsTrigger value="teams">Teams</TabsTrigger>
							)}
						</TabsList>
						<TabsContent
							value={source}
							className="source-tab-content"
						>
							<Outlet />
						</TabsContent>
					</Tabs>
				)}
			</TabsContent>
		</Tabs>
	)
}

const router = createHashRouter([
	{
		Component: AppShell,
		children: [
			{
				Component: DoablesView,
				ErrorBoundary: DoablesError,
				HydrateFallback: LoadingDoables,
				loader: doablesLoader,
				path: "doables",
			},
			{
				Component: WhatsAppView,
				ErrorBoundary: WhatsAppError,
				HydrateFallback: LoadingWhatsApp,
				loader: whatsappLoader,
				path: "whatsapp",
			},
			{
				Component: GranolaView,
				ErrorBoundary: GranolaError,
				HydrateFallback: LoadingGranola,
				loader: granolaLoader,
				path: "granola",
			},
			{
				Component: WorkflowyView,
				ErrorBoundary: WorkflowyError,
				HydrateFallback: LoadingWorkflowy,
				loader: workflowyLoader,
				path: "workflowy",
			},
			{ Component: LoadingMail, index: true, loader: () => redirect("/mail") },
			{
				Component: TeamsView,
				ErrorBoundary: TeamsError,
				HydrateFallback: LoadingTeams,
				loader: teamsLoader,
				path: "teams",
			},
			{
				Component: Mailbox,
				children: [
					{ Component: EmptyReader, index: true },
					{
						Component: Thread,
						loader: ({ params, request }) =>
							window.mail.thread(
								new URL(request.url).searchParams.get("account") ?? "feerasta",
								params.threadId as string,
							),
						path: ":threadId",
					},
				],
				ErrorBoundary: MailError,
				HydrateFallback: LoadingMail,
				loader: ({ request }) =>
					window.mail.list(
						new URL(request.url).searchParams.get("account") ?? "feerasta",
						new URL(request.url).searchParams.get("page") ?? undefined,
					),
				path: "mail",
			},
			{
				Component: CalendarView,
				ErrorBoundary: CalendarError,
				HydrateFallback: LoadingCalendar,
				loader: calendarLoader,
				path: "calendar",
			},
		],
	},
])

export default function App() {
	return <RouterProvider router={router} />
}
