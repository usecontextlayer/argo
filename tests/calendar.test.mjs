import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"
import { eventDate, eventTime, monthLink } from "../src/calendar.ts"
import { sourceHref } from "../src/source-reference.ts"

const timeZone = "America/Toronto"
let server
let calendarLoader

before(async () => {
	server = await createServer({
		appType: "custom",
		configFile: "vite.renderer.config.mts",
		server: { middlewareMode: true, ws: false },
	})
	;({ calendarLoader } = await server.ssrLoadModule("/src/calendar-view.tsx"))
})

after(async () => {
	await server?.close()
})

test("all-day details show the inclusive last day and keep a single day concise", () => {
	const day = new Intl.DateTimeFormat(undefined, { dateStyle: "full" })
	const first = day.format(new Date(2026, 10, 1))
	const last = day.format(new Date(2026, 10, 3))
	const trip = {
		end: { date: "2026-11-04" },
		id: "trip",
		start: { date: "2026-11-01" },
		summary: "Trip",
	}
	assert.equal(eventDate(trip, timeZone), `${first} – ${last} · All day`)
	assert.equal(eventTime(trip, timeZone), "All day")
	assert.equal(
		eventDate({ ...trip, end: { date: "2026-11-02" } }, timeZone),
		`${first} · All day`,
	)
})

test("timed labels use the calendar date and time even across a source date boundary", () => {
	const event = {
		end: { dateTime: "2026-11-17T02:30:00+01:00" },
		id: "call",
		start: { dateTime: "2026-11-17T01:30:00+01:00" },
		summary: "Call",
	}
	const start = new Date("2026-11-16T19:30:00-05:00")
	const end = new Date("2026-11-16T20:30:00-05:00")
	const time = new Intl.DateTimeFormat(undefined, {
		hour: "numeric",
		minute: "2-digit",
		timeZone,
	})
	const date = new Intl.DateTimeFormat(undefined, {
		dateStyle: "full",
		timeStyle: "short",
		timeZone,
	})
	assert.equal(eventTime(event, timeZone), `${time.format(start)} – ${time.format(end)}`)
	assert.equal(eventDate(event, timeZone), `${date.format(start)} – ${date.format(end)}`)
})

test("month navigation crosses year boundaries in either direction", () => {
	assert.equal(monthLink("2026-12", 1), "?month=2027-01")
	assert.equal(monthLink("2027-01", -1), "?month=2026-12")
})

test("a calendar date selects its month even when the URL has a stale month hint", async (t) => {
	const selected = {
		end: { date: "2027-01-09" },
		id: "january-event",
		start: { date: "2027-01-08" },
		summary: "January plans",
	}
	const pages = {
		alnu: {
			"2026-12": { events: [], timeZone: "Asia/Tokyo" },
			"2027-01": { events: [selected], timeZone },
		},
	}
	globalThis.window = {
		calendar: { list: async (account, month) => pages[account][month] },
	}
	t.after(() => {
		delete globalThis.window
	})

	const data = await calendarLoader({
		request: new Request(
			"https://argo.test/calendar?account=alnu&date=2027-01-08&month=2026-12&view=day",
		),
	})

	assert.equal(data.day, "2027-01-08")
	assert.equal(data.view, "day")
	assert.equal(data.timeZone, timeZone)
	assert.deepEqual(data.events, [selected])
})

test("a calendar week includes both months and shows a spanning event once", async (t) => {
	const december = {
		end: { date: "2026-12-30" },
		id: "december-event",
		start: { date: "2026-12-29" },
		summary: "December plans",
	}
	const spanning = {
		end: { date: "2027-01-03" },
		id: "spanning-event",
		start: { date: "2026-12-31" },
		summary: "New year break",
	}
	const january = {
		end: { date: "2027-01-03" },
		id: "january-event",
		start: { date: "2027-01-02" },
		summary: "January plans",
	}
	const pages = {
		"2026-12": { events: [december, spanning], timeZone },
		"2027-01": { events: [spanning, january], timeZone },
	}
	globalThis.window = { calendar: { list: async (_account, month) => pages[month] } }
	t.after(() => {
		delete globalThis.window
	})

	const data = await calendarLoader({
		request: new Request("https://argo.test/calendar?date=2027-01-01&view=week"),
	})

	assert.equal(data.day, "2027-01-01")
	assert.equal(data.view, "week")
	assert.deepEqual(data.events.map((event) => event.id).sort(), [
		"december-event",
		"january-event",
		"spanning-event",
	])
})

test("a calendar source link opens its event day using the source month hint", async (t) => {
	const selected = {
		end: { dateTime: "2026-11-17T02:30:00+01:00" },
		id: "source-event",
		start: { dateTime: "2026-11-17T01:30:00+01:00" },
		summary: "Proposal review",
	}
	const pages = { eightzerothree: { "2026-11": { events: [selected], timeZone } } }
	globalThis.window = {
		calendar: { list: async (account, month) => pages[account][month] },
	}
	t.after(() => {
		delete globalThis.window
	})
	const href = sourceHref({
		account: "eightzerothree",
		eventId: selected.id,
		label: "Proposal review from the task",
		month: "2026-11",
		source: "calendar",
	})

	const data = await calendarLoader({
		request: new Request(new URL(href, "https://argo.test")),
	})

	assert.equal(data.day, "2026-11-16")
	assert.deepEqual(data.events, [selected])
})
