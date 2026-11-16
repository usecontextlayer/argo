import { execute, memoize } from "@/composio"
import type { GranolaTranscript } from "@/granola"

const account = "granola_mcp_alit-refly"
const lists = new Map<string, Promise<string>>()
const meetings = new Map<string, Promise<string>>()
const transcripts = new Map<string, Promise<GranolaTranscript>>()

export function listGranolaMeetings(month: string): Promise<string> {
	return memoize(lists, month, async () => {
		const [year, number] = month.split("-").map(Number) as [number, number]
		const end = new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10)
		const result = await execute<{ data: string }>(account, "GRANOLA_MCP_LIST_MEETINGS", {
			custom_end: end,
			custom_start: `${month}-01`,
			time_range: "custom",
		})
		return result.data
	})
}

export function readGranolaMeeting(id: string): Promise<string> {
	return memoize(meetings, id, async () => {
		const result = await execute<{ data: string }>(account, "GRANOLA_MCP_GET_MEETINGS", {
			meeting_ids: [id],
		})
		return result.data
	})
}

export function readGranolaTranscript(id: string): Promise<GranolaTranscript> {
	return memoize(transcripts, id, () =>
		execute<GranolaTranscript>(account, "GRANOLA_MCP_GET_MEETING_TRANSCRIPT", {
			meeting_id: id,
		}),
	)
}

export function refreshGranola() {
	lists.clear()
	meetings.clear()
	transcripts.clear()
}
