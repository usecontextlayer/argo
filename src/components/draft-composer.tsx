import { type ReactNode, useRef } from "react"
import { useRevalidator } from "react-router"
import { ReplyEditor } from "@/components/reply-editor"
import { Button } from "@/components/ui/button"
import { documentToText, type EditorDocument } from "@/editor"
import type { DraftBinding } from "@/use-draft"

export function DraftComposer<Draft extends { body: EditorDocument }>({
	binding,
	sendOnEnter,
	children,
}: {
	binding: DraftBinding<Draft>
	sendOnEnter: boolean
	children?: ReactNode
}) {
	const revalidator = useRevalidator()
	const composer = useRef<HTMLElement>(null)
	const { draft, session, activity, saving, loaded, error, identity, editorKey } = binding
	if (!loaded)
		return (
			<div
				className="py-4 text-sm text-muted-foreground"
				role={error ? "alert" : "status"}
			>
				{error ?? "Opening draft…"}
				{error && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => void session.load()}
					>
						Try again
					</Button>
				)}
			</div>
		)
	if (!draft) return error ? <p role="alert">{error}</p> : null
	const busy = activity !== "idle"
	const canSend = !busy && documentToText(draft.body).trim().length > 0
	async function send() {
		if (canSend && (await session.send())) {
			requestAnimationFrame(() => {
				composer.current?.querySelector<HTMLElement>('[contenteditable="true"]')?.focus()
			})
			await revalidator.revalidate()
		}
	}
	return (
		<section
			ref={composer}
			className="my-6 space-y-3"
			aria-label="Reply composer"
		>
			{children}
			<ReplyEditor
				key={`${identity}:${editorKey}`}
				content={draft.body}
				disabled={busy}
				onChange={(body) => session.update((current) => ({ ...current, body }))}
				onSend={() => void send()}
				sendOnEnter={sendOnEnter}
			/>
			<div className="flex flex-wrap items-center gap-3">
				<Button
					disabled={!canSend}
					onClick={() => void send()}
				>
					{activity === "sending" ? "Sending…" : "Send"}
				</Button>
				<Button
					disabled={busy}
					variant="ghost"
					onClick={() => void session.discard()}
				>
					Discard
				</Button>
				<span
					className="ml-auto text-xs text-muted-foreground"
					role="status"
				>
					{saving
						? "Saving…"
						: binding.dirty
							? "Unsaved changes"
							: documentToText(draft.body).trim()
								? "Draft saved"
								: ""}
				</span>
				<span className="text-xs text-muted-foreground">
					{sendOnEnter ? "Enter to send · Shift+Enter for a new line" : "⌘Enter to send"}
				</span>
			</div>
			{error && (
				<p
					className="text-sm text-destructive"
					role="alert"
				>
					{error}
				</p>
			)}
		</section>
	)
}
