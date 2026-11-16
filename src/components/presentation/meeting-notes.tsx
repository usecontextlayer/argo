import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { GranolaMeeting, GranolaTranscript } from "@/granola"
import { singleConnectionAccounts } from "@/provider-identity"
import { Document } from "./document"
import { SourceIdentity, Timestamp } from "./primitives"
import { RichText } from "./rich-text"
import "./documents.css"

export type MeetingSection = "summary" | "notes" | "transcript"

export function MeetingNotes({
	meeting,
	section,
	transcript,
	onSectionChange,
	account = singleConnectionAccounts.granola,
}: {
	meeting: GranolaMeeting
	section?: MeetingSection
	transcript?: GranolaTranscript | null
	onSectionChange?: (section: MeetingSection) => void
	account?: string
}) {
	const [localSection, setLocalSection] = useState<MeetingSection>("summary")
	const selected = section ?? localSection
	return (
		<Document
			title={meeting.title}
			identity={
				<SourceIdentity
					provider="granola"
					account={account}
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
				value={selected}
				onValueChange={(value) => {
					const next = value as MeetingSection
					setLocalSection(next)
					onSectionChange?.(next)
				}}
			>
				<TabsList
					variant="line"
					aria-label="Meeting content"
				>
					<TabsTrigger value="summary">Summary</TabsTrigger>
					<TabsTrigger value="notes">My notes</TabsTrigger>
					{meeting.transcriptAvailable && (transcript || onSectionChange) && (
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
					<div className="document-plain-text">
						{transcript?.transcript || "No transcript available."}
					</div>
					{transcript?.truncated && (
						<p className="document-source-note">
							Granola returned part of this transcript.
						</p>
					)}
				</TabsContent>
			</Tabs>
		</Document>
	)
}
