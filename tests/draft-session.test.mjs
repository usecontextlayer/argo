import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server
let DraftSession

before(async () => {
	server = await createServer({
		appType: "custom",
		configFile: "vite.renderer.config.mts",
		server: { middlewareMode: true, ws: false },
	})
	;({ DraftSession } = await server.ssrLoadModule("/src/draft-session.ts"))
})

after(() => server?.close())

function operations(overrides = {}) {
	return {
		discard: async () => {},
		empty: () => null,
		load: async () => null,
		save: async (draft) => draft,
		send: async () => {},
		...overrides,
	}
}

test("editing automatically saves the conversation draft without a send or navigation", {
	timeout: 5000,
}, async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const reply = { body: "Autosaved reply", id: "native-draft" }
	let persisted
	const session = new DraftSession(
		operations({
			save: async (draft) => {
				persisted = draft
				return draft
			},
		}),
	)
	await session.load()
	assert.equal(session.getSnapshot().dirty, false)
	session.update(reply)
	assert.equal(session.getSnapshot().dirty, true)
	t.mock.timers.runAll()
	assert.deepEqual(persisted, reply)
	await session.flush()
	assert.equal(session.getSnapshot().saving, false)
	assert.equal(session.getSnapshot().dirty, false)
	assert.deepEqual(session.getSnapshot().draft, reply)
})

test("reopening the same session resumes its draft without loading over current edits", {
	timeout: 5000,
}, async () => {
	const loaded = Promise.withResolvers()
	const existing = { body: "Saved reply", id: "native-draft" }
	let loads = 0
	const session = new DraftSession(
		operations({
			load: () => {
				loads++
				return loaded.promise
			},
		}),
	)
	const firstView = session.load()
	const secondView = session.load()
	loaded.resolve(existing)
	assert.deepEqual(await Promise.all([firstView, secondView]), [true, true])
	assert.deepEqual(session.getSnapshot().draft, existing)

	const edited = { ...existing, body: "Current reply" }
	session.update(edited)
	await session.flush()
	assert.equal(await session.load(), true)
	assert.deepEqual(session.getSnapshot().draft, edited)
	assert.equal(loads, 1)
})

test("refresh reads native draft changes made outside Argo once the local draft is saved", async () => {
	let nativeDraft = { body: "Saved in Argo", id: "native-draft" }
	const session = new DraftSession(operations({ load: async () => nativeDraft }))
	await session.load()
	nativeDraft = { ...nativeDraft, body: "Edited in the mail provider" }
	assert.equal(await session.refresh(), true)
	assert.deepEqual(session.getSnapshot().draft, nativeDraft)
	assert.equal(session.getSnapshot().dirty, false)
})

test("refresh preserves local edits both before and during their save", {
	timeout: 5000,
}, async () => {
	let nativeDraft = { body: "Saved reply", id: "native-draft" }
	const saving = Promise.withResolvers()
	const session = new DraftSession(
		operations({
			load: async () => nativeDraft,
			save: async (draft) => {
				await saving.promise
				nativeDraft = draft
				return draft
			},
		}),
	)
	await session.load()
	const localEdit = { ...nativeDraft, body: "Current local edit" }
	session.update(localEdit)
	nativeDraft = { ...nativeDraft, body: "Older provider content" }
	assert.equal(await session.refresh(), true)
	assert.deepEqual(session.getSnapshot().draft, localEdit)
	assert.equal(session.getSnapshot().dirty, true)
	const flushing = session.flush()
	assert.equal(await session.refresh(), true)
	assert.deepEqual(session.getSnapshot().draft, localEdit)
	assert.equal(session.getSnapshot().saving, true)
	assert.equal(session.getSnapshot().dirty, true)
	saving.resolve()
	assert.equal(await flushing, true)
	assert.deepEqual(nativeDraft, localEdit)
	assert.equal(session.getSnapshot().dirty, false)
})

test("a refresh that finishes after typing begins cannot replace the new local text", async () => {
	const original = { body: "Saved reply", id: "native-draft" }
	const refreshing = Promise.withResolvers()
	let firstLoad = true
	const session = new DraftSession(
		operations({
			load: () => {
				if (firstLoad) {
					firstLoad = false
					return Promise.resolve(original)
				}
				return refreshing.promise
			},
		}),
	)
	await session.load()
	const refresh = session.refresh()
	const localEdit = { ...original, body: "Typed while the provider was loading" }
	session.update(localEdit)
	refreshing.resolve({ ...original, body: "Provider draft" })
	assert.equal(await refresh, true)
	assert.deepEqual(session.getSnapshot().draft, localEdit)
	assert.equal(session.getSnapshot().dirty, true)
	assert.equal(await session.flush(), true)
	assert.deepEqual(session.getSnapshot().draft, localEdit)
	assert.equal(session.getSnapshot().dirty, false)
})

