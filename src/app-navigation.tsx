import type { ReactNode } from "react"
import { Link, NavLink, useRouteLoaderData, useSearchParams } from "react-router"
import { accounts, getAccount, singleConnectionAccounts } from "@/accounts"
import type { calendarLoader } from "@/calendar-view"
import { AccountIdentity, ProviderIcon } from "@/components/presentation/primitives"
import { type Provider, providers } from "@/provider-identity"

const googleAccounts = accounts.filter((account) => account.provider === "google")
const microsoftAccounts = accounts.filter((account) => account.provider === "microsoft")

const groups: {
	provider: Provider
	label?: string
	pathname: string
	accounts: readonly (string | (typeof accounts)[number])[]
}[] = [
	{
		accounts: googleAccounts,
		pathname: "/mail",
		provider: "gmail",
	},
	{
		accounts: googleAccounts,
		pathname: "/calendar",
		provider: "google-calendar",
	},
	{
		accounts: microsoftAccounts,
		label: "Outlook Mail",
		pathname: "/mail",
		provider: "outlook",
	},
	{
		accounts: microsoftAccounts,
		label: "Outlook Calendar",
		pathname: "/calendar",
		provider: "outlook",
	},
	{
		accounts: [getAccount(singleConnectionAccounts.teams)],
		pathname: "/teams",
		provider: "teams",
	},
	{
		accounts: [singleConnectionAccounts.granola],
		pathname: "/granola",
		provider: "granola",
	},
	{
		accounts: [singleConnectionAccounts.whatsapp],
		pathname: "/whatsapp",
		provider: "whatsapp",
	},
	{
		accounts: [singleConnectionAccounts.imessage],
		pathname: "/imessage",
		provider: "imessage",
	},
	{
		accounts: [singleConnectionAccounts.workflowy],
		pathname: "/workflowy",
		provider: "workflowy",
	},
]

function NavigationLink({
	pathname,
	account,
	children,
}: {
	pathname: string
	account?: string
	children: ReactNode
}) {
	const [params] = useSearchParams()
	const calendar = useRouteLoaderData<typeof calendarLoader>("calendar")
	const search = new URLSearchParams()
	if (account) search.set("account", account)
	if (pathname === "/calendar" && calendar) {
		search.set("date", calendar.day)
		search.set("view", calendar.view)
	}
	const matchesAccount = !account || account === (params.get("account") ?? "feerasta")
	return (
		<NavLink
			to={{ pathname, search: search.toString() }}
			aria-current={matchesAccount ? "page" : false}
			className={({ isActive }) =>
				`flex min-h-9 items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive && matchesAccount ? "bg-accent font-medium" : ""}`
			}
		>
			{children}
		</NavLink>
	)
}

export function AppNavigation() {
	const [params] = useSearchParams()
	return (
		<aside className="flex min-h-0 w-56 shrink-0 flex-col border-r bg-muted/30">
			<Link
				to={`/mail?account=${params.get("account") ?? "feerasta"}`}
				className="shrink-0 px-6 py-5 font-logo text-4xl leading-none"
			>
				argo
			</Link>
			<nav
				className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 pb-6"
				aria-label="Main navigation"
			>
				<div className="border-b pb-4">
					<NavigationLink pathname="/doables">Doables</NavigationLink>
				</div>
				{groups.map(
					({ provider, label = providers[provider].name, pathname, accounts }) => (
						<section
							aria-label={label}
							key={label}
						>
							<h2 className="mb-2 flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
								<span aria-hidden="true">
									<ProviderIcon
										provider={provider}
										size={16}
									/>
								</span>
								{label}
							</h2>
							{accounts.map((account) => {
								const identity = typeof account === "string" ? account : account.id
								return (
									<NavigationLink
										key={identity}
										pathname={pathname}
										account={typeof account === "string" ? undefined : account.id}
									>
										<AccountIdentity account={identity} />
									</NavigationLink>
								)
							})}
						</section>
					),
				)}
			</nav>
		</aside>
	)
}
