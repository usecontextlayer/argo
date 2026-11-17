import { ChevronDown } from "lucide-react"
import { getAccount } from "@/accounts"
import { DraftComposer } from "@/components/draft-composer"
import { Button } from "@/components/ui/button"
import {
	formatMailAddress,
	formatMailAddresses,
	type MailDraft,
	type MailThread as MailThreadData,
	type ReplyMode,
} from "@/mail"
import { accountProvider } from "@/provider-identity"
import { useDraft } from "@/use-draft"
import { Document } from "./document"
import { SourceIdentity, Timestamp } from "./primitives"
import { EmailHtml } from "./rich-text"

export function MailThread({
	thread,
	account,
}: {
	thread: MailThreadData
	account: string
}) {
	const binding = useDraft<MailDraft>(["mail", account, thread.id], {
		discard: (draft) => window.mail.discardDraft(account, draft.id),
		empty: () => null,
		load: () => window.mail.draft(account, thread.id),
		save: (draft) => window.mail.saveDraft(account, draft),
		send: (draft) => window.mail.sendDraft(account, draft.id),
	})
	const selectedMessage = binding.draft?.replyToMessageId
	function reply(messageId: string, mode: ReplyMode) {
		void binding.session.open(() =>
			window.mail.createDraft(account, thread.id, messageId, mode),
		)
	}
	return (
		<Document
			title={thread.subject || "(No subject)"}
			identity={
				<SourceIdentity
					provider={accountProvider(account, "mail")}
					account={getAccount(account)}
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
						open={
							index === thread.messages.length - 1 ||
							Boolean(binding.draft && selectedMessage === message.id)
						}
					>
						<summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 py-5 text-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
							<ChevronDown
								className="size-4 shrink-0 -rotate-90 text-muted-foreground group-open/message:rotate-0"
								aria-hidden="true"
							/>
							<span className="font-semibold wrap-anywhere">
								{formatMailAddress(message.from)}
							</span>
							<span className="min-w-0 flex-1 truncate text-muted-foreground group-open/message:hidden">
								{message.text}
							</span>
							<span className="ml-auto shrink-0 text-xs text-muted-foreground">
								<Timestamp value={message.date} />
							</span>
						</summary>
						<div className="pb-8 @2xl/content:pl-7">
							<p className="mb-6 text-sm text-muted-foreground wrap-anywhere">
								To {formatMailAddresses(message.to)}
							</p>
							{message.html ? (
								<EmailHtml
									html={message.html}
									title={`Message from ${formatMailAddress(message.from)}`}
								/>
							) : (
								<div className="whitespace-pre-wrap text-sm leading-relaxed wrap-anywhere">
									{message.text}
								</div>
							)}
							<div className="mt-6 flex gap-2">
								<Button
									variant="outline"
									size="sm"
									disabled={!binding.loaded || binding.activity !== "idle"}
									onClick={() => reply(message.id, "reply")}
								>
									Reply
								</Button>
								<Button
									variant="outline"
									size="sm"
									disabled={!binding.loaded || binding.activity !== "idle"}
									onClick={() => reply(message.id, "reply-all")}
								>
									Reply all
								</Button>
							</div>
						</div>
					</details>
				))}
				{binding.activity === "opening" && (
					<p
						role="status"
						className="py-4 text-sm text-muted-foreground"
					>
						Opening reply…
					</p>
				)}
				<DraftComposer
					binding={binding}
					sendOnEnter={false}
				>
					{binding.draft && (
						<div className="space-y-1 text-sm text-muted-foreground">
							<p>To {formatMailAddresses(binding.draft.to)}</p>
							{binding.draft.cc.length > 0 && (
								<p>Cc {formatMailAddresses(binding.draft.cc)}</p>
							)}
							{binding.draft.bcc.length > 0 && (
								<p>Bcc {formatMailAddresses(binding.draft.bcc)}</p>
							)}
						</div>
					)}
				</DraftComposer>
			</div>
		</Document>
	)
}
