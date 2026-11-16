import assert from "node:assert/strict"
import test from "node:test"
import { eventDate, eventTime, groupCalendarEvents, monthLink } from "../src/calendar.ts"

const timeZone = "America/Toronto"

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

test("agenda groups calendar days chronologically with all-day events before timed events", () => {
	const events = [
		{
			end: { dateTime: "2026-11-17T02:30:00+01:00" },
			id: "evening",
			start: { dateTime: "2026-11-17T01:30:00+01:00" },
			summary: "Evening call",
		},
		{
			end: { dateTime: "2026-11-16T09:00:00-05:00" },
			id: "morning",
			start: { dateTime: "2026-11-16T08:00:00-05:00" },
			summary: "Morning call",
		},
		{
			end: { date: "2026-11-18" },
			id: "tomorrow",
			start: { date: "2026-11-17" },
			summary: "Tomorrow",
		},
		{
			end: { dateTime: "2026-11-16T12:00:00+01:00" },
			id: "early",
			start: { dateTime: "2026-11-16T11:00:00+01:00" },
			summary: "Early call",
		},
		{
			end: { date: "2026-11-17" },
			id: "all-day",
			start: { date: "2026-11-16" },
			summary: "All-day plans",
		},
	]
	assert.deepEqual(
		groupCalendarEvents(events, timeZone).map(([day, group]) => [
			day,
			group.map((event) => event.id),
		]),
		[
			["2026-11-16", ["all-day", "early", "morning", "evening"]],
			["2026-11-17", ["tomorrow"]],
		],
	)
})

test("month navigation crosses year boundaries in either direction", () => {
	assert.equal(monthLink("2026-12", 1), "?month=2027-01")
	assert.equal(monthLink("2027-01", -1), "?month=2026-12")
})
