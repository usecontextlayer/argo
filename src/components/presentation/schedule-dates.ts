export function scheduleDate(value: string, timeZone: string) {
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
	const parts = new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		month: "2-digit",
		timeZone,
		year: "numeric",
	}).formatToParts(new Date(value))
	const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
	return `${fields.year}-${fields.month}-${fields.day}`
}

export function civilDay(value: Date) {
	return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
}

export function scheduleDays(date: Date, count: 1 | 7) {
	const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
	if (count === 7) start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
	return Array.from({ length: count }, (_, index) => {
		const day = new Date(start)
		day.setDate(day.getDate() + index)
		return day
	})
}
