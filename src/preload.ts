import { contextBridge, ipcRenderer } from "electron"
import type { CalendarApi, CalendarEvent, CalendarResponse } from "@/calendar"
import type { DoablesApi } from "@/doables"
import type { GranolaApi } from "@/granola"
import type { IMessageApi, IMessageDraft } from "@/imessage"
import type { MailApi, MailDraft, ReplyMode } from "@/mail"
import type { TeamsApi, TeamsDraft } from "@/teams"
import type { TerminalApi, TerminalSize } from "@/terminal"
import type { WhatsAppApi, WhatsAppDraft } from "@/whatsapp"
import type { WorkflowyApi } from "@/workflowy"

contextBridge.exposeInMainWorld("imessage", {
	chat: (id: number) => ipcRenderer.invoke("imessage:chat", id),
	discardDraft: (id: number) => ipcRenderer.invoke("imessage:discardDraft", id),
	draft: (id: number) => ipcRenderer.invoke("imessage:draft", id),
	list: (limit: number) => ipcRenderer.invoke("imessage:list", limit),
	messages: (chatId: number, limit: number, messageId?: string) =>
		ipcRenderer.invoke("imessage:messages", chatId, limit, messageId),
	saveDraft: (id: number, draft: IMessageDraft) =>
		ipcRenderer.invoke("imessage:saveDraft", id, draft),
	sendDraft: (id: number) => ipcRenderer.invoke("imessage:sendDraft", id),
} satisfies IMessageApi)

contextBridge.exposeInMainWorld("whatsapp", {
	chat: (id: string) => ipcRenderer.invoke("whatsapp:chat", id),
	context: (id: string) => ipcRenderer.invoke("whatsapp:context", id),
	discardDraft: (id: string) => ipcRenderer.invoke("whatsapp:discardDraft", id),
	draft: (id: string) => ipcRenderer.invoke("whatsapp:draft", id),
	list: (page: number) => ipcRenderer.invoke("whatsapp:list", page),
	messages: (chatId: string, page: number) =>
		ipcRenderer.invoke("whatsapp:messages", chatId, page),
	saveDraft: (id: string, draft: WhatsAppDraft) =>
		ipcRenderer.invoke("whatsapp:saveDraft", id, draft),
	sendDraft: (id: string) => ipcRenderer.invoke("whatsapp:sendDraft", id),
} satisfies WhatsAppApi)

contextBridge.exposeInMainWorld("granola", {
	list: (month: string) => ipcRenderer.invoke("granola:list", month),
	meeting: (id: string) => ipcRenderer.invoke("granola:meeting", id),
	refresh: () => ipcRenderer.invoke("granola:refresh"),
	transcript: (id: string) => ipcRenderer.invoke("granola:transcript", id),
} satisfies GranolaApi)

contextBridge.exposeInMainWorld("mail", {
	createDraft: (account: string, threadId: string, messageId: string, mode: ReplyMode) =>
		ipcRenderer.invoke("mail:createDraft", account, threadId, messageId, mode),
	discardDraft: (account: string, id: string) =>
		ipcRenderer.invoke("mail:discardDraft", account, id),
	draft: (account: string, id: string) => ipcRenderer.invoke("mail:draft", account, id),
	list: (account: string, pageToken?: string) =>
		ipcRenderer.invoke("mail:list", account, pageToken),
	refresh: () => ipcRenderer.invoke("mail:refresh"),
	saveDraft: (account: string, draft: MailDraft) =>
		ipcRenderer.invoke("mail:saveDraft", account, draft),
	sendDraft: (account: string, id: string) =>
		ipcRenderer.invoke("mail:sendDraft", account, id),
	thread: (account: string, id: string) => ipcRenderer.invoke("mail:thread", account, id),
} satisfies MailApi)

contextBridge.exposeInMainWorld("calendar", {
	list: (account: string, month: string) =>
		ipcRenderer.invoke("calendar:list", account, month),
	refresh: () => ipcRenderer.invoke("calendar:refresh"),
	respond: (account: string, event: CalendarEvent, response: CalendarResponse) =>
		ipcRenderer.invoke("calendar:respond", account, event, response),
} satisfies CalendarApi)

contextBridge.exposeInMainWorld("teams", {
	chat: (id: string) => ipcRenderer.invoke("teams:chat", id),
	discardDraft: (id: string) => ipcRenderer.invoke("teams:discardDraft", id),
	draft: (id: string) => ipcRenderer.invoke("teams:draft", id),
	list: (pageToken?: string) => ipcRenderer.invoke("teams:list", pageToken),
	messages: (chatId: string, pageToken?: string) =>
		ipcRenderer.invoke("teams:messages", chatId, pageToken),
	refresh: () => ipcRenderer.invoke("teams:refresh"),
	saveDraft: (id: string, draft: TeamsDraft) =>
		ipcRenderer.invoke("teams:saveDraft", id, draft),
	sendDraft: (id: string) => ipcRenderer.invoke("teams:sendDraft", id),
} satisfies TeamsApi)

contextBridge.exposeInMainWorld("workflowy", {
	read: (target: string, limit: number) =>
		ipcRenderer.invoke("workflowy:read", target, limit),
	refresh: () => ipcRenderer.invoke("workflowy:refresh"),
} satisfies WorkflowyApi)

contextBridge.exposeInMainWorld("doables", {
	list: () => ipcRenderer.invoke("doables:list"),
	onChange: (listener) => {
		const handler = () => listener()
		ipcRenderer.on("doables:changed", handler)
		return () => ipcRenderer.removeListener("doables:changed", handler)
	},
} satisfies DoablesApi)

contextBridge.exposeInMainWorld("terminal", {
	input: (data: string) => ipcRenderer.send("terminal:input", data),
	onData: (listener) => {
		const handler = (_event: Electron.IpcRendererEvent, data: string) => listener(data)
		ipcRenderer.on("terminal:data", handler)
		return () => ipcRenderer.removeListener("terminal:data", handler)
	},
	onExit: (listener) => {
		const handler = (_event: Electron.IpcRendererEvent, code: number) => listener(code)
		ipcRenderer.on("terminal:exit", handler)
		return () => ipcRenderer.removeListener("terminal:exit", handler)
	},
	open: (size: TerminalSize) => ipcRenderer.invoke("terminal:open", size),
	resize: (size: TerminalSize) => ipcRenderer.send("terminal:resize", size),
} satisfies TerminalApi)