test("opening a native reply preserves its assigned identity through saving and sending", async () => {
	const reply = { body: "", id: "provider-draft", target: "message-2" }
	let saved
	let sent
	const session = new DraftSession(
		operations({
			save: async (draft) => {
				saved = draft
				return draft
			},
			send: async (draft) => {
				sent = draft
			},
		}),
	)
	assert.equal(await session.open(async () => reply), true)
	assert.deepEqual(session.getSnapshot().draft, reply)
	const edited = { ...reply, body: "Reply to the selected message" }
	session.update(edited)
	assert.equal(await session.send(), true)
	assert.deepEqual(saved, edited)
	assert.deepEqual(sent, edited)
	assert.equal(session.getSnapshot().draft, null)
})

test("functional edits preserve the latest body and reply context", async () => {
	const session = new DraftSession(
		operations({ load: async () => ({ body: "Original", quote: null }) }),
	)
	await session.load()

	session.update((draft) => ({ ...draft, body: "Edited reply" }))
	session.update((draft) => ({ ...draft, quote: "message-2" }))
	assert.deepEqual(session.getSnapshot().draft, {
		body: "Edited reply",
		quote: "message-2",
	})
	assert.equal(await session.flush(), true)
	assert.deepEqual(session.getSnapshot().draft, {
		body: "Edited reply",
		quote: "message-2",
	})
})

for (const activity of ["opening", "sending", "discarding"]) {
	test(`${activity} immediately excludes other actions and keeps its draft fixed`, async () => {
		const pending = Promise.withResolvers()
		const original = { body: "Current reply", id: "native-draft" }
		const opened = { ...original, id: "new-native-draft" }
		const session = new DraftSession(
			operations({
				discard: async () => pending.promise,
				load: async () => original,
				send: async () => pending.promise,
			}),
		)
		await session.load()
		const action =
			activity === "opening"
				? session.open(async () => {
						await pending.promise
						return opened
					})
				: activity === "sending"
					? session.send()
					: session.discard()

		assert.equal(session.getSnapshot().activity, activity)
		session.update({ ...original, body: "An edit during the action" })
		session.update((draft) => ({ ...draft, body: "A functional edit during the action" }))
		assert.deepEqual(session.getSnapshot().draft, original)
		const competing = [
			session.open(async () => ({ ...original, id: "competing-draft" })),
			session.send(),
			session.discard(),
		]

		pending.resolve()
		assert.deepEqual(await Promise.all(competing), [false, false, false])
		assert.equal(await action, true)
		assert.deepEqual(session.getSnapshot().draft, activity === "opening" ? opened : null)
		assert.equal(session.getSnapshot().activity, "idle")
	})
}

test("sending waits until the latest edited body is saved", {
	timeout: 5000,
}, async () => {
	const saving = Promise.withResolvers()
	const entered = Promise.withResolvers()
	const reply = { body: "Latest reply", id: "native-draft" }
	let persisted
	let delivered
	const session = new DraftSession(
		operations({
			load: async () => ({ ...reply, body: "Earlier reply" }),
			save: async (draft) => {
				entered.resolve()
				await saving.promise
				persisted = draft
				return draft
			},
			send: async (draft) => {
				assert.deepEqual(persisted, reply)
				delivered = draft
			},
		}),
	)
	await session.load()
	session.update(reply)
	const sending = session.send()
	await Promise.race([entered.promise, sending])
	assert.equal(session.getSnapshot().saving, true)
	assert.equal(session.getSnapshot().dirty, true)
	assert.equal(delivered, undefined)
	saving.resolve()
	assert.equal(await sending, true)
	assert.deepEqual(delivered, reply)
	assert.equal(session.getSnapshot().draft, null)
})

