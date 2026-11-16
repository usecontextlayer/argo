import { Accordion } from "@base-ui/react/accordion"
import { ChevronDown } from "lucide-react"
import {
	useLoaderData,
	useRevalidator,
	useRouteError,
	useSearchParams,
} from "react-router"
import { Preview, ProviderIcon } from "@/components/presentation/primitives"
import { Button } from "@/components/ui/button"
import { DoableDocument } from "@/doable-document"
import type { Doable } from "@/doables"
import { sourceProvider } from "@/source-item"
import "./doables.css"

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
									<Preview
										title={doable.title}
										meta={`${statusNames[doable.status]} · ${doable.context.length} references`}
										identity={
											<span className="doable-providers">
												{[...new Set(doable.context.map(sourceProvider))].map(
													(provider) => (
														<ProviderIcon
															key={provider}
															provider={provider}
															size={16}
														/>
													),
												)}
											</span>
										}
									/>
									<ChevronDown
										className="doable-chevron"
										size={20}
										aria-hidden="true"
									/>
								</Accordion.Trigger>
							</Accordion.Header>
							<Accordion.Panel className="doable-panel">
								<div className="doable-detail">
									<DoableDocument doable={doable} />
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
