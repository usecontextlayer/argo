import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"
import { type GmailPart, type GmailThread, readGmailThread } from "@/gmail"
import type { MailPage, MailThread } from "@/mail"

const executeFile = promisify(execFile)
const pages = new Map<string, Promise<MailPage>>()
const threads = new Map<string, Promise<MailThread>>()
type ToolResult<T> = { successful: boolean; error: string | null; data: T }
type FileResult = { storedInFile: true; outputFilePath: string }

async function execute<T>(slug: string, args: Record<string, unknown>): Promise<T> {
	const { stdout } = await executeFile(
		"composio",
		["execute", slug, "--account", "gmail_yurt-giber", "-d", JSON.stringify(args)],
		{ maxBuffer: 16 * 1024 * 1024 },
	)
	const output = JSON.parse(stdout) as ToolResult<T> | FileResult
	const result: ToolResult<T> =
		"storedInFile" in output && output.storedInFile
			? JSON.parse(await readFile(output.outputFilePath, "utf8"))
			: (output as ToolResult<T>)
	if (!result.successful) throw new Error(result.error ?? "Composio could not read email")
	return result.data
}

async function fetchMailPage(pageToken?: string): Promise<MailPage> {
	const result = await execute<{ threads: GmailThread[]; nextPageToken?: string }>(
		"GMAIL_LIST_THREADS",
		{ max_results: 20, verbose: true, ...(pageToken ? { page_token: pageToken } : {}) },
	)
	const page = {
		nextPageToken: result.nextPageToken,
		threads: result.threads.map(readGmailThread),
	}
	for (const thread of page.threads) threads.set(thread.id, Promise.resolve(thread))
	return page
}

async function fetchMailThread(id: string): Promise<MailThread> {
	const thread = await execute<{
		threadId: string
		messages: {
			messageId: string
			messageTimestamp: string
			labelIds: string[]
			messageText: string
			payload: GmailPart
		}[]
	}>("GMAIL_FETCH_MESSAGE_BY_THREAD_ID", { thread_id: id })
	return readGmailThread({
		id: thread.threadId,
		messages: thread.messages.map((message) => ({
			id: message.messageId,
			internalDate: String(new Date(message.messageTimestamp).getTime()),
			labelIds: message.labelIds,
			payload: message.payload,
			snippet: message.messageText,
		})),
	})
}

function memoize<T>(
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

export function listMail(pageToken?: string): Promise<MailPage> {
	return memoize(pages, pageToken ?? "", () => fetchMailPage(pageToken))
}

export function readMailThread(id: string): Promise<MailThread> {
	return memoize(threads, id, () => fetchMailThread(id))
}

export function refreshMail() {
	pages.clear()
	threads.clear()
}