test("a newer edit made during save stays visible and is persisted before flush completes", {
	timeout: 5000,
}, async () => {
	const firstSave = Promise.withResolvers()
	const secondSave = Promise.withResolvers()
	const savingLatest = Promise.withResolvers()
	const original = { body: "Original", id: "native-draft" }
	const first = { ...original, body: "First edit" }
	const latest = { ...original, body: "Latest edit" }
	const saved = []
	const session = new DraftSession(
		operations({
			load: async () => original,
			save: async (draft) => {
				saved.push(draft)
				if (saved.length === 1) await firstSave.promise
				else {
					savingLatest.resolve()
					await secondSave.promise
				}
				return { ...draft }
			},
		}),
	)
	await session.load()
	session.update(first)
	const flushing = session.flush()
	session.update(latest)
	firstSave.resolve()
	await Promise.race([savingLatest.promise, flushing])
	assert.deepEqual(session.getSnapshot().draft, latest)
	assert.equal(session.getSnapshot().saving, true)
	secondSave.resolve()
	assert.equal(await flushing, true)
	assert.deepEqual(saved, [first, latest])
	assert.deepEqual(session.getSnapshot().draft, latest)
	assert.equal(session.getSnapshot().saving, false)
})

test("a failed save keeps the editable reply and prevents send until saving succeeds", async () => {
	const reply = { body: "Unsaved reply", id: "native-draft" }
	let saveFails = true
	let delivered
	const session = new DraftSession(
		operations({
			save: async (draft) => {
				if (saveFails) throw new Error("Draft could not be saved")
				return draft
			},
			send: async (draft) => {
				delivered = draft
			},
		}),
	)
	await session.load()
	session.update(reply)
	assert.equal(await session.send(), false)
	assert.deepEqual(session.getSnapshot().draft, reply)
	assert.equal(session.getSnapshot().error, "Draft could not be saved")
	assert.equal(session.getSnapshot().dirty, true)
	assert.equal(delivered, undefined)
	saveFails = false
	assert.equal(await session.send(), true)
	assert.deepEqual(delivered, reply)
})

test("a failed send leaves the saved reply available for another attempt", async () => {
	const reply = { body: "Keep this reply", id: "native-draft" }
	let sendFails = true
	let delivered
	const session = new DraftSession(
		operations({
			load: async () => ({ ...reply, body: "Original saved reply" }),
			send: async (draft) => {
				if (sendFails) throw new Error("Provider rejected the send")
				delivered = draft
			},
		}),
	)
	await session.load()
	session.update(reply)
	assert.equal(await session.send(), false)
	assert.deepEqual(session.getSnapshot().draft, reply)
	assert.equal(session.getSnapshot().error, "Provider rejected the send")
	assert.equal(session.getSnapshot().activity, "idle")
	assert.equal(session.getSnapshot().dirty, false)
	sendFails = false
	assert.equal(await session.send(), true)
	assert.deepEqual(delivered, reply)
	assert.equal(session.getSnapshot().draft, null)
})

test("discard removes the native draft and clears its editable content", async () => {
	const reply = { body: "Discard me", id: "native-draft" }
	let discarded
	const session = new DraftSession(
		operations({
			discard: async (draft) => {
				discarded = draft
			},
			load: async () => reply,
		}),
	)
	await session.load()
	session.update({ ...reply, body: "Discard these latest edits" })
	assert.equal(await session.discard(), true)
	assert.deepEqual(discarded, { ...reply, body: "Discard these latest edits" })
	assert.equal(session.getSnapshot().draft, null)
	assert.equal(session.getSnapshot().activity, "idle")
	assert.equal(session.getSnapshot().error, null)
})

test("sending a chat clears body and quote using a fresh empty draft", async () => {
	const empty = () => ({
		body: { content: [{ type: "paragraph" }], type: "doc" },
		quote: null,
	})
	const reply = {
		body: {
			content: [{ content: [{ text: "Hello", type: "text" }], type: "paragraph" }],
			type: "doc",
		},
		quote: "message-1",
	}
	let delivered
	const session = new DraftSession(
		operations({
			empty,
			send: async (draft) => {
				delivered = draft
			},
		}),
	)
	await session.load()
	const initiallyEmpty = session.getSnapshot().draft
	session.update(reply)
	assert.equal(await session.send(), true)
	assert.deepEqual(delivered, reply)
	assert.deepEqual(session.getSnapshot().draft, empty())
	assert.notEqual(session.getSnapshot().draft, initiallyEmpty)
	assert.equal(await session.load(), true)
	assert.deepEqual(session.getSnapshot().draft, empty())
})
