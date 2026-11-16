import { ChevronDown, ChevronRight } from "lucide-react"
import { type ReactNode, useState } from "react"
import { Link } from "react-router"
import type { WorkflowyNode } from "@/workflowy"
import { Document } from "./document"
import { SourceIdentity } from "./primitives"
import { HtmlContent } from "./rich-text"
import "./chat-outline.css"

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
		<li className="outline-branch">
			<div
				className={`outline-line ${target === node.id ? "outline-line-selected" : ""}`}
			>
				{expandable ? (
					<button
						className="outline-disclosure"
						type="button"
						aria-label={`${open ? "Collapse" : "Expand"} entry`}
						aria-expanded={open}
						onClick={() => setOpen(!open)}
					>
						{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
					</button>
				) : (
					<span className="outline-disclosure" />
				)}
				{nodeHref ? (
					<Link
						className="outline-bullet"
						to={nodeHref(node.id)}
						aria-label="Open entry"
					/>
				) : (
					<span className="outline-bullet" />
				)}
				<div className="outline-text">
					<HtmlContent html={node.text || "Untitled entry"} />
				</div>
				{!expandable && node.children > 0 && nodeHref && (
					<Link
						className="outline-count"
						to={nodeHref(node.id)}
					>
						{node.children}
						<ChevronRight
							size={14}
							aria-hidden="true"
						/>
					</Link>
				)}
			</div>
			{open && expandable && (
				<ul>
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
		<div className="presentation-outline">
			<ul>
				{buildTree(nodes).map((entry) => (
					<OutlineBranch
						key={entry.node.id}
						entry={entry}
						target={target}
						nodeHref={nodeHref}
					/>
				))}
			</ul>
			{nodes.length === 0 && <p className="empty-list">No entries inside.</p>}
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
					account="Personal"
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
