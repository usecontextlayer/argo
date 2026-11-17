import { singleConnectionAccounts } from "@/accounts"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { GranolaMeeting, GranolaTranscript } from "@/granola"
import { Document } from "./document"
import { SourceIdentity, Timestamp } from "./primitives"
import { RichText } from "./rich-text"

export type MeetingSection = "summary" | "notes" | "transcript"

export function MeetingNotes({
	meeting,
	section,
	transcript,
	onSectionChange,
}: {
	meeting: GranolaMeeting
	section: MeetingSection
	transcript?: GranolaTranscript | null
	onSectionChange: (section: MeetingSection) => void
}) {
	return (
		<Document
			title={meeting.title}
			identity={
				<SourceIdentity
					provider="granola"
					account={singleConnectionAccounts.granola}
				/>
			}
			meta={
				<>
					<Timestamp value={meeting.date} />
					{meeting.participants && <span> · {meeting.participants}</span>}
				</>
			}
		>
			<Tabs
				value={section}
				onValueChange={(value) => onSectionChange(value as MeetingSection)}
			>
				<TabsList
					variant="line"
					aria-label="Meeting content"
				>
					<TabsTrigger value="summary">Summary</TabsTrigger>
					<TabsTrigger value="notes">My notes</TabsTrigger>
					{meeting.transcriptAvailable && (
						<TabsTrigger value="transcript">Transcript</TabsTrigger>
					)}
				</TabsList>
				<TabsContent value="summary">
					<RichText text={meeting.summary || "No summary available."} />
				</TabsContent>
				<TabsContent value="notes">
					<RichText text={meeting.notes || "No private notes."} />
				</TabsContent>
				<TabsContent value="transcript">
					<div className="whitespace-pre-wrap text-sm leading-relaxed wrap-anywhere">
						{transcript?.transcript || "No transcript available."}
					</div>
					{transcript?.truncated && (
						<p className="mt-6 text-sm text-muted-foreground">
							Granola returned part of this transcript.
						</p>
					)}
				</TabsContent>
			</Tabs>
		</Document>
	)
}
