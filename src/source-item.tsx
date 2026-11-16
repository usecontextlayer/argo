import { ArrowUpRight } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useFetcher } from "react-router"
import { getAccount } from "@/accounts"
import { TeamsDocument, WhatsAppDocument } from "@/components/presentation/chat"
import { EventDetails } from "@/components/presentation/event-details"
import { MailThread } from "@/components/presentation/mail-thread"
import { MeetingNotes } from "@/components/presentation/meeting-notes"
import { WorkflowyDocument } from "@/components/presentation/outline"
import { Disclosure, SourceIdentity } from "@/components/presentation/primitives"
import { type SourceReference, sourceHref } from "@/doables"
import {
	accountProvider,
	type Provider,
	singleConnectionAccounts,
} from "@/provider-identity"
import {
	type SourceContent,
	type SourceItemResult,
	sourceItemHref,
} from "@/source-item-loader"

export function sourceProvider(reference: SourceReference): Provider {
	return "account" in reference
		? accountProvider(reference.account, reference.source)
		: reference.source
}

export function SourceReferenceIdentity({ reference }: { reference: SourceReference }) {
	const account =
		"account" in reference
			? getAccount(reference.account).email
			: singleConnectionAccounts[reference.source]
	return (
		<SourceIdentity
			provider={sourceProvider(reference)}
			account={account}
		/>
	)
}

export function SourceItem({ reference }: { reference: SourceReference }) {
	return (
		<Disclosure
			title={reference.label}
			identity={<SourceReferenceIdentity reference={reference} />}
			actions={
				<Link
					to={sourceHref(reference)}
					title="Open source"
					aria-label={`Open ${reference.label} in its source`}
				>
					<ArrowUpRight size={18} />
				</Link>
			}
		>
			<LoadedSourceItem reference={reference} />
		</Disclosure>
	)
}

function LoadedSourceItem({ reference }: { reference: SourceReference }) {
	const fetcher = useFetcher<SourceItemResult>()
	const [section, setSection] = useState<"summary" | "notes" | "transcript">("summary")
	const href = sourceItemHref(reference, section === "transcript")
	const { load } = fetcher
	useEffect(() => {
		void load(href)
	}, [href, load])
	if (!fetcher.data) return <p role="status">Opening source…</p>
	if ("error" in fetcher.data) return <p role="alert">{fetcher.data.error}</p>
	return (
		<SourceContentView
			content={fetcher.data.content}
			section={section}
			onSectionChange={setSection}
			loading={fetcher.state !== "idle"}
		/>
	)
}

function SourceContentView({
	content,
	section,
	onSectionChange,
	loading,
}: {
	content: SourceContent
	section: "summary" | "notes" | "transcript"
	onSectionChange: (section: "summary" | "notes" | "transcript") => void
	loading: boolean
}) {
	switch (content.source) {
		case "mail":
			return (
				<MailThread
					thread={content.thread}
					account={content.account}
				/>
			)
		case "calendar": {
			const event = content.page.events.find((event) => event.id === content.eventId)
			return event ? (
				<EventDetails
					event={event}
					account={content.account}
					timeZone={content.page.timeZone}
				/>
			) : (
				<p>The referenced event is no longer in this month.</p>
			)
		}
		case "granola":
			return (
				<div aria-busy={loading}>
					<MeetingNotes
						meeting={content.meeting}
						section={section}
						onSectionChange={onSectionChange}
						transcript={content.transcript}
					/>
				</div>
			)
		case "workflowy":
			return (
				<WorkflowyDocument
					nodes={content.page.nodes}
					target={content.nodeId}
					nodeHref={(id) => `/workflowy?${new URLSearchParams({ node: id })}`}
				/>
			)
		case "teams":
			return (
				<TeamsDocument
					title={content.title}
					messages={content.page.messages}
				/>
			)
		case "whatsapp":
			return (
				<WhatsAppDocument
					title={content.title}
					messages={content.messages}
					highlightedId={content.messageId}
					quoteHref={(id) =>
						`/whatsapp?${new URLSearchParams({ chat: content.chatId, quote: id })}`
					}
				/>
			)
	}
}
