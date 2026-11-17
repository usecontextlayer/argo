import assert from "node:assert/strict"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio"
import { createNoveltyChannel } from "../plugins/novelty/channel.mjs"
import { nextNoveltyTick } from "../plugins/novelty/schedule.mjs"

test("novelty follows Toronto working hours, weekends, and daylight saving time", () => {
	const times = [
		["Monday before opening", "2026-11-16T13:59:59.999Z", "2026-11-16T14:00:00.000Z"],
		["Monday at opening", "2026-11-16T14:00:00.000Z", "2026-11-16T14:05:00.000Z"],
		["weekday between ticks", "2026-11-18T16:32:17.000Z", "2026-11-18T16:35:00.000Z"],
		["Friday before closing", "2026-11-20T22:55:00.000Z", "2026-11-20T23:00:00.000Z"],
		["Friday at closing", "2026-11-20T23:00:00.000Z", "2026-11-21T00:00:00.000Z"],
		["Saturday morning", "2026-11-21T14:00:00.000Z", "2026-11-21T15:00:00.000Z"],
		["Sunday afternoon", "2026-11-22T20:01:00.000Z", "2026-11-22T21:00:00.000Z"],
		["summer opening", "2026-07-20T12:59:59.999Z", "2026-07-20T13:00:00.000Z"],
		["summer prime hours", "2026-07-20T13:00:00.000Z", "2026-07-20T13:05:00.000Z"],
		["summer closing", "2026-07-20T22:00:00.000Z", "2026-07-20T23:00:00.000Z"],
	]
	for (const [label, now, expected] of times) {
		assert.equal(nextNoveltyTick(new Date(now)).toISOString(), expected, label)
	}
})

test("the initialized channel delivers recurring novelty work across closing time", async (t) => {
	t.mock.timers.enable({
		apis: ["Date", "setTimeout"],
		now: new Date("2026-11-16T22:54:59.000Z"),
	})
	const server = createNoveltyChannel()
	const client = new Client({ name: "argo-novelty-test", version: "1.0.0" })
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
	const notifications = []
	client.fallbackNotificationHandler = async (notification) => {
		notifications.push(notification)
	}
	t.after(async () => {
		await client.close()
		await server.close()
	})
	await server.connect(serverTransport)
	await client.connect(clientTransport)
	await client.ping()
	assert.deepEqual(client.getServerCapabilities()?.experimental?.["claude/channel"], {})
	assert.deepEqual(
		notifications,
		[],
		"initializing the channel does not request discovery",
	)

	const ticks = [
		[1_000, "2026-11-16T22:55:00.000Z"],
		[300_000, "2026-11-16T23:00:00.000Z"],
		[3_600_000, "2026-11-17T00:00:00.000Z"],
	]
	for (const [index, [delay, timestamp]] of ticks.entries()) {
		t.mock.timers.tick(delay - 1)
		await client.ping()
		assert.equal(notifications.length, index, `no novelty request before ${timestamp}`)
		t.mock.timers.tick(1)
		await client.ping()
		assert.equal(notifications.length, index + 1, `one novelty request at ${timestamp}`)
		const notification = notifications[index]
		assert.equal(notification.method, "notifications/claude/channel")
		assert.equal(notification.params.meta.timestamp, timestamp)
		assert.match(notification.params.content, /discover new or changed work/)
		assert.match(notification.params.content, /local doables and discovery progress/)
	}
})

test("the production stdio entry point advertises the Claude channel", async (t) => {
	const client = new Client({ name: "argo-stdio-test", version: "1.0.0" })
	const transport = new StdioClientTransport({
		args: [fileURLToPath(new URL("../plugins/novelty/server.mjs", import.meta.url))],
		command: process.execPath,
	})
	t.after(() => client.close())
	await client.connect(transport)
	assert.deepEqual(client.getServerCapabilities()?.experimental?.["claude/channel"], {})
	await client.ping()
})
