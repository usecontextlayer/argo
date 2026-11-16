import DOMPurify from "dompurify"
import Markdown from "react-markdown"
import "./presentation.css"

export function RichText({ text }: { text: string }) {
	return (
		<div className="presentation-prose">
			<Markdown skipHtml>{text}</Markdown>
		</div>
	)
}

export function SafeHtml({ html, title }: { html: string; title: string }) {
	const document = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none';"><style>body{margin:0;padding:0;font:15px/1.75 Arial,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}</style></head><body>${html}</body></html>`
	return (
		<iframe
			className="presentation-html"
			title={title}
			sandbox=""
			referrerPolicy="no-referrer"
			srcDoc={document}
		/>
	)
}

export function HtmlContent({ html }: { html: string }) {
	const clean = DOMPurify.sanitize(html, {
		FORBID_ATTR: ["style", "class", "id"],
		FORBID_TAGS: [
			"style",
			"img",
			"audio",
			"video",
			"source",
			"form",
			"input",
			"button",
			"textarea",
			"select",
		],
		USE_PROFILES: { html: true },
	})
	return (
		<div
			className="presentation-html-content"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: DOMPurify owns HTML sanitization at this boundary.
			dangerouslySetInnerHTML={{ __html: clean }}
		/>
	)
}
