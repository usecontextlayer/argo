import assert from "node:assert/strict"
import test from "node:test"
import {
	civilDay,
	scheduleDate,
	scheduleDays,
} from "../src/components/presentation/schedule-dates.ts"

test("day and week views select civil dates with a Monday week across a year boundary", () => {
	const selected = new Date(2027, 0, 1, 18, 30)
	assert.deepEqual(scheduleDays(selected, 1).map(civilDay), ["2027-01-01"])
	assert.deepEqual(scheduleDays(selected, 7).map(civilDay), [
		"2026-12-28",
		"2026-12-29",
		"2026-12-30",
		"2026-12-31",
		"2027-01-01",
		"2027-01-02",
		"2027-01-03",
	])
	assert.equal(selected.getHours(), 18)
})

test("schedule dates preserve all-day dates and locate timed events in the displayed timezone", () => {
	assert.equal(scheduleDate("2026-11-17", "America/Toronto"), "2026-11-17")
	assert.equal(scheduleDate("2026-11-17T01:30:00+01:00", "America/Toronto"), "2026-11-16")
	assert.equal(scheduleDate("2026-11-17T01:30:00+01:00", "Asia/Tokyo"), "2026-11-17")
})
