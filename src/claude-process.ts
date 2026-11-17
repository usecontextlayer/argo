import { EventEmitter } from "node:events"
import { readdir } from "node:fs/promises"
import path from "node:path"
import { type IPty, spawn } from "node-pty"
import { claudeEnvironment } from "@/env"
import type { TerminalSize } from "@/terminal"

export class ClaudeProcess extends EventEmitter<{
	data: [data: string]
	exit: [code: number]
}> {
	private terminal?: IPty

	constructor(private readonly directory: string) {
		super()
	}

	async open(size: TerminalSize): Promise<void> {
		this.close()
		const { directory } = this
		let continued = false
		try {
			const files = await readdir(path.join(directory, "data/claude/projects/argo"))
			continued = files.some((file) => file.endsWith(".jsonl"))
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
		}
		const terminal = spawn(
			"claude",
			[
				...(continued ? ["--continue"] : ["--name", "Argo"]),
				"--plugin-dir",
				path.join(directory, "plugins/novelty"),
				"--dangerously-load-development-channels",
				"plugin:novelty@inline",
				"--mcp-config",
				path.join(directory, "mcp.json"),
				"--append-system-prompt-file",
				path.join(directory, "agents/novelty.md"),
				"--system-prompt-snapshot",
				"off",
				...(continued
					? []
					: [
							"This is Argo's one foreground novelty session. Briefly acknowledge that you are ready, then wait for my instructions or a novelty tick. Do not start discovery now.",
						]),
			],
			{
				...size,
				cwd: directory,
				env: claudeEnvironment(directory),
				name: "xterm-256color",
			},
		)
		this.terminal = terminal
		terminal.onData((data) => this.emit("data", data))
		terminal.onExit(({ exitCode }) => {
			if (this.terminal !== terminal) return
			this.terminal = undefined
			this.emit("exit", exitCode)
		})
	}

	input(data: string): void {
		this.terminal?.write(data)
	}

	resize(size: TerminalSize): void {
		this.terminal?.resize(size.cols, size.rows)
	}

	close(): void {
		const terminal = this.terminal
		this.terminal = undefined
		terminal?.kill()
	}
}
