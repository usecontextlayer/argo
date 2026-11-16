import { ChevronDown } from "lucide-react"
import { type ReactNode, useState } from "react"
import { accounts } from "@/accounts"
import { type Provider, providers } from "@/provider-identity"
import "./presentation.css"

export function ProviderIcon({
	provider,
	size = 18,
}: {
	provider: Provider
	size?: number
}) {
	return (
		<img
			className="presentation-provider"
			src={providers[provider].icon}
			alt={providers[provider].name}
			width={size}
			height={size}
		/>
	)
}

export function AccountIdentity({ account }: { account: string }) {
	const known = accounts.find((item) => item.email === account || item.id === account)
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
			className="presentation-account"
			title={known?.email ?? account}
		>
			<span
				className="presentation-account-mark"
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
		<span className="presentation-identity">
			<ProviderIcon provider={provider} />
			<span>{providers[provider].name}</span>
			{account && (
				<>
					<span
						className="presentation-separator"
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
		<span className="presentation-person">
			<span
				className="presentation-avatar"
				aria-hidden="true"
			>
				{name.trim().slice(0, 1).toUpperCase()}
			</span>
			<span>
				<strong>{name}</strong>
				{children && <small>{children}</small>}
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
			className="presentation-timestamp"
			dateTime={date.toISOString()}
			title={dateFormats.full.format(date)}
		>
			{dateFormats[format].format(date)}
		</time>
	)
}

export function Metadata({ children }: { children: ReactNode }) {
	return <div className="presentation-metadata">{children}</div>
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
		<span className="presentation-preview">
			{identity && <span className="presentation-preview-identity">{identity}</span>}
			<span className="presentation-preview-heading">
				<strong>{title}</strong>
				{meta && <span className="presentation-preview-meta">{meta}</span>}
			</span>
			{children && <span className="presentation-preview-content">{children}</span>}
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
			className="presentation-disclosure"
			open={open}
			onToggle={(event) => setOpen(event.currentTarget.open)}
		>
			<summary>
				<ChevronDown
					className="presentation-chevron"
					size={16}
				/>
				<span className="presentation-disclosure-heading">
					{identity}
					{title}
				</span>
				{actions && <span className="presentation-disclosure-actions">{actions}</span>}
			</summary>
			{open && <div className="presentation-disclosure-body">{children}</div>}
		</details>
	)
}
