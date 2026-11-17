import { getSchema, type JSONContent } from "@tiptap/core"
import { generateJSON } from "@tiptap/html"
import StarterKit from "@tiptap/starter-kit"
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string"
import { Marked } from "marked"
import { defaultMarkdownSerializer, MarkdownSerializer } from "prosemirror-markdown"

export type EditorDocument = JSONContent

export const editorExtensions = [
	StarterKit.configure({
		horizontalRule: false,
		link: { markdownLinks: true, openOnClick: false },
		underline: false,
	}),
]

const schema = getSchema(editorExtensions)

export function emptyDocument(): EditorDocument {
	return { content: [{ type: "paragraph" }], type: "doc" }
}

export function parseEditorDocument(value: unknown): EditorDocument {
	const document = schema.nodeFromJSON(value)
	if (document.type !== schema.topNodeType)
		throw new Error("Editor content must be a document")
	document.check()
	return document.toJSON()
}

export function htmlToDocument(html: string): EditorDocument {
	return generateJSON(html, editorExtensions)
}

export function documentToHtml(content: EditorDocument): string {
	return renderToHTMLString({ content, extensions: editorExtensions })
}

function renderText(content: EditorDocument, whatsapp: boolean): string {
	const nodes = defaultMarkdownSerializer.nodes as Record<
		"blockquote" | "paragraph" | "list_item",
		MarkdownSerializer["nodes"][string]
	>
	const format = (delimiter: string) => ({
		close: whatsapp ? delimiter : "",
		expelEnclosingWhitespace: true,
		mixable: true,
		open: whatsapp ? delimiter : "",
	})
	const serializer = new MarkdownSerializer(
		{
			blockquote: nodes.blockquote,
			bulletList: (state, node) => state.renderList(node, "  ", () => "- "),
			codeBlock: (state, node) => {
				if (whatsapp) state.write("```\n")
				state.text(node.textContent, false)
				if (whatsapp) state.write("\n```")
				state.closeBlock(node)
			},
			hardBreak: (state) => state.write("\n"),
			heading: nodes.paragraph,
			listItem: nodes.list_item,
			orderedList: (state, node) => {
				const start = node.attrs.start
				const width = String(start + node.childCount - 1).length
				state.renderList(node, " ".repeat(width + 2), (index) => `${start + index}. `)
			},
			paragraph: nodes.paragraph,
			text: (state, node) => state.text(node.text ?? "", false),
		},
		{
			bold: format("*"),
			code: { close: whatsapp ? "`" : "", escape: false, open: whatsapp ? "`" : "" },
			italic: format("_"),
			link: {
				close: (_state, mark, parent, index) =>
					parent.child(index - 1).text === mark.attrs.href ? "" : ` (${mark.attrs.href})`,
				open: "",
			},
			strike: format("~"),
		},
		{ hardBreakNodeName: "hardBreak" },
	)
	return serializer.serialize(schema.nodeFromJSON(content), { tightLists: true })
}

export function documentToText(document: EditorDocument): string {
	return renderText(document, false)
}

export function documentToWhatsApp(document: EditorDocument): string {
	return renderText(document, true)
}

function escapeHtml(text: string): string {
	return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

const whatsapp = new Marked({
	breaks: true,
	renderer: {
		del({ tokens }) {
			return `<s>${this.parser.parseInline(tokens)}</s>`
		},
		text(token) {
			return "tokens" in token && token.tokens
				? this.parser.parseInline(token.tokens)
				: escapeHtml(token.text)
		},
	},
	tokenizer: {
		autolink: () => undefined,
		code: () => undefined,
		def: () => undefined,
		del(source, _masked, previous = "") {
			if (/[\p{L}\p{N}]/u.test(previous)) return
			const match = /^~(?=\S)([^~\n]*?\S)~(?![\p{L}\p{N}])/u.exec(source)
			if (match)
				return {
					raw: match[0],
					text: match[1] as string,
					tokens: this.lexer.inlineTokens(match[1] as string),
					type: "del",
				}
		},
		emStrong(source, _masked, previous = "") {
			if (/[\p{L}\p{N}]/u.test(previous)) return
			const match = /^([*_])(?=\S)([^\n]*?\S)\1(?![\p{L}\p{N}])/u.exec(source)
			if (match)
				return {
					raw: match[0],
					text: match[2] as string,
					tokens: this.lexer.inlineTokens(match[2] as string),
					type: match[1] === "*" ? "strong" : "em",
				}
		},
		escape: () => undefined,
		heading: () => undefined,
		hr: () => undefined,
		html: () => undefined,
		lheading: () => undefined,
		link: () => undefined,
		reflink: () => undefined,
		table: () => undefined,
		tag: () => undefined,
		url: () => undefined,
	},
})

export function whatsAppToHtml(text: string): string {
	return whatsapp.parse(text, { async: false })
}
