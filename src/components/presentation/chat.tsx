import { Paperclip, Reply } from "lucide-react"
import { type ReactNode, useEffect, useRef } from "react"
import { Link } from "react-router"
import { sourceAccounts } from "@/accounts"
import {
	IMessageReply,
	TeamsReply,
	useTeamsReply,
	useWhatsAppReply,
	WhatsAppReply,
} from "@/components/chat-replies"
import { Button } from "@/components/ui/button"
import { whatsAppToHtml } from "@/editor"
import type { IMessageChat, IMessageMessage } from "@/imessage"
import { cn } from "@/lib/utils"
import type { TeamsChat, TeamsMessage } from "@/teams"
import type { WhatsAppChat, WhatsAppMessage } from "@/whatsapp"
import { Document } from "./document"
import { Person, SourceIdentity, Timestamp } from "./primitives"
import { SanitizedHtml } from "./rich-text"

export type ChatMessage = {
	id: string
	sender: string
	createdAt: number
	text: string
	html?: string
	mine?: boolean
	quote?: { sender?: string; text: string; href?: string }
	attachments?: { id: string; name: string }[]
	mediaType?: string | null
}

const day = new Intl.DateTimeFormat(undefined, { dateStyle: "full" })

export function Chat({
	messages,
	highlightedId,
	onReply,
}: {
	messages: ChatMessage[]
	highlightedId?: string
	onReply?: (id: string) => void
}) {
	const highlightedMessage = useRef<HTMLElement>(null)
	useEffect(() => {
		if (highlightedId) highlightedMessage.current?.scrollIntoView({ block: "center" })
	}, [highlightedId])
	return (
		<div className="grid gap-4 py-4">
			{messages.map((message, index) => {
				const previous = messages[index - 1]
				const newDay =
					!previous ||
					new Date(previous.createdAt).toDateString() !==
						new Date(message.createdAt).toDateString()
				const continued =
					previous &&
					!newDay &&
					previous.sender === message.sender &&
					message.createdAt - previous.createdAt < 300_000
				const quote = message.quote && (
					<>
						<strong>{message.quote.sender}</strong>
						<span className="whitespace-pre-wrap wrap-anywhere">
							{message.quote.text}
						</span>
					</>
				)
				return (
					<div key={message.id}>
						{newDay && (
							<div className="my-6 text-center text-xs text-muted-foreground">
								{day.format(message.createdAt)}
							</div>
						)}
						<section
							ref={message.id === highlightedId ? highlightedMessage : undefined}
							className={cn(
								"grid gap-2",
								message.mine ? "justify-items-end" : "justify-items-start",
								continued ? "mt-1" : "mt-6",
							)}
							aria-label={`Message from ${message.sender}`}
						>
							{!continued && (
								<div className="text-sm">
									<Person name={message.sender} />
								</div>
							)}
							<div
								className={cn(
									"min-w-24 max-w-4/5 rounded-lg bg-muted px-4 py-3",
									message.id === highlightedId &&
										"ring-2 ring-ring ring-offset-2 ring-offset-background",
								)}
							>
								{message.quote &&
									(message.quote.href ? (
										<Link
											className="mb-3 grid gap-1 border-l py-1 pl-3 text-sm text-muted-foreground"
											to={message.quote.href}
										>
											{quote}
										</Link>
									) : (
										<blockquote className="mb-3 grid gap-1 border-l py-1 pl-3 text-sm text-muted-foreground">
											{quote}
										</blockquote>
									))}
								{message.html ? (
									<SanitizedHtml html={message.html} />
								) : (
									<div className="whitespace-pre-wrap text-sm leading-relaxed wrap-anywhere">
										{message.text}
									</div>
								)}
								{message.mediaType && (
									<div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
										<Paperclip
											className="size-3.5 shrink-0"
											aria-hidden="true"
										/>
										{message.mediaType}
									</div>
								)}
								{message.attachments?.map((attachment) => (
									<div
										className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"
										key={attachment.id}
									>
										<Paperclip
											className="size-3.5 shrink-0"
											aria-hidden="true"
										/>
										{attachment.name}
									</div>
								))}
								<div className="mt-2 flex items-center justify-end gap-3 text-xs text-muted-foreground">
									{onReply && (
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={`Reply to ${message.sender}`}
											onClick={() => onReply(message.id)}
										>
											<Reply aria-hidden="true" />
										</Button>
									)}
									<Timestamp
										value={message.createdAt}
										format="time"
									/>
								</div>
							</div>
						</section>
					</div>
				)
			})}
			{messages.length === 0 && (
				<p className="my-5 text-sm text-muted-foreground">No messages on this page.</p>
			)}
		</div>
	)
}

