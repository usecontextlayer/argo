import { Paperclip } from "lucide-react"
import { type ReactNode, useEffect, useRef } from "react"
import { Link } from "react-router"
import { getAccount } from "@/accounts"
import type { IMessageMessage } from "@/imessage"
import type { TeamsMessage } from "@/teams"
import type { WhatsAppMessage } from "@/whatsapp"
import { Document } from "./document"
import { Person, SourceIdentity, Timestamp } from "./primitives"
import { HtmlContent } from "./rich-text"
import "./chat-outline.css"

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
	children,
}: {
	messages: ChatMessage[]
	highlightedId?: string
	children?: ReactNode
}) {
	const highlightedMessage = useRef<HTMLElement>(null)
	useEffect(() => {
		if (highlightedId) highlightedMessage.current?.scrollIntoView({ block: "center" })
	}, [highlightedId])
	return (
		<div className="presentation-chat">
			{children}
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
						<span>{message.quote.text}</span>
					</>
				)
				return (
					<div key={message.id}>
						{newDay && <div className="chat-day">{day.format(message.createdAt)}</div>}
						<section
							ref={message.id === highlightedId ? highlightedMessage : undefined}
							className={`chat-turn ${message.mine ? "chat-turn-mine" : ""} ${continued ? "chat-turn-continued" : ""} ${message.id === highlightedId ? "chat-turn-highlighted" : ""}`}
							aria-label={`Message from ${message.sender}`}
						>
							{!continued && (
								<div className="chat-person">
									<Person name={message.sender} />
								</div>
							)}
							<div className="chat-bubble">
								{message.quote &&
									(message.quote.href ? (
										<Link
											className="chat-quote"
											to={message.quote.href}
										>
											{quote}
										</Link>
									) : (
										<blockquote className="chat-quote">{quote}</blockquote>
									))}
								{message.html ? (
									<HtmlContent html={message.html} />
								) : (
									<div className="chat-text">{message.text}</div>
								)}
								{message.mediaType && (
									<div className="chat-attachment">
										<Paperclip
											size={14}
											aria-hidden="true"
										/>
										{message.mediaType}
									</div>
								)}
								{message.attachments?.map((attachment) => (
									<div
										className="chat-attachment"
										key={attachment.id}
									>
										<Paperclip
											size={14}
											aria-hidden="true"
										/>
										{attachment.name}
									</div>
								))}
								<div className="chat-time">
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
			{messages.length === 0 && <p className="empty-list">No messages on this page.</p>}
		</div>
	)
}

export function WhatsAppConversation({
	messages,
	quoteHref,
	highlightedId,
}: {
	messages: WhatsAppMessage[]
	quoteHref?: (id: string) => string
	highlightedId?: string
}) {
	return (
		<Chat
			highlightedId={highlightedId}
			messages={messages.map((message) => {
				const quoted = messages.find((item) => item.id === message.quotedMessageId)
				return {
					createdAt: message.createdAt,
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

export function TeamsConversation({ messages }: { messages: TeamsMessage[] }) {
	return <Chat messages={messages} />
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
	title,
	service,
	messages,
	actions,
	children,
	quoteHref,
	highlightedId,
}: {
	title: string
	service: string
	messages: IMessageMessage[]
	actions?: ReactNode
	children?: ReactNode
	quoteHref?: (id: string) => string
	highlightedId?: string
}) {
	return (
		<Document
			title={title}
			meta={service}
			identity={
				<SourceIdentity
					provider="imessage"
					account="Personal"
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
		</Document>
	)
}

export function TeamsDocument({
	title,
	messages,
	actions,
	children,
}: {
	title: string
	messages: TeamsMessage[]
	actions?: ReactNode
	children?: ReactNode
}) {
	return (
		<Document
			title={title}
			identity={
				<SourceIdentity
					provider="teams"
					account={getAccount("codecreators").email}
				/>
			}
			actions={actions}
		>
			{children}
			<TeamsConversation messages={messages} />
		</Document>
	)
}
export function WhatsAppDocument({
	title,
	messages,
	actions,
	children,
	quoteHref,
	highlightedId,
}: {
	title: string
	messages: WhatsAppMessage[]
	actions?: ReactNode
	children?: ReactNode
	quoteHref?: (id: string) => string
	highlightedId?: string
}) {
	return (
		<Document
			title={title}
			identity={
				<SourceIdentity
					provider="whatsapp"
					account="Personal"
				/>
			}
			actions={actions}
		>
			{children}
			<WhatsAppConversation
				messages={messages}
				quoteHref={quoteHref}
				highlightedId={highlightedId}
			/>
		</Document>
	)
}
