import { ChevronDown } from "lucide-react"
import type { MailThread as MailThreadData } from "@/mail"
import { accountProvider } from "@/provider-identity"
import { Document } from "./document"
import { SourceIdentity, Timestamp } from "./primitives"
import { SafeHtml } from "./rich-text"

export function MailThread({
	thread,
	account,
}: {
	thread: MailThreadData
	account: string
}) {
	return (
		<Document
			title={thread.subject || "(No subject)"}
			identity={
				<SourceIdentity
					provider={accountProvider(account, "mail")}
					account={account}
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
			<div>
				{thread.messages.map((message, index) => (
					<details
						className="group/message border-t"
						key={message.id}
						open={index === thread.messages.length - 1}
					>
						<summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 py-5 text-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
							<ChevronDown
								className="size-4 shrink-0 -rotate-90 text-muted-foreground group-open/message:rotate-0"
								aria-hidden="true"
							/>
							<span className="font-semibold wrap-anywhere">{message.from}</span>
							<span className="min-w-0 flex-1 truncate text-muted-foreground group-open/message:hidden">
								{message.text}
							</span>
							<span className="ml-auto shrink-0 text-xs text-muted-foreground">
								<Timestamp value={message.date} />
							</span>
						</summary>
						<div className="pb-8 @2xl/content:pl-7">
							<p className="mb-6 text-sm text-muted-foreground wrap-anywhere">
								To {message.to}
							</p>
							{message.html ? (
								<SafeHtml
									html={message.html}
									title={`Message from ${message.from}`}
								/>
							) : (
								<div className="whitespace-pre-wrap text-sm leading-relaxed wrap-anywhere">
									{message.text}
								</div>
							)}
						</div>
					</details>
				))}
			</div>
		</Document>
	)
}
