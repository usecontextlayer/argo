import { useEffect, useSyncExternalStore } from "react"
import { useRevalidator } from "react-router"
import { type DraftOperations, DraftSession, type DraftState } from "@/draft-session"

const sessions = new Map<string, DraftSession<unknown>>()

export type DraftBinding<Draft> = DraftState<Draft> & {
	session: DraftSession<Draft>
	identity: string
}

export function useDraft<Draft>(
	identity: readonly (string | number)[],
	operations: DraftOperations<Draft>,
): DraftBinding<Draft> {
	const key = JSON.stringify(identity)
	let session = sessions.get(key) as DraftSession<Draft> | undefined
	if (!session) {
		session = new DraftSession(operations)
		sessions.set(key, session as DraftSession<unknown>)
	}
	const selected = session
	const state = useSyncExternalStore(selected.subscribe, selected.getSnapshot)
	const revalidator = useRevalidator()
	useEffect(() => {
		if (revalidator.state === "idle") void selected.refresh()
	}, [selected, revalidator.state])
	return { identity: key, session: selected, ...state }
}
