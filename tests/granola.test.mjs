import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import electron from "electron"

test("Granola list and details preserve meeting identity, decoded text, notes and transcript availability", () => {
	const userData = mkdtempSync(path.join(tmpdir(), "argo-granola-test-"))
	try {
		const result = spawnSync(
			electron,
			[fileURLToPath(new URL("granola-renderer.cjs", import.meta.url)), userData],
			{ encoding: "utf8", timeout: 30_000 },
		)
		assert.equal(
			result.status,
			0,
			result.stderr || `Electron terminated with ${result.signal}`,
		)
		const [list, details] = JSON.parse(result.stdout)
		const meeting = {
			date: "2026-11-16T14:30:00+00:00",
			id: "meeting-1",
			notes: "",
			participants: "Ada & Lin <team@example.test>",
			summary: "",
			title: 'Planning & review "café"',
			transcriptAvailable: false,
		}
		assert.equal(list.length, 12)
		assert.deepEqual(list[0], meeting)
		assert.equal(list[11].id, "meeting-12")
		assert.deepEqual(details, [
			{
				...meeting,
				summary: "## Plan & decisions\n\nKeep <draft> and café notes.",
				transcriptAvailable: true,
			},
		])
	} finally {
		rmSync(userData, { force: true, recursive: true })
	}
})
