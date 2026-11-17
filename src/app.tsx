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
	useSearchParams,
} from "react-router"
import { getAccount } from "@/accounts"
import { AppNavigation } from "@/app-navigation"
import {
	CalendarError,
	CalendarView,
	calendarLoader,
	LoadingCalendar,
} from "@/calendar-view"
import { MailThread } from "@/components/presentation/mail-thread"
import { Preview, Timestamp } from "@/components/presentation/primitives"
import { Button } from "@/components/ui/button"
import { DoablesError, DoablesView, doablesLoader, LoadingDoables } from "@/doables-view"
import { GranolaError, GranolaView, granolaLoader, LoadingGranola } from "@/granola-view"
import {
	IMessageError,
	IMessageView,
	imessageLoader,
	LoadingIMessage,
} from "@/imessage-view"
import type { MailPage, MailThread as MailThreadData } from "@/mail"
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

function Mailbox() {
	const page = useLoaderData() as MailPage
	const [params] = useSearchParams()
	const account = params.get("account") ?? "feerasta"
	const pageToken = params.get("page")
	const navigation = useNavigation()
	const revalidator = useRevalidator()
	const refreshing = revalidator.state !== "idle"
	return (
		<div className="group/mail flex min-h-0 min-w-0 flex-1">
			<aside
				className="flex min-h-0 w-80 shrink-0 flex-col border-r bg-muted/30 @4xl/content:w-96 @max-3xl/content:w-full @max-3xl/content:border-r-0 @max-3xl/content:group-has-[[data-slot=document]]/mail:hidden"
				aria-label="Conversations"
			>
				<div className="flex items-center justify-between gap-4 p-6">
					<h1 className="text-lg font-semibold">Conversations</h1>
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
					className="min-h-0 flex-1 overflow-y-auto px-3 pb-6"
					aria-label="Email conversations"
					aria-busy={navigation.state !== "idle"}
				>
					{page.threads.map((thread) => (
						<NavLink
							className={({ isActive }) =>
								`block rounded-md px-3 py-4 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive ? "bg-accent" : ""}`
							}
							key={thread.id}
							to={`/mail/${encodeURIComponent(thread.id)}?${new URLSearchParams({ account, ...(pageToken ? { page: pageToken } : {}) })}`}
						>
							<Preview
								title={
									<>
										{thread.unread && (
											<span
												className="mr-2 inline-block size-1.5 shrink-0 rounded-full bg-primary align-middle"
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
						<p className="px-3 py-6 text-sm text-muted-foreground">
							No conversations here yet.
						</p>
					)}
					{page.nextPageToken && (
						<Link
							className="flex items-center justify-between px-3 py-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
							to={`?${new URLSearchParams({ account, page: page.nextPageToken })}`}
						>
							Older conversations <span aria-hidden="true">→</span>
						</Link>
					)}
				</nav>
			</aside>
			<main
				className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6 @4xl/content:p-10 @max-3xl/content:group-not-has-[[data-slot=document]]/mail:hidden"
				aria-busy={navigation.state !== "idle"}
			>
				<Outlet />
			</main>
		</div>
	)
}

function EmptyReader() {
	return (
		<div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
			<h2 className="text-xl font-semibold">A little room to read.</h2>
			<p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
				Choose a conversation to pick up where you left off.
			</p>
		</div>
	)
}

function LoadingMail() {
	const [params] = useSearchParams()
	const account = getAccount(params.get("account") ?? "feerasta")
	return (
		<main
			className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
			role="status"
		>
			<h2 className="text-xl font-semibold">Opening your mail…</h2>
			<p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
				Getting conversations from {account.email}.
			</p>
		</main>
	)
}

function Thread() {
	const thread = useLoaderData() as MailThreadData
	const [params] = useSearchParams()
	const account = params.get("account") ?? "feerasta"
	const pageToken = params.get("page")
	return (
		<>
			<Link
				className="mb-6 hidden text-sm font-medium text-primary underline-offset-4 hover:underline @max-3xl/content:inline-block"
				to={`/mail?${new URLSearchParams({ account, ...(pageToken ? { page: pageToken } : {}) })}`}
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
			className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
			role="alert"
		>
			<h2 className="text-xl font-semibold">Mail couldn’t load.</h2>
			<p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
				{error instanceof Error ? error.message : "The email request failed."}
			</p>
			<Button onClick={() => window.location.reload()}>Try again</Button>
		</main>
	)
}

function AppShell() {
	return (
		<div className="flex h-dvh overflow-hidden">
			<AppNavigation />
			<div className="@container/content flex min-h-0 min-w-0 flex-1">
				<Outlet />
			</div>
		</div>
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
				id: "calendar",
				loader: calendarLoader,
				path: "calendar",
			},
		],
	},
])

export default function App() {
	return <RouterProvider router={router} />
}
