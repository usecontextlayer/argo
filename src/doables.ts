import { z } from "zod"

const account = z.enum(["feerasta", "eightzerothree", "gmail", "codecreators", "alnu"])
const label = z.string().min(1)
export const sourceReferenceSchema = z.discriminatedUnion("source", [
	z.object({ account, label, source: z.literal("mail"), threadId: z.string().min(1) }),
	z.object({
		account,
		eventId: z.string().min(1),
		label,
		month: z.string().regex(/^\d{4}-\d{2}$/),
		source: z.literal("calendar"),
	}),
	z.object({ chatId: z.string().min(1), label, source: z.literal("teams") }),
	z.object({
		chatId: z.string().min(1),
		label,
		messageId: z.string().min(1).optional(),
		source: z.literal("whatsapp"),
	}),
	z.object({
		chatId: z.number().int().positive(),
		label,
		messageId: z.string().min(1).optional(),
		source: z.literal("imessage"),
	}),
	z.object({ label, nodeId: z.string().min(1), source: z.literal("workflowy") }),
	z.object({ label, meetingId: z.string().min(1), source: z.literal("granola") }),
])

export const doableSchema = z.object({
	context: z.array(sourceReferenceSchema).min(1),
	description: z.string().min(1),
	id: z.string().min(1),
	rationale: z.string().min(1),
	status: z.enum(["open", "done", "rejected"]),
	title: z.string().min(1),
})
export type Doable = z.infer<typeof doableSchema>
export type SourceReference = z.infer<typeof sourceReferenceSchema>

export function sourceHref(reference: SourceReference): string {
	switch (reference.source) {
		case "mail":
			return `/mail/${encodeURIComponent(reference.threadId)}?${new URLSearchParams({ account: reference.account })}`
		case "calendar":
			return `/calendar?${new URLSearchParams({ account: reference.account, event: reference.eventId, month: reference.month })}`
		case "teams":
			return `/teams?${new URLSearchParams({ account: "codecreators", chat: reference.chatId })}`
		case "whatsapp":
			return `/whatsapp?${new URLSearchParams({ chat: reference.chatId, ...(reference.messageId ? { quote: reference.messageId } : {}) })}`
		case "imessage":
			return `/imessage?${new URLSearchParams({ chat: String(reference.chatId), ...(reference.messageId ? { message: reference.messageId } : {}) })}`
		case "workflowy":
			return `/workflowy?${new URLSearchParams({ node: reference.nodeId })}`
		case "granola":
			return `/granola?${new URLSearchParams({ meeting: reference.meetingId })}`
	}
}

export type DoablesApi = { list(): Promise<Doable[]> }
declare global {
	interface Window {
		doables: DoablesApi
	}
}
