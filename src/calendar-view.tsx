import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import {
	Link,
	type LoaderFunctionArgs,
	useLoaderData,
	useNavigation,
	useRevalidator,
	useRouteError,
	useSearchParams,
} from "react-router"
import { getAccount } from "@/accounts"
import {
	type CalendarPage,
	civilDate,
	eventDate,
	eventTime,
	groupCalendarEvents,
	monthLink,
} from "@/calendar"
import { Button } from "@/components/ui/button"

export function currentMonth() {
	const today = new Date()
	return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
}

export async function calendarLoader({ request }: LoaderFunctionArgs) {
	const params = new URL(request.url).searchParams
	const month = params.get("month") ?? currentMonth()
	const account = params.get("account") ?? "feerasta"
	return { ...(await window.calendar.list(account, month)), month }
}

function plainDescription(html: string) {
	return (
		new DOMParser().parseFromString(
			html.replace(/<br\s*\/?\s*>|<\/(?:p|div|li)>/gi, "\n"),
			"text/html",
		).body.textContent ?? ""
	)
}

export function CalendarView() {
	const { events, timeZone, month } = useLoaderData() as CalendarPage & { month: string }
	const [params] = useSearchParams()
	const account = params.get("account") ?? "feerasta"
	const accountSuffix = `&${new URLSearchParams({ account })}`
	const navigation = useNavigation()
	const revalidator = useRevalidator()
	const selected = events.find((event) => event.id === params.get("event"))
	const groups = groupCalendarEvents(events, timeZone)
	const monthTitle = new Intl.DateTimeFormat(undefined, {
		month: "long",
		year: "numeric",
	}).format(civilDate(`${month}-01`))
	return (
		<div className={`calendar-workspace ${selected ? "has-selection" : ""}`}>
			<section
				className="calendar-agenda"
				aria-label="Calendar agenda"
				aria-busy={navigation.state !== "idle"}
			>
				<header className="calendar-heading">
					<div>
						<h1>{monthTitle}</h1>
						<p>All calendars · {timeZone.replaceAll("_", " ")}</p>
					</div>
					<div className="calendar-controls">
						<Link
							className="calendar-month-arrow"
							to={`${monthLink(month, -1)}${accountSuffix}`}
							aria-label="Previous month"
						>
							<ChevronLeft size={18} />
						</Link>
						<Link
							className="calendar-today"
							to={`?month=${currentMonth()}${accountSuffix}`}
						>
							Today
						</Link>
						<Link
							className="calendar-month-arrow"
							to={`${monthLink(month, 1)}${accountSuffix}`}
							aria-label="Next month"
						>
							<ChevronRight size={18} />
						</Link>
						<Button
							variant="outline"
							size="sm"
							disabled={revalidator.state !== "idle"}
							onClick={async () => {
								await window.calendar.refresh()
								revalidator.revalidate()
							}}
						>
							{revalidator.state !== "idle" ? "Refreshing…" : "Refresh"}
						</Button>
					</div>
				</header>
				<div className="calendar-days">
					{groups.map(([day, group]) => (
						<section
							className="calendar-day"
							key={day}
						>
							<h2>
								<span>
									{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
										civilDate(day),
									)}
								</span>
								<strong>{civilDate(day).getDate()}</strong>
							</h2>
							<div className="calendar-day-events">
								{group.map((event) => (
									<Link
										className={`calendar-event-row ${selected?.id === event.id ? "is-active" : ""}`}
										key={event.id}
										to={`?${new URLSearchParams({ account, event: event.id, month })}`}
									>
										<time>{eventTime(event, timeZone)}</time>
										<div>
											<h3>{event.summary || "Untitled event"}</h3>
											<p>{event.calendarNames?.join(" · ")}</p>
											{event.location && <p>{event.location}</p>}
										</div>
									</Link>
								))}
							</div>
						</section>
					))}
					{events.length === 0 && (
						<div className="calendar-no-events">
							<CalendarDays
								size={24}
								strokeWidth={1.5}
							/>
							<h2>A clear calendar.</h2>
							<p>No events this month.</p>
						</div>
					)}
				</div>
			</section>
			<main
				className="calendar-detail"
				aria-label="Event details"
			>
				{selected ? (
					<article className="calendar-event-detail">
						<Link
							className="calendar-back"
							to={`?month=${month}${accountSuffix}`}
						>
							← Calendar
						</Link>
						<header>
							<h2>{selected.summary || "Untitled event"}</h2>
							<p>{eventDate(selected, timeZone)}</p>
						</header>
						<dl>
							<dt>Calendar</dt>
							<dd>{selected.calendarNames?.join(" · ")}</dd>
							{selected.location && (
								<>
									<dt>Location</dt>
									<dd>{selected.location}</dd>
								</>
							)}
							{selected.hangoutLink && (
								<>
									<dt>Video call</dt>
									<dd>{selected.hangoutLink}</dd>
								</>
							)}
							{selected.organizer && (
								<>
									<dt>Organizer</dt>
									<dd>{selected.organizer.displayName || selected.organizer.email}</dd>
								</>
							)}
							{selected.attendees && selected.attendees.length > 0 && (
								<>
									<dt>Guests</dt>
									<dd>
										<ul className="calendar-guests">
											{selected.attendees.map((attendee) => (
												<li key={attendee.email}>
													<span>
														{attendee.displayName || attendee.email}
														{attendee.self ? " (you)" : ""}
													</span>
													{attendee.responseStatus && (
														<small>
															{attendee.responseStatus.replace(
																"needsAction",
																"Awaiting response",
															)}
														</small>
													)}
												</li>
											))}
										</ul>
									</dd>
								</>
							)}
						</dl>
						{selected.description && (
							<section className="calendar-description">
								<h3>Details</h3>
								<p>{plainDescription(selected.description)}</p>
							</section>
						)}
					</article>
				) : (
					<div className="reader-empty">
						<span className="empty-rule" />
						<h2>Your time, in view.</h2>
						<p>Select an event to read its details.</p>
					</div>
				)}
			</main>
		</div>
	)
}

export function LoadingCalendar() {
	const [params] = useSearchParams()
	const account = getAccount(params.get("account") ?? "feerasta")
	return (
		<main
			className="reader-empty"
			role="status"
		>
			<h2>Opening your calendar…</h2>
			<p>Getting events from {account.email}.</p>
		</main>
	)
}

export function CalendarError() {
	const error = useRouteError()
	return (
		<main
			className="reader-empty"
			role="alert"
		>
			<h2>Calendar couldn’t load.</h2>
			<p>{error instanceof Error ? error.message : "The calendar request failed."}</p>
			<Button onClick={() => window.location.reload()}>Try again</Button>
		</main>
	)
}
