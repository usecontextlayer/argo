import { Document, DocumentSection } from "@/components/presentation/document"
import { Disclosure } from "@/components/presentation/primitives"
import type { Doable } from "@/doables"
import { SourceItem } from "@/source-item"
import { sourceHref } from "@/source-reference"

export function DoableDocument({ doable }: { doable: Doable }) {
	return (
		<Document
			title={doable.title}
			meta={`${doable.status} · ${doable.context.length} references`}
		>
			<p>{doable.description}</p>
			<Disclosure title="Why this exists">
				<p>{doable.rationale}</p>
			</Disclosure>
			<DocumentSection title="Context">
				{doable.context.map((reference) => (
					<SourceItem
						key={sourceHref(reference)}
						reference={reference}
					/>
				))}
			</DocumentSection>
		</Document>
	)
}
