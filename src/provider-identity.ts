import { getAccount } from "@/accounts"
import type { SourceReference } from "@/doables"

export const providers = {
	argo: { icon: new URL("../assets/argo-icon.png", import.meta.url).href, name: "Argo" },
	gmail: {
		icon: new URL("../assets/providers/gmail.svg", import.meta.url).href,
		name: "Gmail",
	},
	"google-calendar": {
		icon: new URL("../assets/providers/google-calendar.svg", import.meta.url).href,
		name: "Google Calendar",
	},
	granola: {
		icon: new URL("../assets/providers/granola.svg", import.meta.url).href,
		name: "Granola",
	},
	imessage: {
		icon: new URL("../assets/providers/imessage.png", import.meta.url).href,
		name: "iMessage",
	},
	outlook: {
		icon: new URL("../assets/providers/outlook.svg", import.meta.url).href,
		name: "Outlook",
	},
	teams: {
		icon: new URL("../assets/providers/teams.svg", import.meta.url).href,
		name: "Teams",
	},
	whatsapp: {
		icon: new URL("../assets/providers/whatsapp.svg", import.meta.url).href,
		name: "WhatsApp",
	},
	workflowy: {
		icon: new URL("../assets/providers/workflowy.svg", import.meta.url).href,
		name: "Workflowy",
	},
} as const

export type Provider = keyof typeof providers

export function accountProvider(accountId: string, kind: "mail" | "calendar"): Provider {
	return getAccount(accountId).provider === "microsoft"
		? "outlook"
		: kind === "mail"
			? "gmail"
			: "google-calendar"
}

export function sourceProvider(reference: SourceReference): Provider {
	return "account" in reference
		? accountProvider(reference.account, reference.source)
		: reference.source
}
