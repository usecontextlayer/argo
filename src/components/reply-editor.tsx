import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import {
	Bold,
	Code,
	Italic,
	Link,
	List,
	ListOrdered,
	Quote,
	Strikethrough,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { type EditorDocument, editorExtensions } from "@/editor"

export function ReplyEditor({
	content,
	onChange,
	onSend,
	sendOnEnter,
	disabled = false,
}: {
	content: EditorDocument
	onChange: (document: EditorDocument) => void
	onSend: () => void
	sendOnEnter: boolean
	disabled?: boolean
}) {
	const current = useRef({ disabled, onChange, onSend, sendOnEnter })
	current.current = { disabled, onChange, onSend, sendOnEnter }
	const [linkUrl, setLinkUrl] = useState<string | null>(null)
	const editor = useEditor({
		content,
		editorProps: {
			attributes: {
				"aria-label": "Reply message",
				"aria-multiline": "true",
				class:
					"min-h-28 px-3 py-3 text-sm leading-relaxed outline-none [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_code]:font-mono [&_a]:underline [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold",
				role: "textbox",
			},
			handleKeyDown: (view, event) => {
				if (event.key !== "Enter" || event.isComposing || view.composing) return false
				if (event.shiftKey) return false
				if (
					!event.metaKey &&
					(!current.current.sendOnEnter || event.altKey || event.ctrlKey)
				)
					return false
				event.preventDefault()
				if (!current.current.disabled && view.state.doc.textContent.trim())
					current.current.onSend()
				return true
			},
		},
		extensions: editorExtensions,
		onUpdate: ({ editor }) => {
			current.current.onChange(editor.getJSON())
		},
		shouldRerenderOnTransaction: false,
	})
	useEffect(() => {
		if (editor && !editor.state.doc.eq(editor.schema.nodeFromJSON(content))) {
			editor.commands.setContent(content, { emitUpdate: false })
		}
	}, [content, editor])
	useEffect(() => {
		editor?.setEditable(!disabled, false)
	}, [disabled, editor])
	const state = useEditorState({
		editor,
		selector: ({ editor }) => ({
			bold: editor?.isActive("bold") ?? false,
			code: editor?.isActive("code") ?? false,
			italic: editor?.isActive("italic") ?? false,
			link: editor?.isActive("link") ?? false,
			list: editor?.isActive("bulletList") ?? false,
			ordered: editor?.isActive("orderedList") ?? false,
			quote: editor?.isActive("blockquote") ?? false,
			strike: editor?.isActive("strike") ?? false,
		}),
	})
	if (!editor) return null
	const tools = [
		{
			active: state?.bold,
			icon: Bold,
			label: "Bold",
			run: () => editor.chain().focus().toggleBold().run(),
		},
		{
			active: state?.italic,
			icon: Italic,
			label: "Italic",
			run: () => editor.chain().focus().toggleItalic().run(),
		},
		{
			active: state?.strike,
			icon: Strikethrough,
			label: "Strikethrough",
			run: () => editor.chain().focus().toggleStrike().run(),
		},
		{
			active: state?.code,
			icon: Code,
			label: "Inline code",
			run: () => editor.chain().focus().toggleCode().run(),
		},
		{
			active: state?.list,
			icon: List,
			label: "Bullet list",
			run: () => editor.chain().focus().toggleBulletList().run(),
		},
		{
			active: state?.ordered,
			icon: ListOrdered,
			label: "Numbered list",
			run: () => editor.chain().focus().toggleOrderedList().run(),
		},
		{
			active: state?.quote,
			icon: Quote,
			label: "Blockquote",
			run: () => editor.chain().focus().toggleBlockquote().run(),
		},
		{
			active: state?.link,
			icon: Link,
			label: "Link",
			run: () => {
				setLinkUrl(editor.getAttributes("link").href ?? "https://")
			},
		},
	]
	return (
		<div className="overflow-hidden rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring/50">
			<fieldset className="flex min-w-0 flex-wrap gap-1 border-0 border-b px-2 py-1">
				<legend className="sr-only">Text formatting</legend>
				{tools.map(({ active, icon: Icon, label, run }) => (
					<Button
						aria-label={label}
						aria-pressed={active}
						disabled={disabled}
						key={label}
						onClick={run}
						size="icon-sm"
						title={label}
						type="button"
						variant={active ? "secondary" : "ghost"}
					>
						<Icon aria-hidden="true" />
					</Button>
				))}
			</fieldset>
			{linkUrl !== null && (
				<form
					className="flex flex-wrap items-center gap-2 border-b p-2"
					onSubmit={(event) => {
						event.preventDefault()
						if (linkUrl.trim())
							editor
								.chain()
								.focus()
								.extendMarkRange("link")
								.setLink({ href: linkUrl.trim() })
								.run()
						else editor.chain().focus().extendMarkRange("link").unsetLink().run()
						setLinkUrl(null)
					}}
				>
					<input
						aria-label="Link URL"
						className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
						disabled={disabled}
						onChange={(event) => setLinkUrl(event.target.value)}
						type="url"
						value={linkUrl}
					/>
					<Button
						disabled={disabled}
						size="sm"
						type="submit"
					>
						Apply
					</Button>
					<Button
						onClick={() => setLinkUrl(null)}
						size="sm"
						type="button"
						variant="ghost"
					>
						Cancel
					</Button>
				</form>
			)}
			<EditorContent editor={editor} />
		</div>
	)
}
