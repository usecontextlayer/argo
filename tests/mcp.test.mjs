import assert from "node:assert/strict"
import test from "node:test"
import { mcpConfigSchema } from "../src/mcp.ts"

test("mcp.json retains HTTP servers and their request headers", () => {
	const config = {
		mcpServers: {
			local: { type: "http", url: "http://localhost:1234/mcp" },
			remote: {
				headers: { Authorization: "Bearer test-owned-token" },
				url: "https://example.test/mcp",
			},
		},
	}
	assert.deepEqual(mcpConfigSchema.parse(config), config)
})

test("mcp.json retains stdio commands, arguments, and environment", () => {
	const config = {
		mcpServers: {
			configured: {
				args: ["--workspace", "/tmp/test-owned-workspace"],
				command: "test-owned-server",
				env: { WORKSPACE_NAME: "Test workspace" },
				type: "stdio",
			},
			minimal: { command: "test-owned-server" },
		},
	}
	assert.deepEqual(mcpConfigSchema.parse(config), config)
})
