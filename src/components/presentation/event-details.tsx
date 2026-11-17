import { CalendarDays, MapPin, Video } from "lucide-react"
import { useState } from "react"
import { useRevalidator } from "react-router"
import { getAccount } from "@/accounts"
import { type CalendarEvent, type CalendarResponse, eventDate } from "@/calendar"
import { Button } from "@/components/ui/button"
import { accountProvider } from "@/provider-identity"
import { Document, DocumentSection } from "./document"
import { Person, SourceIdentity } from "./primitives"
import { SanitizedHtml } from "./rich-text"

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
					account={getAccount(account)}
				/>
			}
		>
			{event.invitation && event.native && (
				<InvitationResponse
					key={`${account}:${event.id}`}
					account={account}
					event={event}
					response={event.invitation.response}
				/>
			)}
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
					<SanitizedHtml html={event.description} />
				</DocumentSection>
			)}
		</Document>
	)
}

const responseLabels = {
	accepted: "Accepted",
	declined: "Declined",
	needsAction: "Not responded",
	tentative: "Maybe",
}
const responseOptions: { label: string; value: CalendarResponse }[] = [
	{ label: "Accept", value: "accepted" },
	{ label: "Maybe", value: "tentative" },
	{ label: "Decline", value: "declined" },
]

function InvitationResponse({
	account,
	event,
	response,
}: {
	account: string
	event: CalendarEvent
	response: CalendarResponse | "needsAction"
}) {
	const revalidator = useRevalidator()
	const [pending, setPending] = useState<CalendarResponse | null>(null)
	const [error, setError] = useState<string | null>(null)
	async function respond(value: CalendarResponse) {
		setPending(value)
		setError(null)
		try {
			await window.calendar.respond(account, event, value)
			await revalidator.revalidate()
		} catch (error) {
			setError(error instanceof Error ? error.message : String(error))
		} finally {
			setPending(null)
		}
	}
	return (
		<section
			className="space-y-3 rounded-lg border p-4"
			aria-label="Invitation response"
		>
			<p className="text-sm text-muted-foreground">
				Your response:{" "}
				<span className="font-medium text-foreground">{responseLabels[response]}</span>
			</p>
			<div
				className="flex flex-wrap gap-2"
				aria-busy={pending !== null}
			>
				{responseOptions.map(({ label, value }) => (
					<Button
						key={value}
						variant={response === value ? "default" : "outline"}
						size="sm"
						aria-pressed={response === value}
						disabled={pending !== null}
						onClick={() => void respond(value)}
					>
						{pending === value ? "Saving…" : label}
					</Button>
				))}
			</div>
			{error && (
				<p
					className="text-sm text-destructive"
					role="alert"
				>
					{error}
				</p>
			)}
		</section>
	)
}
