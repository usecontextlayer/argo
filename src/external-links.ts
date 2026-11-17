import { shell, type WebContents } from "electron"

function openExternal(url: string) {
	if (["http:", "https:", "mailto:"].includes(new URL(url).protocol))
		void shell.openExternal(url)
}

export function registerExternalLinks(contents: WebContents) {
	contents.on("will-frame-navigate", (event) => {
		if (event.url === "about:blank" || event.url === "about:srcdoc") return
		const destination = new URL(event.url)
		const current = new URL(contents.getURL())
		destination.hash = current.hash = ""
		if (event.isMainFrame && destination.href === current.href) return
		event.preventDefault()
		openExternal(event.url)
	})
	contents.setWindowOpenHandler(({ url }) => {
		openExternal(url)
		return { action: "deny" }
	})
}
