import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"

const executeFile = promisify(execFile)
type ToolResult<T> = { successful: boolean; error: string | null; data: T }
type FileResult = { storedInFile: true; outputFilePath: string }

async function run(args: string[]): Promise<unknown> {
	const pending = executeFile("composio", args, { maxBuffer: 16 * 1024 * 1024 })
	pending.child.stdin?.end()
	const { stdout } = await pending
	if (!stdout.trim()) return undefined
	const output = JSON.parse(stdout) as FileResult
	return output?.storedInFile
		? JSON.parse(await readFile(output.outputFilePath, "utf8"))
		: output
}

export async function execute<T>(
	account: string,
	slug: string,
	args: Record<string, unknown>,
): Promise<T> {
	const result = (await run([
		"execute",
		slug,
		"--account",
		account,
		"-d",
		JSON.stringify(args),
	])) as ToolResult<T>
	if (!result.successful)
		throw new Error(result.error ?? "Composio could not read source data")
	return result.data
}

export async function proxy<T>(
	account: string,
	toolkit: string,
	url: string,
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
	data?: unknown,
): Promise<T> {
	return (await run([
		"proxy",
		url,
		"--toolkit",
		toolkit,
		"--account",
		account,
		"--method",
		method,
		...(data === undefined
			? []
			: ["--header", "Content-Type: application/json", "--data", JSON.stringify(data)]),
	])) as T
}
