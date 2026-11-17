import { ArrowLeft, Home } from "lucide-react"
import {
	Link,
	type LoaderFunctionArgs,
	useLoaderData,
	useNavigate,
	useNavigation,
	useRevalidator,
} from "react-router"
import { WorkflowyDocument } from "@/components/presentation/outline"
import { SourceError } from "@/components/source-error"
import { Button } from "@/components/ui/button"
import type { WorkflowyPage } from "@/workflowy"

type WorkflowyViewData = WorkflowyPage & { target: string; limit: number }

export async function workflowyLoader({
	request,
}: LoaderFunctionArgs): Promise<WorkflowyViewData> {
	const params = new URL(request.url).searchParams
	const target = params.get("node") ?? "root"
	const limit = Math.max(1, Number(params.get("limit")) || 50)
	return { ...(await window.workflowy.read(target, limit)), limit, target }
}

export function WorkflowyView() {
	const { nodes, target, limit } = useLoaderData() as WorkflowyViewData
	const navigate = useNavigate()
	const navigation = useNavigation()
	const revalidator = useRevalidator()
	const selected = nodes.find((node) => node.id === target)
	const children = nodes.filter(
		(node) => node.id !== target && node.depth === (selected?.depth ?? -1) + 1,
	)
	return (
		<main
			className="min-h-0 min-w-0 flex-1 overflow-y-auto"
			aria-busy={navigation.state !== "idle"}
		>
			<header className="flex items-center justify-between gap-4 border-b px-6 py-4">
				<nav
					className="flex items-center gap-3"
					aria-label="Workflowy navigation"
				>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate(-1)}
						aria-label="Back"
					>
						<ArrowLeft size={16} />
					</Button>
					<Link
						to="?node=root"
						className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
					>
						<Home size={16} /> Home
					</Link>
				</nav>
				<Button
					variant="outline"
					size="sm"
					disabled={revalidator.state !== "idle"}
					onClick={async () => {
						await window.workflowy.refresh()
						revalidator.revalidate()
					}}
				>
					{revalidator.state !== "idle" ? "Refreshing…" : "Refresh"}
				</Button>
			</header>
			<div className="p-6 @4xl/content:p-10">
				<WorkflowyDocument
					nodes={nodes}
					target={target}
					nodeHref={(id) => `?${new URLSearchParams({ node: id })}`}
				>
					{selected && selected.children > children.length && (
						<Link
							className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
							to={`?${new URLSearchParams({ limit: String(limit + 50), node: target })}`}
						>
							Show more entries
						</Link>
					)}
				</WorkflowyDocument>
			</div>
		</main>
	)
}

export function LoadingWorkflowy() {
	return (
		<main
			className="flex min-h-full w-full flex-col items-center justify-center gap-4 p-10 text-center"
			role="status"
		>
			<h2 className="text-xl font-semibold">Opening Workflowy…</h2>
			<p className="max-w-prose text-sm text-muted-foreground">Reading your outline.</p>
		</main>
	)
}

export function WorkflowyError() {
	return (
		<SourceError
			title="Workflowy couldn’t load."
			fallback="The Workflowy read failed."
		/>
	)
}
