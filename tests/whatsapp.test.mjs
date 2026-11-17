import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { decodeWhatsAppChats, decodeWhatsAppMessages } from "../src/whatsapp.ts"

// Recorded VGP MCP structuredContent; record-whatsapp.mjs replaces all private
// values while preserving identity relationships, provider types and nulls.
const fixture = async (name) =>
	JSON.parse(
		await readFile(new URL(`fixtures/whatsapp-${name}.json`, import.meta.url), "utf8"),
	)
const chats = await fixture("chats")
const recent = await fixture("messages")
const older = await fixture("older")
const short = await fixture("short")

test("WhatsApp chat pages preserve group and direct-chat identity, unread state and previews", () => {
	const page = decodeWhatsAppChats(chats)
	assert.equal(page.items.length, 50)
	assert.equal(page.hasMore, true)
	assert.deepEqual(page.items.slice(0, 2), [
		{
			id: "1@g.us",
			isGroup: true,
			preview: "Plan — café.\nمرحبا 👋",
			title: "Contact 2 — café",
			unread: true,
			updatedAt: 1700008880000,
		},
		{
			id: "2@s.whatsapp.net",
			isGroup: false,
			preview: "Plan — café.\nمرحبا 👋",
			title: "Contact 4 — café",
			unread: false,
			updatedAt: 1700008760000,
		},
	])
})

test("WhatsApp message pages read chronologically and older history precedes recent history", () => {
	const page = decodeWhatsAppMessages(recent)
	const history = decodeWhatsAppMessages(older)
	const finalPage = decodeWhatsAppMessages(short)
	assert.equal(finalPage.items.length, 18)
	assert.equal(finalPage.hasMore, false)
	assert.equal(page.hasMore, true)
	assert.equal(history.hasMore, true)
	assert.equal(page.items.length, 50)
	assert.equal(history.items.length, 50)
	assert.equal(page.items[0].id, "message-106")
	assert.equal(page.items.at(-1).id, "message-51")
	assert.equal(history.items[0].id, "message-156")
	assert.equal(history.items.at(-1).id, "message-107")
	const timeline = [...history.items, ...page.items]
	for (let index = 1; index < timeline.length; index++) {
		assert.ok(
			timeline[index - 1].createdAt <= timeline[index].createdAt,
			"Messages must read oldest first",
		)
	}
})

test("WhatsApp messages preserve sender identity, UTF-8 text, outgoing state, media and reaction targets", () => {
	const { items } = decodeWhatsAppMessages(recent)
	assert.deepEqual(
		items.find(({ id }) => id === "message-51"),
		{
			chatId: "1@g.us",
			createdAt: 1700008880000,
			id: "message-51",
			isFromMe: false,
			mediaType: null,
			quotedMessageId: null,
			reactionToMessageId: null,
			sender: "Contact 79 — café",
			senderId: "52@s.whatsapp.net",
			text: "Plan — café.\nمرحبا 👋",
		},
	)
	const outgoing = items.find(({ id }) => id === "message-85")
	assert.equal(outgoing.isFromMe, true)
	assert.equal(outgoing.sender, "You")
	assert.equal(outgoing.senderId, "86@s.whatsapp.net")
	const reaction = items.find(({ id }) => id === "message-53")
	assert.equal(reaction.mediaType, "reaction")
	assert.equal(reaction.reactionToMessageId, "message-54")
	assert.ok(items.some(({ id }) => id === reaction.reactionToMessageId))
	assert.equal(items.find(({ id }) => id === "message-66").mediaType, "image")
	const sticker = decodeWhatsAppMessages(older).items.find(
		({ id }) => id === "message-124",
	)
	assert.equal(sticker.mediaType, "sticker")
	assert.equal(sticker.text, "")
	assert.equal(sticker.quotedMessageId, null)
	assert.equal(sticker.reactionToMessageId, null)
})
