export type TerminalSize = { cols: number; rows: number }

export type TerminalApi = {
	open(size: TerminalSize): Promise<void>
	input(data: string): void
	resize(size: TerminalSize): void
	onData(listener: (data: string) => void): () => void
	onExit(listener: (code: number) => void): () => void
}

declare global {
	interface Window {
		terminal: TerminalApi
	}
}
