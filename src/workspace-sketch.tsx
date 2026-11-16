import { ArrowLeft } from "lucide-react"
import { Link, useLoaderData, useSearchParams } from "react-router"
import { Preview, ProviderIcon } from "@/components/presentation/primitives"
import { DoableDocument } from "@/doable-document"
import type { Doable } from "@/doables"
import { sourceProvider } from "@/source-item"
import "./workspace-sketch.css"

export function workspaceSketchLoader() {
	return window.doables.list()
}

export function WorkspaceSketch() {
	const doables = useLoaderData() as Doable[]
	const [params, setParams] = useSearchParams()
	const sorted = [...doables].sort(
		(a, b) =>
			new Set(b.context.map((item) => item.source)).size -
			new Set(a.context.map((item) => item.source)).size,
	)
	const selected = doables.find((item) => item.id === params.get("doable")) ?? sorted[0]
	return (
		<main className="sketch-workspace">
			<aside className="sketch-sidebar">
				<div className="sketch-sidebar-heading">
					<Link
						to="/doables"
						aria-label="Back to Doables"
					>
						<ArrowLeft size={18} />
					</Link>
					<h1>Workspace sketch</h1>
				</div>
				<p className="sketch-sidebar-note">
					The shared presentations, with your source context.
				</p>
				<nav aria-label="Choose a doable">
					{sorted.map((doable) => (
						<button
							type="button"
							className={`sketch-doable-row ${doable.id === selected?.id ? "is-selected" : ""}`}
							key={doable.id}
							onClick={() => setParams({ doable: doable.id })}
						>
							<Preview
								title={doable.title}
								meta={`${doable.context.length} references`}
								identity={
									<span className="sketch-doable-sources">
										{[...new Set(doable.context.map(sourceProvider))].map((provider) => (
											<ProviderIcon
												key={provider}
												provider={provider}
												size={16}
											/>
										))}
									</span>
								}
							/>
						</button>
					))}
				</nav>
			</aside>
			<div className="sketch-reader">
				{selected && (
					<DoableDocument
						key={selected.id}
						doable={selected}
					/>
				)}
			</div>
		</main>
	)
}
