import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { doableSchema, sourceHref } from "../src/doables.ts"
import { listDoables } from "../src/doables-service.ts"

const sourceCases = [
	{
		href: "/mail/thread%2Fwith%2Bsymbols%3F?account=alnu",
		reference: {
			account: "alnu",
			label: "Email requesting the proposal",
			source: "mail",
			threadId: "thread/with+symbols?",
		},
	},
	{
		href: "/calendar?account=eightzerothree&month=2026-11&event=event%2Fwith%2Bsymbols%3F",
		reference: {
			account: "eightzerothree",
			eventId: "event/with+symbols?",
			label: "Proposal review",
			month: "2026-11",
			source: "calendar",
		},
	},
	{
		href: "/teams?account=codecreators&chat=19%3Achat%2Bwith%26symbols%40thread.v2",
		reference: {
			chatId: "19:chat+with&symbols@thread.v2",
			label: "Proposal discussion",
			source: "teams",
		},
	},
	{
		href: "/whatsapp?chat=123-456%40g.us&quote=message%2Bwith%26symbols",
		reference: {
			chatId: "123-456@g.us",
			label: "Message requesting the proposal",
			messageId: "message+with&symbols",
			source: "whatsapp",
		},
	},
	{
		href: "/imessage?chat=42&message=message%2Bwith%26symbols",
		reference: {
			chatId: 42,
			label: "iMessage requesting the proposal",
			messageId: "message+with&symbols",
			source: "imessage",
		},
	},
	{
		href: "/workflowy?node=node%2Bwith%26symbols",
		reference: {
			label: "Written proposal task",
			nodeId: "node+with&symbols",
			source: "workflowy",
		},
	},
	{
		href: "/granola?meeting=meeting%2Bwith%26symbols",
		reference: {
			label: "Proposal meeting",
			meetingId: "meeting+with&symbols",
			source: "granola",
		},
	},
]

const doable = {
	context: sourceCases.map(({ reference }) => reference),
	description: "Prepare the proposal and address the decisions from the meeting.",
	id: "prepare-proposal",
	rationale: "The client requested a proposal and is waiting for it.",
	status: "open",
	title: "Prepare the proposal",
}

test("doable JSON retains its explanation and opens the referenced item in each source", () => {
	const parsed = doableSchema.parse(JSON.parse(JSON.stringify(doable)))
	assert.deepEqual(parsed, doable)
	for (const [index, { href }] of sourceCases.entries()) {
		const actual = new URL(sourceHref(parsed.context[index]), "https://argo.test")
		const expected = new URL(href, "https://argo.test")
		assert.equal(actual.pathname, expected.pathname)
		assert.deepEqual(
			Object.fromEntries(actual.searchParams),
			Object.fromEntries(expected.searchParams),
		)
	}
})

test("the app reads saved doable files and sees edits on the next read", async (t) => {
	const directory = await mkdtemp(path.join(tmpdir(), "argo-doables-test-"))
	t.after(() => rm(directory, { force: true, recursive: true }))
	const file = path.join(directory, "prepare-proposal.json")
	await writeFile(file, JSON.stringify(doable))

	assert.deepEqual(await listDoables(directory), [doable])

	const revised = {
		...doable,
		description: "The proposal is ready and has been sent.",
		status: "done",
	}
	await writeFile(file, JSON.stringify(revised))
	assert.deepEqual(await listDoables(directory), [revised])
})
