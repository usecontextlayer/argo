const torontoClock = new Intl.DateTimeFormat("en-US", {
	hour: "numeric",
	hourCycle: "h23",
	minute: "numeric",
	timeZone: "America/Toronto",
	weekday: "short",
})

function isNoveltyTick(date) {
	const { hour, minute, weekday } = Object.fromEntries(
		torontoClock.formatToParts(date).map(({ type, value }) => [type, value]),
	)
	const workingHours =
		["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday) &&
		Number(hour) >= 9 &&
		Number(hour) < 18
	return Number(minute) % (workingHours ? 5 : 60) === 0
}

export function nextNoveltyTick(date) {
	const next = new Date(Math.floor(date.getTime() / 60_000) * 60_000 + 60_000)
	while (!isNoveltyTick(next)) next.setTime(next.getTime() + 60_000)
	return next
}
