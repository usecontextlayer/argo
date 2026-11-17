export type DraftState<Draft> = {
	draft: Draft | null
	loaded: boolean
	saving: boolean
	activity: "idle" | "opening" | "sending" | "discarding"
	error: string | null
	editorKey: number
	dirty: boolean
}

export type DraftOperations<Draft> = {
	load(): Promise<Draft | null>
	empty(): Draft | null
	save(draft: Draft): Promise<Draft>
	send(draft: Draft): Promise<void>
	discard(draft: Draft): Promise<void>
}

export class DraftSession<Draft> {
	private state: DraftState<Draft> = {
		activity: "idle",
		dirty: false,
		draft: null,
		editorKey: 0,
		error: null,
		loaded: false,
		saving: false,
	}
	private saved: Draft | null = null
	private listeners = new Set<() => void>()
	private loading?: Promise<boolean>
	private saving?: Promise<boolean>
	private timer?: ReturnType<typeof setTimeout>

	constructor(private readonly operations: DraftOperations<Draft>) {}

	getSnapshot = () => this.state

	subscribe = (listener: () => void) => {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}

	private publish(update: Partial<DraftState<Draft>>) {
		this.state = { ...this.state, ...update }
		this.state.dirty = this.state.draft !== this.saved
		for (const listener of this.listeners) listener()
	}

	private fail(error: unknown) {
		this.publish({ error: error instanceof Error ? error.message : String(error) })
	}

	load(): Promise<boolean> {
		if (this.state.loaded) return Promise.resolve(true)
		return this.refresh()
	}

	refresh(): Promise<boolean> {
		if (this.state.dirty || this.state.activity !== "idle") return Promise.resolve(true)
		return this.read()
	}

	private read(): Promise<boolean> {
		if (this.loading) return this.loading
		const previous = this.state.draft
		const activity = this.state.activity
		this.loading = this.operations
			.load()
			.then((draft) => {
				if (
					this.state.draft === previous &&
					(!this.state.loaded || this.state.activity === activity)
				) {
					this.saved = draft ?? this.operations.empty()
					this.publish({ draft: this.saved, error: null, loaded: true })
				}
				return true
			})
			.catch((error) => {
				this.fail(error)
				return false
			})
			.finally(() => {
				this.loading = undefined
			})
		return this.loading
	}

	update(update: Draft | ((draft: Draft) => Draft)) {
		if (this.state.activity !== "idle") return
		const draft =
			typeof update === "function"
				? this.state.draft !== null
					? (update as (draft: Draft) => Draft)(this.state.draft)
					: null
				: update
		this.publish({ draft, error: null })
		clearTimeout(this.timer)
		this.timer = setTimeout(() => void this.flush(), 600)
	}

	private async act(
		activity: Exclude<DraftState<Draft>["activity"], "idle">,
		action: () => Promise<boolean>,
	): Promise<boolean> {
		if (this.state.activity !== "idle") return false
		this.publish({ activity, error: null })
		try {
			if (!this.state.loaded && !(await this.read())) return false
			return await action()
		} catch (error) {
			this.fail(error)
			return false
		} finally {
			this.publish({ activity: "idle" })
		}
	}

	open(create: () => Promise<Draft>): Promise<boolean> {
		return this.act("opening", async () => {
			if (!(await this.flush())) return false
			this.saved = await create()
			this.publish({ draft: this.saved })
			return true
		})
	}

	async flush(): Promise<boolean> {
		clearTimeout(this.timer)
		if (this.saving) return this.saving
		this.saving = this.saveChanges().finally(() => {
			this.saving = undefined
		})
		return this.saving
	}

	private async saveChanges(): Promise<boolean> {
		try {
			while (this.state.draft !== null && this.state.draft !== this.saved) {
				const submitted = this.state.draft
				this.publish({ error: null, saving: true })
				const result = await this.operations.save(submitted)
				if (this.state.draft === submitted) {
					this.saved = result
					this.publish({ draft: result })
				} else {
					this.saved = submitted
				}
			}
			return true
		} catch (error) {
			this.fail(error)
			return false
		} finally {
			this.publish({ saving: false })
		}
	}

	send(): Promise<boolean> {
		return this.act("sending", async () => {
			if (!(await this.flush()) || this.state.draft === null) return false
			await this.operations.send(this.state.draft)
			this.reset()
			return true
		})
	}

	discard(): Promise<boolean> {
		return this.act("discarding", async () => {
			clearTimeout(this.timer)
			if (this.saving) await this.saving
			if (this.state.draft !== null) await this.operations.discard(this.state.draft)
			this.reset()
			return true
		})
	}

	private reset() {
		this.saved = this.operations.empty()
		this.publish({ draft: this.saved, editorKey: this.state.editorKey + 1, error: null })
	}
}
