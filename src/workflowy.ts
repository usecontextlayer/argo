export type WorkflowyNode = {
	id: string
	text: string
	format: string
	depth: number
	children: number
}

export type WorkflowyPage = { nodes: WorkflowyNode[] }

export type WorkflowyApi = {
	read: (target: string, limit: number) => Promise<WorkflowyPage>
	refresh: () => Promise<void>
}

declare global {
	interface Window {
		workflowy: WorkflowyApi
	}
}

export function decodeWorkflowyNodes(result: string): WorkflowyNode[] {
	const lines = result.split("\n")
	const nodes: WorkflowyNode[] = []
	for (let index = 0; index < lines.length; index++) {
		const match = lines[index]?.match(/^\[([^\]]+)\](·*)(\S+) (".*")$/)
		if (!match) continue
		const counts = lines[index + 1]?.trim().match(/^(\d+):\d+:\d+/)
		nodes.push({
			children: counts ? Number(counts[1]) : 0,
			depth: match[2]?.length ?? 0,
			format: match[3] as string,
			id: match[1] === "None" ? "root" : (match[1] as string),
			text: JSON.parse(match[4] as string),
		})
	}
	return nodes
}
