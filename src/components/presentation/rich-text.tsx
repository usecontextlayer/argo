import DOMPurify from "dompurify"
import Markdown from "react-markdown"

const proseClasses =
	"max-w-prose text-sm leading-relaxed wrap-anywhere [&_h1]:mt-6 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h4]:mt-6 [&_h4]:mb-2 [&_h4]:font-semibold [&_h5]:mt-6 [&_h5]:mb-2 [&_h5]:font-semibold [&_h6]:mt-6 [&_h6]:mb-2 [&_h6]:font-semibold [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:my-4 [&_blockquote]:border-l [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_time]:rounded-md [&_time]:bg-muted [&_time]:px-1.5 [&_time]:py-0.5 [&_time]:text-xs [&_time]:text-muted-foreground"

export function RichText({ text }: { text: string }) {
	return (
		<div className={proseClasses}>
			<Markdown skipHtml>{text}</Markdown>
		</div>
	)
}

export function SafeHtml({ html, title }: { html: string; title: string }) {
	const document = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none';"><style>body{margin:0;padding:0;font:1rem/1.5 Arial,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}</style></head><body>${html}</body></html>`
	return (
		<iframe
			className="block h-96 w-full border-0 bg-white"
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
			className={proseClasses}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: DOMPurify owns HTML sanitization at this boundary.
			dangerouslySetInnerHTML={{ __html: clean }}
		/>
	)
}
