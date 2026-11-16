// Refresh: node tests/record-workflowy.mjs /absolute/path/to/tree-seek-result.json
// Input: an authorized tree_seek structuredContent result from a root read,
// including the root and at least two children. Keep the observed line format;
// replace all IDs, text, and counts with test-owned values.
import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"

const source = JSON.parse(await readFile(process.argv[2], "utf8"))
const lines = source.results[0].split("\n")
const records = []
for (let index = 0; index < lines.length && records.length < 3; index++) {
	const line = lines[index]
	if (!line.startsWith("[")) continue
	assert.match(lines[index + 1], /^\s+\d+:\d+:\d+$/)
	const number = records.length
	const id = number === 0 ? "None" : `test-node-${number}`
	const text = ["Test home", "First child — café", "Second child"][number]
	const renamed = line.replace(/^\[[^\]]+\]/, `[${id}]`)
	records.push(
		`${renamed.slice(0, renamed.indexOf('"'))}${JSON.stringify(text)}\n${lines[index + 1].replace(/\d+:\d+:\d+/, `${number + 1}:0:0`)}`,
	)
}
assert.equal(records.length, 3)

await writeFile(
	new URL("fixtures/workflowy-nodes.txt", import.meta.url),
	`${records.join("\n")}\n`,
)
