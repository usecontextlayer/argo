import type { FitAddon, Terminal } from "ghostty-web"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

function terminalColor(color: string): string {
	const canvas = document.createElement("canvas")
	canvas.width = canvas.height = 1
	const context = canvas.getContext("2d") as CanvasRenderingContext2D
	context.fillStyle = color
	context.fillRect(0, 0, 1, 1)
	const [red, green, blue] = context.getImageData(0, 0, 1, 1).data
	return `rgb(${red}, ${green}, ${blue})`
}

export function ClaudeTerminal({ active }: { active: boolean }) {
	const hostRef = useRef<HTMLDivElement>(null)
	const terminalRef = useRef<Terminal | null>(null)
	const fitRef = useRef<FitAddon | null>(null)
	const [attempt, setAttempt] = useState(active ? 1 : 0)
	const [opening, setOpening] = useState(true)
	const [notice, setNotice] = useState<string | null>(null)

	useEffect(() => {
		if (active) setAttempt((current) => current || 1)
	}, [active])

	useEffect(() => {
		if (!attempt) return
		const host = hostRef.current
		if (!host) return
		let disposed = false
		const cleanups: (() => void)[] = []
		setOpening(true)
		setNotice(null)

		async function connect(host: HTMLDivElement) {
			const [{ FitAddon, Ghostty, Terminal }, { default: wasmUrl }] = await Promise.all([
				import("ghostty-web"),
				import("ghostty-web/ghostty-vt.wasm?url"),
			])
			const style = getComputedStyle(document.body)
			const background = terminalColor(style.backgroundColor)
			const foreground = terminalColor(style.color)
			const fontFamily = getComputedStyle(host).fontFamily
			const fontSize = 14
			const [ghostty] = await Promise.all([
				Ghostty.load(wasmUrl),
				document.fonts.load(`${fontSize}px ${fontFamily}`),
			])
			if (disposed) return

			const terminal = new Terminal({
				cursorBlink: true,
				fontFamily,
				fontSize,
				ghostty,
				theme: {
					background,
					cursor: foreground,
					foreground,
				},
			})
			const fit = new FitAddon()
			terminal.loadAddon(fit)
			terminal.open(host)
			terminalRef.current = terminal
			fitRef.current = fit
			cleanups.push(() => terminal.dispose())
			fit.fit()
			fit.observeResize()

			terminal.onData((data) => window.terminal.input(data))
			terminal.onResize((size) => window.terminal.resize(size))
			cleanups.push(
				window.terminal.onData((data) => terminal.write(data)),
				window.terminal.onExit((code) => {
					setOpening(false)
					setNotice(code === 0 ? "Claude Code closed." : `Claude Code exited (${code}).`)
				}),
			)
			await window.terminal.open({ cols: terminal.cols, rows: terminal.rows })
			if (disposed) return
			setOpening(false)
			if (host.getBoundingClientRect().width > 0) terminal.focus()
		}

		connect(host).catch((error: unknown) => {
			if (disposed) return
			setOpening(false)
			setNotice(error instanceof Error ? error.message : String(error))
		})
		return () => {
			disposed = true
			for (const cleanup of cleanups.toReversed()) cleanup()
			terminalRef.current = null
			fitRef.current = null
		}
	}, [attempt])

	useEffect(() => {
		if (!active) return
		fitRef.current?.fit()
		terminalRef.current?.focus()
	}, [active])

	return (
		<main
			className={active ? "relative flex min-h-0 min-w-0 flex-1 flex-col p-4" : "hidden"}
			aria-label="Claude"
		>
			{opening && !notice && (
				<p
					className="mb-3 text-sm text-muted-foreground"
					role="status"
				>
					Opening Claude Code…
				</p>
			)}
			{notice && (
				<div
					className="mb-3 flex items-center gap-3 text-sm"
					role="status"
				>
					<span>{notice}</span>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setAttempt((value) => value + 1)}
					>
						Reconnect
					</Button>
				</div>
			)}
			<div
				ref={hostRef}
				className="min-h-0 min-w-0 flex-1 font-mono"
			/>
		</main>
	)
}
