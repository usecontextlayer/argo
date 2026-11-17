import { CalendarDays, MapPin, Video } from "lucide-react"
import { type CalendarEvent, eventDate } from "@/calendar"
import { accountProvider } from "@/provider-identity"
import { Document, DocumentSection } from "./document"
import { Person, SourceIdentity } from "./primitives"
import { HtmlContent } from "./rich-text"

export function EventDetails({
	event,
	timeZone,
	account,
}: {
	event: CalendarEvent
	timeZone: string
	account: string
}) {
	return (
		<Document
			title={event.summary || "Untitled event"}
			identity={
				<SourceIdentity
					provider={accountProvider(account, "calendar")}
					account={account}
				/>
			}
		>
			<div className="grid gap-6">
				<div className="flex items-start gap-4 wrap-anywhere">
					<CalendarDays
						className="mt-1 size-5 shrink-0 text-muted-foreground"
						aria-hidden="true"
					/>
					<div>
						<strong className="text-base font-semibold">
							{eventDate(event, timeZone)}
						</strong>
						<p className="mt-1 text-sm text-muted-foreground">
							{timeZone.replaceAll("_", " ")}
							{event.calendarNames?.length ? ` · ${event.calendarNames.join(" · ")}` : ""}
						</p>
					</div>
				</div>
				{event.location && (
					<div className="flex items-start gap-4 wrap-anywhere">
						<MapPin
							className="mt-1 size-5 shrink-0 text-muted-foreground"
							aria-hidden="true"
						/>
						<span>{event.location}</span>
					</div>
				)}
				{event.hangoutLink && (
					<div className="flex items-start gap-4 wrap-anywhere">
						<Video
							className="mt-1 size-5 shrink-0 text-muted-foreground"
							aria-hidden="true"
						/>
						<a
							className="underline underline-offset-4"
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
					<ul className="m-0 flex list-none flex-wrap gap-x-8 gap-y-6 p-0">
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
					<HtmlContent html={event.description} />
				</DocumentSection>
			)}
		</Document>
	)
}
