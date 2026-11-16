import { contextBridge, ipcRenderer } from "electron"
import type { MailApi } from "@/mail"

contextBridge.exposeInMainWorld("mail", {
	list: (pageToken?: string) => ipcRenderer.invoke("mail:list", pageToken),
	refresh: () => ipcRenderer.invoke("mail:refresh"),
	thread: (id: string) => ipcRenderer.invoke("mail:thread", id),
} satisfies MailApi)
