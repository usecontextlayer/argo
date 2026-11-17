import { ChevronDown, ChevronRight } from "lucide-react"
import { type ReactNode, useState } from "react"
import { Link } from "react-router"
import { singleConnectionAccounts } from "@/accounts"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { WorkflowyNode } from "@/workflowy"
import { Document } from "./document"
import { SourceIdentity } from "./primitives"
import { HtmlContent } from "./rich-text"

type TreeNode = { node: WorkflowyNode; children: TreeNode[] }

function buildTree(nodes: WorkflowyNode[]) {
	const roots: TreeNode[] = []
	const ancestors: TreeNode[] = []
	for (const node of nodes) {
		const entry: TreeNode = { children: [], node }
		let parent = ancestors.at(-1)
		while (parent && parent.node.depth >= node.depth) {
			ancestors.pop()
			parent = ancestors.at(-1)
		}
		if (parent) parent.children.push(entry)
		else roots.push(entry)
		ancestors.push(entry)
	}
	return roots
}

function OutlineBranch({
	entry,
	nodeHref,
	target,
}: {
	entry: TreeNode
	nodeHref?: (id: string) => string
	target?: string
}) {
	const [open, setOpen] = useState(true)
	const { node, children } = entry
	const expandable = children.length > 0
	return (
		<li>
			<div className="flex items-start gap-2 py-1">
				{expandable ? (
					<Button
						variant="ghost"
						size="icon-xs"
						className="shrink-0 text-muted-foreground"
						type="button"
						aria-label={`${open ? "Collapse" : "Expand"} entry`}
						aria-expanded={open}
						onClick={() => setOpen(!open)}
					>
						{open ? (
							<ChevronDown className="size-3.5" />
						) : (
							<ChevronRight className="size-3.5" />
						)}
					</Button>
				) : (
					<span className="size-6 shrink-0" />
				)}
				{nodeHref ? (
					<Link
						className="flex h-6 w-2 shrink-0 items-center justify-center rounded-sm before:size-1.5 before:rounded-full before:bg-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						to={nodeHref(node.id)}
						aria-label="Open entry"
					/>
				) : (
					<span className="flex h-6 w-2 shrink-0 items-center justify-center before:size-1.5 before:rounded-full before:bg-muted-foreground" />
				)}
				<div
					className={cn(
						"min-w-0 flex-1 [&_p]:my-0",
						target === node.id && "font-semibold",
					)}
				>
					<HtmlContent html={node.text || "Untitled entry"} />
				</div>
				{!expandable && node.children > 0 && nodeHref && (
					<Link
						className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
						to={nodeHref(node.id)}
					>
						{node.children}
						<ChevronRight
							className="size-3.5"
							aria-hidden="true"
						/>
					</Link>
				)}
			</div>
			{open && expandable && (
				<ul className="ml-3 border-l pl-6">
					{children.map((child) => (
						<OutlineBranch
							key={child.node.id}
							entry={child}
							nodeHref={nodeHref}
							target={target}
						/>
					))}
				</ul>
			)}
		</li>
	)
}

export function Outline({
	nodes,
	target,
	nodeHref,
}: {
	nodes: WorkflowyNode[]
	target?: string
	nodeHref?: (id: string) => string
}) {
	return (
		<div className="text-sm leading-relaxed wrap-anywhere">
			<ul className="m-0 list-none p-0">
				{buildTree(nodes).map((entry) => (
					<OutlineBranch
						key={entry.node.id}
						entry={entry}
						target={target}
						nodeHref={nodeHref}
					/>
				))}
			</ul>
			{nodes.length === 0 && (
				<p className="my-5 text-sm text-muted-foreground">No entries inside.</p>
			)}
		</div>
	)
}

export function WorkflowyDocument({
	nodes,
	target,
	nodeHref,
	actions,
	children,
}: {
	nodes: WorkflowyNode[]
	target?: string
	nodeHref?: (id: string) => string
	actions?: ReactNode
	children?: ReactNode
}) {
	return (
		<Document
			title="Workflowy"
			identity={
				<SourceIdentity
					provider="workflowy"
					account={singleConnectionAccounts.workflowy}
				/>
			}
			actions={actions}
		>
			<Outline
				nodes={nodes}
				target={target}
				nodeHref={nodeHref}
			/>
			{children}
		</Document>
	)
}