export function WhatsAppConversation({
	messages,
	quoteHref,
	highlightedId,
	onReply,
}: {
	messages: WhatsAppMessage[]
	quoteHref?: (id: string) => string
	highlightedId?: string
	onReply?: (id: string) => void
}) {
	return (
		<Chat
			onReply={onReply}
			highlightedId={highlightedId}
			messages={messages.map((message) => {
				const quoted = messages.find((item) => item.id === message.quotedMessageId)
				return {
					createdAt: message.createdAt,
					html: message.text ? whatsAppToHtml(message.text) : undefined,
					id: message.id,
					mediaType: message.mediaType,
					mine: message.isFromMe,
					quote: message.quotedMessageId
						? {
								href: quoteHref?.(message.quotedMessageId),
								sender: quoted?.sender,
								text: quoted?.text || quoted?.mediaType || "Quoted message",
							}
						: undefined,
					sender: message.isFromMe ? "You" : message.sender,
					text: message.text,
				}
			})}
		/>
	)
}

export function IMessageConversation({
	messages,
	quoteHref,
	highlightedId,
}: {
	messages: IMessageMessage[]
	quoteHref?: (id: string) => string
	highlightedId?: string
}) {
	return (
		<Chat
			highlightedId={highlightedId}
			messages={messages.map((message) => {
				const quoted = messages.find((item) => item.id === message.replyToGuid)
				return {
					attachments: message.attachments,
					createdAt: message.createdAt,
					id: message.id,
					mine: message.isFromMe,
					quote: message.replyToGuid
						? {
								href: quoteHref?.(message.replyToGuid),
								sender: quoted?.isFromMe ? "You" : quoted?.sender,
								text: quoted?.text || "Quoted message",
							}
						: undefined,
					sender: message.isFromMe ? "You" : message.sender,
					text: message.text,
				}
			})}
		/>
	)
}

export function IMessageDocument({
	chat,
	messages,
	actions,
	children,
	quoteHref,
	highlightedId,
}: {
	chat: IMessageChat
	messages: IMessageMessage[]
	actions?: ReactNode
	children?: ReactNode
	quoteHref?: (id: string) => string
	highlightedId?: string
}) {
	return (
		<Document
			title={chat.title}
			meta={chat.service}
			identity={
				<SourceIdentity
					provider="imessage"
					account={sourceAccounts.imessage}
				/>
			}
			actions={actions}
		>
			{children}
			<IMessageConversation
				messages={messages}
				quoteHref={quoteHref}
				highlightedId={highlightedId}
			/>
			<IMessageReply chatId={chat.id} />
		</Document>
	)
}

export function TeamsDocument({
	chat,
	messages,
	actions,
	children,
}: {
	chat: TeamsChat
	messages: TeamsMessage[]
	actions?: ReactNode
	children?: ReactNode
}) {
	const { binding, reply } = useTeamsReply(chat.id)
	return (
		<Document
			title={chat.title}
			identity={
				<SourceIdentity
					provider="teams"
					account={sourceAccounts.teams}
				/>
			}
			actions={actions}
		>
			{children}
			<Chat
				messages={messages}
				onReply={
					binding.loaded && binding.activity === "idle"
						? (id) => {
								const message = messages.find((item) => item.id === id)
								if (message) reply(message)
							}
						: undefined
				}
			/>
			<TeamsReply binding={binding} />
		</Document>
	)
}
export function WhatsAppDocument({
	chat,
	messages,
	actions,
	children,
	quoteHref,
	highlightedId,
}: {
	chat: WhatsAppChat
	messages: WhatsAppMessage[]
	actions?: ReactNode
	children?: ReactNode
	quoteHref?: (id: string) => string
	highlightedId?: string
}) {
	const { binding, reply } = useWhatsAppReply(chat.id)
	return (
		<Document
			title={chat.title}
			identity={
				<SourceIdentity
					provider="whatsapp"
					account={sourceAccounts.whatsapp}
				/>
			}
			actions={actions}
		>
			{children}
			<WhatsAppConversation
				onReply={
					binding.loaded && binding.activity === "idle"
						? (id) => {
								const message = messages.find((item) => item.id === id)
								if (message) reply(message)
							}
						: undefined
				}
				messages={messages}
				quoteHref={quoteHref}
				highlightedId={highlightedId}
			/>
			<WhatsAppReply binding={binding} />
		</Document>
	)
}
