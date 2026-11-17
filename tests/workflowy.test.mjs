import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { decodeWorkflowyNodes } from "../src/workflowy.ts"

const source = await readFile(
	new URL("fixtures/workflowy-nodes.txt", import.meta.url),
	"utf8",
)

test("Workflowy nodes retain hierarchy, text, identity, and child counts", () => {
	assert.deepEqual(decodeWorkflowyNodes(source), [
		{ children: 1, depth: 0, format: "bullets", id: "root", text: "Test home" },
		{
			children: 2,
			depth: 1,
			format: "bullets",
			id: "test-node-1",
			text: "First child — café",
		},
		{
			children: 3,
			depth: 1,
			format: "bullets",
			id: "test-node-2",
			text: "Second child",
		},
	])
})
