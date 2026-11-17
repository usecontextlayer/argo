export type GranolaMeeting = {
	id: string
	title: string
	date: string
	participants: string
	summary: string
	notes: string
	transcriptAvailable: boolean
}

export type GranolaTranscript = {
	transcript: string
	truncated: boolean
}

export type GranolaApi = {
	list: (month: string) => Promise<string>
	meeting: (id: string) => Promise<string>
	transcript: (id: string) => Promise<GranolaTranscript>
	refresh: () => Promise<void>
}

declare global {
	interface Window {
		granola: GranolaApi
	}
}

export function decodeGranolaMeetings(source: string): GranolaMeeting[] {
	const document = new DOMParser().parseFromString(`<root>${source}</root>`, "text/xml")
	const error = document.querySelector("parsererror")
	if (error)
		throw new Error(`Granola returned invalid meeting data: ${error.textContent}`)
	return [...document.querySelectorAll("meeting")].map((meeting) => ({
		date: meeting.getAttribute("meeting_at") ?? "",
		id: meeting.getAttribute("id") ?? "",
		notes: meeting.querySelector("private_notes")?.textContent?.trim() ?? "",
		participants: meeting.querySelector("known_participants")?.textContent?.trim() ?? "",
		summary: meeting.querySelector("summary")?.textContent?.trim() ?? "",
		title: meeting.getAttribute("title") ?? "",
		transcriptAvailable:
			meeting.querySelector("transcript")?.getAttribute("available") === "true",
	}))
}
