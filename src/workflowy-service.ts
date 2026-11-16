import { z } from "zod"
import { memoize } from "@/composio"
import type { McpConnections } from "@/mcp"
import { readWorkflowyNodes, type WorkflowyPage } from "@/workflowy"

const pages = new Map<string, Promise<WorkflowyPage>>()
const resultSchema = z.object({ results: z.array(z.string()) })

export function createWorkflowyService(connections: McpConnections) {
	return {
		read(target: string, limit: number): Promise<WorkflowyPage> {
			return memoize(pages, JSON.stringify([target, limit]), async () => {
				const client = await connections.client("workflowy")
				const result = await client.callTool({
					arguments: {
						seek_requests: [
							{
								direction: "downward-deep",
								limit,
								max_match_edge_distance_from_start: 1,
								start_from: target,
								truncate_text_at: 10000,
							},
						],
						wait_any_match: false,
					},
					name: "tree_seek",
				})
				if (result.isError) throw new Error(JSON.stringify(result.content))
				const structured = resultSchema.parse(result.structuredContent)
				return { nodes: structured.results.flatMap(readWorkflowyNodes) }
			})
		},
		refresh() {
			pages.clear()
		},
	}
}
