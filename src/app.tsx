import { useEffect } from "react"
import {
	createHashRouter,
	Outlet,
	RouterProvider,
	redirect,
	useLocation,
	useRevalidator,
} from "react-router"
import { AppNavigation } from "@/app-navigation"
import {
	CalendarError,
	CalendarView,
	calendarLoader,
	LoadingCalendar,
} from "@/calendar-view"
import { ClaudeTerminal } from "@/claude-view"
import { DoablesError, DoablesView, doablesLoader, LoadingDoables } from "@/doables-view"
import { GranolaError, GranolaView, granolaLoader, LoadingGranola } from "@/granola-view"
import {
	IMessageError,
	IMessageView,
	imessageLoader,
	LoadingIMessage,
} from "@/imessage-view"
import {
	EmptyMail,
	LoadingMail,
	MailError,
	MailThreadView,
	MailView,
	mailLoader,
	mailThreadLoader,
} from "@/mail-view"
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

function AppShell() {
	const { pathname } = useLocation()
	const revalidator = useRevalidator()
	useEffect(() => {
		if (pathname === "/doables")
			return window.doables.onChange(() => revalidator.revalidate())
	}, [pathname, revalidator.revalidate])
	return (
		<div className="flex h-dvh overflow-hidden">
			<AppNavigation />
			<div className="@container/content flex min-h-0 min-w-0 flex-1">
				<ClaudeTerminal active={pathname === "/claude"} />
				<Outlet />
			</div>
		</div>
	)
}

const router = createHashRouter([
	{
		Component: AppShell,
		children: [
			{ element: null, path: "claude" },
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
			{ index: true, loader: () => redirect("/mail") },
			{
				Component: TeamsView,
				ErrorBoundary: TeamsError,
				HydrateFallback: LoadingTeams,
				loader: teamsLoader,
				path: "teams",
			},
			{
				Component: MailView,
				children: [
					{ Component: EmptyMail, index: true },
					{
						Component: MailThreadView,
						loader: mailThreadLoader,
						path: ":threadId",
					},
				],
				ErrorBoundary: MailError,
				HydrateFallback: LoadingMail,
				loader: mailLoader,
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
