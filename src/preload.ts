import { contextBridge, ipcRenderer } from "electron"
import type { CalendarApi } from "@/calendar"
import type { MailApi } from "@/mail"

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
