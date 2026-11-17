import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import { parseEditorDocument } from "./editor.ts"
import type { IMessageDraft } from "./imessage.ts"
import type { TeamsDraft } from "./teams.ts"
import type { WhatsAppDraft } from "./whatsapp.ts"

const body = z.unknown().transform(parseEditorDocument)

export const whatsAppDraftSchema: z.ZodType<WhatsAppDraft> = z.object({
	body,
	replyTo: z
		.object({
			id: z.string().min(1),
			sender: z.string().optional(),
			senderId: z.string().min(1),
			text: z.string(),
		})
		.optional(),
})

export const teamsDraftSchema: z.ZodType<TeamsDraft> = z.object({
	body,
	replyTo: z
		.object({ id: z.string().min(1), sender: z.string(), text: z.string() })
		.optional(),
})

export const iMessageDraftSchema: z.ZodType<IMessageDraft> = z.object({ body })

export type ChatDraftStore<Draft> = {
	read(chatId: string | number): Promise<Draft | null>
	save(chatId: string | number, draft: Draft): Promise<Draft>
	remove(chatId: string | number): Promise<void>
}

export function createChatDraftStore<Draft>(
	directory: string,
	source: string,
	schema: z.ZodType<Draft>,
): ChatDraftStore<Draft> {
	const chatIdSchema = z.union([z.string().min(1), z.number().int().positive()])
	const filename = (chatId: string | number) =>
		path.join(
			directory,
			source,
			`${encodeURIComponent(String(chatIdSchema.parse(chatId)))}.json`,
		)
	return {
		async read(chatId) {
			let content: string
			try {
				content = await readFile(filename(chatId), "utf8")
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
				throw error
			}
			return schema.parse(JSON.parse(content))
		},
		async remove(chatId) {
			await rm(filename(chatId), { force: true })
		},
		async save(chatId, draft) {
			const value = schema.parse(draft)
			const file = filename(chatId)
			await mkdir(path.dirname(file), { recursive: true })
			await writeFile(`${file}.tmp`, `${JSON.stringify(value)}\n`)
			await rename(`${file}.tmp`, file)
			return value
		},
	}
}
