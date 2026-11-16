import { ArrowLeft, Home } from "lucide-react"
import {
	Link,
	type LoaderFunctionArgs,
	useLoaderData,
	useNavigate,
	useNavigation,
	useRevalidator,
	useRouteError,
} from "react-router"
import { WorkflowyDocument } from "@/components/presentation/outline"
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
			className="workflowy-reader"
			aria-busy={navigation.state !== "idle"}
		>
			<header className="workflowy-toolbar">
				<nav
					className="workflowy-navigation"
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
						className="workflowy-home"
					>
						<Home size={15} /> Home
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
			<WorkflowyDocument
				nodes={nodes}
				target={target}
				nodeHref={(id) => `?${new URLSearchParams({ node: id })}`}
			>
				{selected && selected.children > children.length && (
					<Link
						className="workflowy-more"
						to={`?${new URLSearchParams({ limit: String(limit + 50), node: target })}`}
					>
						Show more entries
					</Link>
				)}
			</WorkflowyDocument>
		</main>
	)
}

export function LoadingWorkflowy() {
	return (
		<main
			className="reader-empty"
			role="status"
		>
			<h2>Opening Workflowy…</h2>
			<p>Reading your outline.</p>
		</main>
	)
}

export function WorkflowyError() {
	const error = useRouteError()
	return (
		<main
			className="reader-empty"
			role="alert"
		>
			<h2>Workflowy couldn’t load.</h2>
			<p>{error instanceof Error ? error.message : "The Workflowy read failed."}</p>
			<Button onClick={() => window.location.reload()}>Try again</Button>
		</main>
	)
}
