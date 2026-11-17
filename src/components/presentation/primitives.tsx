import { ChevronDown } from "lucide-react"
import { type ReactNode, useState } from "react"
import { accounts } from "@/accounts"
import { type Provider, providers } from "@/provider-identity"

export function ProviderIcon({
	provider,
	size = 16,
	decorative = false,
}: {
	provider: Provider
	size?: number
	decorative?: boolean
}) {
	return (
		<img
			className="inline-block shrink-0 object-contain align-middle"
			src={providers[provider].icon}
			alt={decorative ? "" : providers[provider].name}
			width={size}
			height={size}
		/>
	)
}

export function AccountIdentity({ account }: { account: string }) {
	const known = accounts.find((item) => item.id === account)
	const label = known?.label ?? account
	const initials =
		known?.initials ??
		label
			.split(/\s+/)
			.map((part) => part[0])
			.join("")
			.slice(0, 2)
			.toUpperCase()
	return (
		<span
			className="inline-flex min-w-0 items-center gap-1.5"
			title={known?.email ?? account}
		>
			<span
				className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-foreground"
				aria-hidden="true"
			>
				{initials}
			</span>
			<span>{label}</span>
		</span>
	)
}

export function SourceIdentity({
	provider,
	account,
}: {
	provider: Provider
	account?: string
}) {
	return (
		<span className="inline-flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
			<ProviderIcon
				provider={provider}
				decorative
			/>
			<span>{providers[provider].name}</span>
			{account && (
				<>
					<span
						className="text-muted-foreground"
						aria-hidden="true"
					>
						·
					</span>
					<AccountIdentity account={account} />
				</>
			)}
		</span>
	)
}

export function Person({ name, children }: { name: string; children?: ReactNode }) {
	return (
		<span className="inline-flex min-w-0 items-center gap-2">
			<span
				className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
				aria-hidden="true"
			>
				{name.trim().slice(0, 1).toUpperCase()}
			</span>
			<span className="min-w-0">
				<strong className="text-sm font-medium wrap-anywhere">{name}</strong>
				{children && (
					<small className="block text-xs text-muted-foreground">{children}</small>
				)}
			</span>
		</span>
	)
}

const dateFormats = {
	date: new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }),
	full: new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }),
	time: new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }),
}

export function Timestamp({
	value,
	format = "full",
}: {
	value: number | string
	format?: keyof typeof dateFormats
}) {
	const date = new Date(value)
	return (
		<time
			className="whitespace-nowrap tabular-nums"
			dateTime={date.toISOString()}
			title={dateFormats.full.format(date)}
		>
			{dateFormats[format].format(date)}
		</time>
	)
}

export function Metadata({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-wrap items-center gap-2 text-xs leading-relaxed text-muted-foreground">
			{children}
		</div>
	)
}

export function Preview({
	title,
	children,
	meta,
	identity,
}: {
	title: ReactNode
	children?: ReactNode
	meta?: ReactNode
	identity?: ReactNode
}) {
	return (
		<span className="flex w-full min-w-0 flex-1 flex-col gap-1.5">
			{identity && (
				<span className="truncate text-xs text-muted-foreground">{identity}</span>
			)}
			<span className="flex min-w-0 items-baseline justify-between gap-3">
				<strong className="min-w-0 text-sm font-medium">{title}</strong>
				{meta && <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>}
			</span>
			{children && (
				<span className="truncate text-xs text-muted-foreground">{children}</span>
			)}
		</span>
	)
}

export function Disclosure({
	title,
	children,
	defaultOpen = false,
	identity,
	actions,
}: {
	title: ReactNode
	children: ReactNode
	defaultOpen?: boolean
	identity?: ReactNode
	actions?: ReactNode
}) {
	const [open, setOpen] = useState(defaultOpen)
	return (
		<details
			className="border-b border-border first:border-t"
			open={open}
			onToggle={(event) => setOpen(event.currentTarget.open)}
		>
			<summary className="flex cursor-pointer list-none items-center gap-3 rounded-md py-4 outline-none hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
				<ChevronDown
					className={`size-4 shrink-0 text-muted-foreground ${open ? "" : "-rotate-90"}`}
					aria-hidden="true"
					size={16}
				/>
				<span className="flex min-w-0 flex-1 flex-col gap-2 text-sm font-medium">
					{identity}
					{title}
				</span>
				{actions && <span className="ml-auto shrink-0">{actions}</span>}
			</summary>
			{open && <div className="pb-6 @3xl/content:pl-7">{children}</div>}
		</details>
	)
}
