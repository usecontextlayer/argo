import { ChevronDown } from "lucide-react"
import { getAccount } from "@/accounts"
import type { MailThread as MailThreadData } from "@/mail"
import { Document } from "./document"
import { SourceIdentity, Timestamp } from "./primitives"
import { SafeHtml } from "./rich-text"
import "./documents.css"

export function MailThread({
	thread,
	account,
}: {
	thread: MailThreadData
	account: string
}) {
	const identity = getAccount(account)
	return (
		<Document
			title={thread.subject || "(No subject)"}
			identity={
				<SourceIdentity
					provider={identity.provider === "google" ? "gmail" : "outlook"}
					account={identity.email}
				/>
			}
			meta={
				<>
					{thread.messages.length} {thread.messages.length === 1 ? "message" : "messages"}{" "}
					·{" "}
					<Timestamp
						value={thread.date}
						format="date"
					/>
				</>
			}
		>
			<div className="correspondence">
				{thread.messages.map((message, index) => (
					<details
						className="correspondence-message"
						key={message.id}
						open={index === thread.messages.length - 1}
					>
						<summary className="correspondence-summary">
							<ChevronDown
								size={16}
								aria-hidden="true"
							/>
							<span className="correspondence-sender">{message.from}</span>
							<span className="correspondence-excerpt">{message.text}</span>
							<Timestamp value={message.date} />
						</summary>
						<div className="correspondence-content">
							<p className="correspondence-recipients">To {message.to}</p>
							{message.html ? (
								<SafeHtml
									html={message.html}
									title={`Message from ${message.from}`}
								/>
							) : (
								<div className="document-plain-text">{message.text}</div>
							)}
						</div>
					</details>
				))}
			</div>
		</Document>
	)
}
