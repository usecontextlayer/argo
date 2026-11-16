import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"

const executeFile = promisify(execFile)
type ToolResult<T> = { successful: boolean; error: string | null; data: T }
type FileResult = { storedInFile: true; outputFilePath: string }

export async function execute<T>(
	account: string,
	slug: string,
	args: Record<string, unknown>,
): Promise<T> {
	const { stdout } = await executeFile(
		"composio",
		["execute", slug, "--account", account, "-d", JSON.stringify(args)],
		{ maxBuffer: 16 * 1024 * 1024 },
	)
	const output = JSON.parse(stdout) as ToolResult<T> | FileResult
	const result: ToolResult<T> =
		"storedInFile" in output && output.storedInFile
			? JSON.parse(await readFile(output.outputFilePath, "utf8"))
			: (output as ToolResult<T>)
	if (!result.successful)
		throw new Error(result.error ?? "Composio could not read source data")
	return result.data
}

export function memoize<T>(
	cache: Map<string, Promise<T>>,
	key: string,
	read: () => Promise<T>,
): Promise<T> {
	const existing = cache.get(key)
	if (existing) return existing
	const result = read().catch((error) => {
		cache.delete(key)
		throw error
	})
	cache.set(key, result)
	return result
}
