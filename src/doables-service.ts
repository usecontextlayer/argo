import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { type Doable, doableSchema } from "./doables.ts"

export async function listDoables(directory: string): Promise<Doable[]> {
	const files = await readdir(directory)
	return Promise.all(
		files
			.filter((file) => file.endsWith(".json"))
			.sort()
			.map(async (file) => {
				const doable = doableSchema.parse(
					JSON.parse(await readFile(path.join(directory, file), "utf8")),
				)
				if (file !== `${doable.id}.json`)
					throw new Error(`Doable ID does not match filename: ${file}`)
				return doable
			}),
	)
}
