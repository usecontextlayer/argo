import { readFile } from "node:fs/promises"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import {
	getDefaultEnvironment,
	StdioClientTransport,
} from "@modelcontextprotocol/client/stdio"
import { z } from "zod"

const serverSchema = z.union([
	z.object({
		headers: z.record(z.string(), z.string()).optional(),
		type: z.literal("http").optional(),
		url: z.url(),
	}),
	z.object({
		args: z.array(z.string()).optional(),
		command: z.string().min(1),
		env: z.record(z.string(), z.string()).optional(),
		type: z.literal("stdio").optional(),
	}),
])

export const mcpConfigSchema = z.object({
	mcpServers: z.record(z.string(), serverSchema),
})

export class McpConnections {
	private clients = new Map<string, Promise<Client>>()
	private configPath: string

	constructor(configPath: string) {
		this.configPath = configPath
	}

	async client(name: string): Promise<Client> {
		const existing = this.clients.get(name)
		if (existing) return existing
		const connecting = this.connect(name).catch((error) => {
			this.clients.delete(name)
			throw error
		})
		this.clients.set(name, connecting)
		return connecting
	}

	private async connect(name: string): Promise<Client> {
		const config = mcpConfigSchema.parse(
			JSON.parse(await readFile(this.configPath, "utf8")),
		)
		const server = config.mcpServers[name]
		if (!server) throw new Error(`Add the ${name} MCP server to ${this.configPath}`)
		const client = new Client({ name: "argo", version: "1.0.0" })
		const transport =
			"url" in server
				? new StreamableHTTPClientTransport(new URL(server.url), {
						requestInit: { headers: server.headers },
					})
				: new StdioClientTransport({
						args: server.args,
						command: server.command,
						env: { ...getDefaultEnvironment(), ...server.env },
					})
		await client.connect(transport)
		return client
	}

	async close() {
		const clients = [...this.clients.values()]
		this.clients.clear()
		await Promise.all(clients.map(async (connecting) => (await connecting).close()))
	}
}
