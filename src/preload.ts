import { contextBridge, ipcRenderer } from "electron"
import type { CalendarApi } from "@/calendar"
import type { DoablesApi } from "@/doables"
import type { GranolaApi } from "@/granola"
import type { MailApi } from "@/mail"
import type { TeamsApi } from "@/teams"
import type { WhatsAppApi } from "@/whatsapp"
import type { WorkflowyApi } from "@/workflowy"

contextBridge.exposeInMainWorld("whatsapp", {
	chat: (id: string) => ipcRenderer.invoke("whatsapp:chat", id),
	context: (id: string) => ipcRenderer.invoke("whatsapp:context", id),
	list: (page: number) => ipcRenderer.invoke("whatsapp:list", page),
	messages: (chatId: string, page: number) =>
		ipcRenderer.invoke("whatsapp:messages", chatId, page),
} satisfies WhatsAppApi)

contextBridge.exposeInMainWorld("granola", {
	list: (month: string) => ipcRenderer.invoke("granola:list", month),
	meeting: (id: string) => ipcRenderer.invoke("granola:meeting", id),
	refresh: () => ipcRenderer.invoke("granola:refresh"),
	transcript: (id: string) => ipcRenderer.invoke("granola:transcript", id),
} satisfies GranolaApi)

contextBridge.exposeInMainWorld("mail", {
	list: (account: string, pageToken?: string) =>
		ipcRenderer.invoke("mail:list", account, pageToken),
	refresh: () => ipcRenderer.invoke("mail:refresh"),
	thread: (account: string, id: string) => ipcRenderer.invoke("mail:thread", account, id),
} satisfies MailApi)

contextBridge.exposeInMainWorld("calendar", {
	list: (account: string, month: string) =>
		ipcRenderer.invoke("calendar:list", account, month),
	refresh: () => ipcRenderer.invoke("calendar:refresh"),
} satisfies CalendarApi)

contextBridge.exposeInMainWorld("teams", {
	list: (pageToken?: string) => ipcRenderer.invoke("teams:list", pageToken),
	messages: (chatId: string, pageToken?: string) =>
		ipcRenderer.invoke("teams:messages", chatId, pageToken),
	refresh: () => ipcRenderer.invoke("teams:refresh"),
} satisfies TeamsApi)

contextBridge.exposeInMainWorld("workflowy", {
	read: (target: string, limit: number) =>
		ipcRenderer.invoke("workflowy:read", target, limit),
	refresh: () => ipcRenderer.invoke("workflowy:refresh"),
} satisfies WorkflowyApi)

contextBridge.exposeInMainWorld("doables", {
	list: () => ipcRenderer.invoke("doables:list"),
} satisfies DoablesApi)
