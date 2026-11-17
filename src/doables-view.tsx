import {
	useLoaderData,
	useRevalidator,
	useRouteError,
	useSearchParams,
} from "react-router"
import { Preview, ProviderIcon } from "@/components/presentation/primitives"
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { DoableDocument } from "@/doable-document"
import type { Doable } from "@/doables"
import { sourceProvider } from "@/provider-identity"

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
		<main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6 @4xl/content:p-10">
			<div className="mx-auto max-w-5xl">
				<header className="mb-8 flex items-start justify-between gap-6">
					<div>
						<h1 className="mb-2 text-3xl font-semibold tracking-tight">Doables</h1>
						<p className="text-sm text-muted-foreground">
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
				<Accordion
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
						<AccordionItem
							key={doable.id}
							value={doable.id}
						>
							<AccordionTrigger className="items-center gap-4 py-6">
								<Preview
									title={doable.title}
									meta={`${statusNames[doable.status]} · ${doable.context.length} references`}
									identity={
										<span className="inline-flex items-center gap-2">
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
							</AccordionTrigger>
							<AccordionContent className="pb-6">
								<DoableDocument doable={doable} />
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
				{doables.length === 0 && (
					<p className="py-6 text-sm text-muted-foreground">
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
			className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
			role="status"
		>
			<h2 className="text-xl font-semibold">Opening doables…</h2>
			<p className="text-sm text-muted-foreground">
				Reading the novelty agent’s discoveries.
			</p>
		</main>
	)
}

export function DoablesError() {
	const error = useRouteError()
	const revalidator = useRevalidator()
	return (
		<main
			className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
			role="alert"
		>
			<h2 className="text-xl font-semibold">Doables couldn’t load.</h2>
			<p className="text-sm text-muted-foreground">
				{error instanceof Error ? error.message : "The doable files could not be read."}
			</p>
			<Button onClick={() => revalidator.revalidate()}>Try again</Button>
		</main>
	)
}
