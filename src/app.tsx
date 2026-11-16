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
import { MailThread } from "@/components/presentation/mail-thread"
import {
	AccountIdentity,
	Preview,
	ProviderIcon,
	Timestamp,
} from "@/components/presentation/primitives"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DoablesError, DoablesView, doablesLoader, LoadingDoables } from "@/doables-view"
import { GranolaError, GranolaView, granolaLoader, LoadingGranola } from "@/granola-view"
import {
	IMessageError,
	IMessageView,
	imessageLoader,
	LoadingIMessage,
} from "@/imessage-view"
import type { MailPage, MailThread as MailThreadData } from "@/mail"
import { accountProvider } from "@/provider-identity"
import { sourceItemLoader } from "@/source-item-loader"
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

import { WorkspaceSketch, workspaceSketchLoader } from "@/workspace-sketch"

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
							<Preview
								title={
									<>
										{thread.unread && (
											<span
												className="unread-dot"
												role="img"
												aria-label="Unread"
											/>
										)}
										{thread.subject || "(No subject)"}
									</>
								}
								identity={thread.participants}
								meta={
									<Timestamp
										value={thread.date}
										format="date"
									/>
								}
							>
								{thread.snippet}
							</Preview>
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

function Thread() {
	const thread = useLoaderData() as MailThreadData
	const [params] = useSearchParams()
	const account = params.get("account") ?? "feerasta"
	return (
		<>
			<Link
				className="back-link"
				to={`/mail?${new URLSearchParams({ account })}`}
			>
				← Conversations
			</Link>
			<MailThread
				thread={thread}
				account={account}
			/>
		</>
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
	const sketch = location.pathname.startsWith("/sketch")
	const doables = location.pathname.startsWith("/doables")
	const workflowy = location.pathname.startsWith("/workflowy")
	const granola = location.pathname.startsWith("/granola")
	const whatsapp = location.pathname.startsWith("/whatsapp")
	const imessage = location.pathname.startsWith("/imessage")
	const standalone = sketch
		? "sketch"
		: doables
			? "doables"
			: workflowy
				? "workflowy"
				: granola
					? "granola"
					: whatsapp
						? "whatsapp"
						: imessage
							? "imessage"
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
				value === "sketch" ||
				value === "doables" ||
				value === "workflowy" ||
				value === "granola" ||
				value === "whatsapp" ||
				value === "imessage"
					? navigate(`/${value}`)
					: openAccount(String(value))
			}
		>
			<header className="app-header">
				<Link
					to={`/mail?account=${account.id}`}
					className="app-name font-logo"
				>
					argo
				</Link>
				<TabsList
					variant="line"
					className="account-tab-list"
					aria-label="Accounts"
				>
					<TabsTrigger value="doables">Doables</TabsTrigger>
					<TabsTrigger value="sketch">Sketch</TabsTrigger>
					{accounts.map((item) => (
						<TabsTrigger
							key={item.id}
							value={item.id}
						>
							<AccountIdentity account={item.email} />
						</TabsTrigger>
					))}
					<TabsTrigger value="workflowy">
						<ProviderIcon provider="workflowy" />
						Workflowy
					</TabsTrigger>
					<TabsTrigger value="granola">
						<ProviderIcon provider="granola" />
						Granola
					</TabsTrigger>
					<TabsTrigger value="imessage">
						<ProviderIcon provider="imessage" />
						iMessage
					</TabsTrigger>
					<TabsTrigger value="whatsapp">
						<ProviderIcon provider="whatsapp" />
						WhatsApp
					</TabsTrigger>
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
							<TabsTrigger value="mail">
								<ProviderIcon provider={accountProvider(account.id, "mail")} />
								Mail
							</TabsTrigger>
							<TabsTrigger value="calendar">
								<ProviderIcon provider={accountProvider(account.id, "calendar")} />
								Calendar
							</TabsTrigger>
							{account.id === "codecreators" && (
								<TabsTrigger value="teams">
									<ProviderIcon provider="teams" />
									Teams
								</TabsTrigger>
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
			{ loader: sourceItemLoader, path: "source-item" },
			{
				Component: IMessageView,
				ErrorBoundary: IMessageError,
				HydrateFallback: LoadingIMessage,
				loader: imessageLoader,
				path: "imessage",
			},
			{
				Component: WorkspaceSketch,
				ErrorBoundary: DoablesError,
				HydrateFallback: LoadingDoables,
				loader: workspaceSketchLoader,
				path: "sketch",
			},
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
