import { z } from "zod"
import { sourceReferenceSchema } from "./source-reference.ts"

export const doableSchema = z.object({
	context: z.array(sourceReferenceSchema).min(1),
	description: z.string().min(1),
	id: z.string().min(1),
	rationale: z.string().min(1),
	status: z.enum(["open", "done", "rejected"]),
	title: z.string().min(1),
})
export type Doable = z.infer<typeof doableSchema>

export type DoablesApi = {
	list(): Promise<Doable[]>
	onChange(listener: () => void): () => void
}
declare global {
	interface Window {
		doables: DoablesApi
	}
}
