import { X } from "lucide-react"
import { singleConnectionAccounts } from "@/accounts"
import { DraftComposer } from "@/components/draft-composer"
import { Button } from "@/components/ui/button"
import { documentToText, emptyDocument, htmlToDocument } from "@/editor"
import type { IMessageDraft } from "@/imessage"
import type { TeamsDraft, TeamsMessage } from "@/teams"
import { useDraft } from "@/use-draft"
import type { WhatsAppDraft, WhatsAppMessage } from "@/whatsapp"

function QuotedReply({
	sender,
	text,
	onRemove,
	disabled,
}: {
	sender?: string
	text: string
	onRemove: () => void
	disabled: boolean
}) {
	return (
		<div className="flex items-start gap-3 rounded-md bg-muted p-3 text-sm">
			<div className="min-w-0 flex-1">
				<p className="font-medium">Replying to {sender ?? "message"}</p>
				<p className="line-clamp-3 whitespace-pre-wrap text-muted-foreground">{text}</p>
			</div>
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label="Remove quoted reply"
				disabled={disabled}
				onClick={onRemove}
			>
				<X aria-hidden="true" />
			</Button>
		</div>
	)
}

export function useWhatsAppReply(chatId: string) {
	const binding = useDraft<WhatsAppDraft>(
		["whatsapp", singleConnectionAccounts.whatsapp, chatId],
		{
			discard: () => window.whatsapp.discardDraft(chatId),
			empty: () => ({ body: emptyDocument() }),
			load: () => window.whatsapp.draft(chatId),
			save: (draft) => window.whatsapp.saveDraft(chatId, draft),
			send: () => window.whatsapp.sendDraft(chatId),
		},
	)
	return {
		binding,
		reply(message: WhatsAppMessage) {
			binding.session.update((draft) => ({
				...draft,
				replyTo: {
					id: message.id,
					sender: message.sender,
					senderId: message.senderId,
					text: message.text,
				},
			}))
		},
	}
}

export function WhatsAppReply({
	binding,
	sendOnEnter = true,
}: {
	binding: ReturnType<typeof useWhatsAppReply>["binding"]
	sendOnEnter?: boolean
}) {
	return (
		<DraftComposer
			binding={binding}
			sendOnEnter={sendOnEnter}
		>
			{binding.draft?.replyTo && (
				<QuotedReply
					{...binding.draft.replyTo}
					disabled={binding.activity !== "idle"}
					onRemove={() => binding.session.update((draft) => ({ body: draft.body }))}
				/>
			)}
		</DraftComposer>
	)
}

export function useTeamsReply(chatId: string) {
	const binding = useDraft<TeamsDraft>(
		["teams", singleConnectionAccounts.teams, chatId],
		{
			discard: () => window.teams.discardDraft(chatId),
			empty: () => ({ body: emptyDocument() }),
			load: () => window.teams.draft(chatId),
			save: (draft) => window.teams.saveDraft(chatId, draft),
			send: () => window.teams.sendDraft(chatId),
		},
	)
	return {
		binding,
		reply(message: TeamsMessage) {
			binding.session.update((draft) => ({
				...draft,
				replyTo: {
					id: message.id,
					sender: message.sender,
					text: message.text || documentToText(htmlToDocument(message.html)),
				},
			}))
		},
	}
}

export function TeamsReply({
	binding,
	sendOnEnter = true,
}: {
	binding: ReturnType<typeof useTeamsReply>["binding"]
	sendOnEnter?: boolean
}) {
	return (
		<DraftComposer
			binding={binding}
			sendOnEnter={sendOnEnter}
		>
			{binding.draft?.replyTo && (
				<QuotedReply
					{...binding.draft.replyTo}
					disabled={binding.activity !== "idle"}
					onRemove={() => binding.session.update((draft) => ({ body: draft.body }))}
				/>
			)}
		</DraftComposer>
	)
}

export function IMessageReply({
	chatId,
	sendOnEnter = true,
}: {
	chatId: number
	sendOnEnter?: boolean
}) {
	const binding = useDraft<IMessageDraft>(
		["imessage", singleConnectionAccounts.imessage, chatId],
		{
			discard: () => window.imessage.discardDraft(chatId),
			empty: () => ({ body: emptyDocument() }),
			load: () => window.imessage.draft(chatId),
			save: (draft) => window.imessage.saveDraft(chatId, draft),
			send: () => window.imessage.sendDraft(chatId),
		},
	)
	return (
		<DraftComposer
			binding={binding}
			sendOnEnter={sendOnEnter}
		/>
	)
}
