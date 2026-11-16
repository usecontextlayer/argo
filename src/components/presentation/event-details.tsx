import { CalendarDays, MapPin, Video } from "lucide-react"
import { getAccount } from "@/accounts"
import { type CalendarEvent, eventDate } from "@/calendar"
import { Document, DocumentSection } from "./document"
import { Person, SourceIdentity } from "./primitives"
import { HtmlContent } from "./rich-text"
import "./documents.css"

export function EventDetails({
	event,
	timeZone,
	account,
}: {
	event: CalendarEvent
	timeZone: string
	account: string
}) {
	const identity = getAccount(account)
	return (
		<Document
			title={event.summary || "Untitled event"}
			identity={
				<SourceIdentity
					provider={identity.provider === "google" ? "google-calendar" : "outlook"}
					account={identity.email}
				/>
			}
		>
			<div className="event-facts">
				<div className="event-fact">
					<CalendarDays
						size={20}
						aria-hidden="true"
					/>
					<div>
						<strong>{eventDate(event, timeZone)}</strong>
						<p>
							{timeZone.replaceAll("_", " ")}
							{event.calendarNames?.length ? ` · ${event.calendarNames.join(" · ")}` : ""}
						</p>
					</div>
				</div>
				{event.location && (
					<div className="event-fact">
						<MapPin
							size={20}
							aria-hidden="true"
						/>
						<span>{event.location}</span>
					</div>
				)}
				{event.hangoutLink && (
					<div className="event-fact">
						<Video
							size={20}
							aria-hidden="true"
						/>
						<a
							href={event.hangoutLink}
							target="_blank"
							rel="noreferrer"
						>
							Join video call
						</a>
					</div>
				)}
			</div>
			{event.organizer && (
				<DocumentSection title="Organizer">
					<Person
						name={event.organizer.displayName || event.organizer.email || "Organizer"}
					/>
				</DocumentSection>
			)}
			{Boolean(event.attendees?.length) && (
				<DocumentSection title="Guests">
					<ul className="event-people">
						{event.attendees?.map((attendee) => (
							<li key={attendee.email}>
								<Person name={attendee.displayName || attendee.email}>
									{attendee.self && <span>You · </span>}
									{attendee.responseStatus?.replace("needsAction", "Awaiting response")}
								</Person>
							</li>
						))}
					</ul>
				</DocumentSection>
			)}
			{event.description && (
				<DocumentSection title="Details">
					<div className="presentation-prose">
						<HtmlContent html={event.description} />
					</div>
				</DocumentSection>
			)}
		</Document>
	)
}
