import { Accordion } from "@base-ui/react/accordion"
import { ArrowUpRight, ChevronDown } from "lucide-react"
import {
	Link,
	useLoaderData,
	useRevalidator,
	useRouteError,
	useSearchParams,
} from "react-router"
import { Button } from "@/components/ui/button"
import { type Doable, sourceHref } from "@/doables"
import "./doables.css"

const sourceNames = {
	calendar: "Calendar",
	granola: "Granola",
	mail: "Mail",
	teams: "Teams",
	whatsapp: "WhatsApp",
	workflowy: "Workflowy",
}

const statusNames = { done: "Done", open: "Open", rejected: "Rejected" }

export function doablesLoader() {
	return window.doables.list()
}

export function DoablesView() {
	const doables = useLoaderData() as Doable[]
	const [params, setParams] = useSearchParams()
	const revalidator = useRevalidator()
	const selected = params.get("doable")
	return (
		<main className="doables-workspace">
			<div className="doables-content">
				<header className="doables-heading">
					<div>
						<h1>Doables</h1>
						<p>
							{doables.length} {doables.length === 1 ? "doable" : "doables"} discovered
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						disabled={revalidator.state !== "idle"}
						onClick={() => revalidator.revalidate()}
					>
						{revalidator.state !== "idle" ? "Refreshing…" : "Refresh"}
					</Button>
				</header>
				<Accordion.Root
					className="doables-list"
					aria-label="Discovered doables"
					value={selected ? [selected] : []}
					onValueChange={(value) => {
						const next = new URLSearchParams(params)
						if (value[0]) next.set("doable", value[0])
						else next.delete("doable")
						setParams(next, { preventScrollReset: true })
					}}
				>
					{doables.map((doable) => (
						<Accordion.Item
							className="doable-item"
							key={doable.id}
							value={doable.id}
						>
							<Accordion.Header className="doable-header">
								<Accordion.Trigger className="doable-trigger">
									<span className="doable-summary">
										<span className="doable-title">{doable.title}</span>
										<span className="doable-meta">
											{statusNames[doable.status]} · {doable.context.length}{" "}
											{doable.context.length === 1 ? "reference" : "references"}
										</span>
									</span>
									<ChevronDown
										className="doable-chevron"
										size={20}
										aria-hidden="true"
									/>
								</Accordion.Trigger>
							</Accordion.Header>
							<Accordion.Panel className="doable-panel">
								<div className="doable-detail">
									<section
										className="doable-section"
										aria-label="What needs doing"
									>
										<p>{doable.description}</p>
									</section>
									<section className="doable-section">
										<h3>Why this exists</h3>
										<p>{doable.rationale}</p>
									</section>
									<section className="doable-section">
										<h3>Source context</h3>
										<ul className="doable-references">
											{doable.context.map((reference) => (
												<li key={sourceHref(reference)}>
													<Link to={sourceHref(reference)}>
														<span className="doable-reference-content">
															<span className="doable-reference-source">
																{sourceNames[reference.source]}
															</span>
															<span>{reference.label}</span>
														</span>
														<ArrowUpRight
															size={16}
															aria-hidden="true"
														/>
													</Link>
												</li>
											))}
										</ul>
									</section>
								</div>
							</Accordion.Panel>
						</Accordion.Item>
					))}
				</Accordion.Root>
				{doables.length === 0 && (
					<p className="empty-list">
						Doables will appear here when the novelty agent finds work in your sources.
						Refresh to load its results.
					</p>
				)}
			</div>
		</main>
	)
}

export function LoadingDoables() {
	return (
		<main
			className="reader-empty"
			role="status"
		>
			<h2>Opening doables…</h2>
			<p>Reading the novelty agent’s discoveries.</p>
		</main>
	)
}

export function DoablesError() {
	const error = useRouteError()
	const revalidator = useRevalidator()
	return (
		<main
			className="reader-empty"
			role="alert"
		>
			<h2>Doables couldn’t load.</h2>
			<p>
				{error instanceof Error ? error.message : "The doable files could not be read."}
			</p>
			<Button onClick={() => revalidator.revalidate()}>Try again</Button>
		</main>
	)
}
