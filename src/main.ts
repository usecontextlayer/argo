import { watch } from "node:fs"
import path from "node:path"
import { app, BrowserWindow, ipcMain } from "electron"
import started from "electron-squirrel-startup"
import { sourceAccounts } from "@/accounts"
import type { CalendarEvent, CalendarResponse } from "@/calendar"
import { listCalendar, refreshCalendar, respondCalendar } from "@/calendar-service"
import {
	createChatDraftStore,
	iMessageDraftSchema,
	teamsDraftSchema,
	whatsAppDraftSchema,
} from "@/chat-drafts"
import { ClaudeProcess } from "@/claude-process"
import { listDoables } from "@/doables-service"
import { registerExternalLinks } from "@/external-links"
import {
	listGranolaMeetings,
	readGranolaMeeting,
	readGranolaTranscript,
	refreshGranola,
} from "@/granola-service"
import type { IMessageDraft } from "@/imessage"
import {
	createIMessageDraftService,
	listIMessageChats,
	readIMessageChat,
	readIMessageMessages,
} from "@/imessage-service"
import type { MailDraft, ReplyMode } from "@/mail"
import {
	createMailDraft,
	discardMailDraft,
	listMail,
	readMailDraft,
	readMailThread,
	refreshMail,
	saveMailDraft,
	sendMailDraft,
} from "@/mail-service"
import { McpConnections } from "@/mcp"
import type { TeamsDraft } from "@/teams"
import {
	createTeamsDraftService,
	listTeamsChats,
	readTeamsChat,
	readTeamsMessages,
	refreshTeams,
} from "@/teams-service"
import type { TerminalSize } from "@/terminal"
import type { WhatsAppDraft } from "@/whatsapp"
import { createWhatsAppService } from "@/whatsapp-service"
import { createWorkflowyService } from "@/workflowy-service"

const mcp = new McpConnections(path.join(app.getAppPath(), "mcp.json"))
const workflowy = createWorkflowyService(mcp)
const draftDirectory = path.join(app.getPath("userData"), "drafts")
const whatsapp = createWhatsAppService(
	mcp,
	createChatDraftStore(
		draftDirectory,
		`whatsapp/${sourceAccounts.whatsapp.id}`,
		whatsAppDraftSchema,
	),
)
const teamsDrafts = createTeamsDraftService(
	createChatDraftStore(
		draftDirectory,
		`teams/${sourceAccounts.teams.id}`,
		teamsDraftSchema,
	),
)
const imessageDrafts = createIMessageDraftService(
	createChatDraftStore(
		draftDirectory,
		`imessage/${sourceAccounts.imessage.id}`,
		iMessageDraftSchema,
	),
)
const claude = new ClaudeProcess(app.getAppPath())
claude.on("data", (data) => {
	for (const window of BrowserWindow.getAllWindows())
		window.webContents.send("terminal:data", data)
})
claude.on("exit", (code) => {
	for (const window of BrowserWindow.getAllWindows())
		window.webContents.send("terminal:exit", code)
})

if (started) {
	app.quit()
}

const createWindow = () => {
	const mainWindow = new BrowserWindow({
		height: 900,
		minHeight: 600,
		minWidth: 800,
		webPreferences: {
			preload: path.join(__dirname, "preload.cjs"),
		},
		width: 1440,
	})
	registerExternalLinks(mainWindow.webContents)

	if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
	} else {
		mainWindow.loadFile(
			path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
		)
	}
}

app.whenReady().then(() => {
	ipcMain.handle("terminal:open", (_event, size: TerminalSize) => claude.open(size))
	ipcMain.on("terminal:input", (_event, data: string) => claude.input(data))
	ipcMain.on("terminal:resize", (_event, size: TerminalSize) => claude.resize(size))
	const doableWatcher = watch(
		path.join(app.getAppPath(), "data/doables"),
		(_event, filename) => {
			if (!filename?.endsWith(".json")) return
			for (const window of BrowserWindow.getAllWindows())
				window.webContents.send("doables:changed")
		},
	)
	app.once("will-quit", () => doableWatcher.close())
	if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		app.dock?.setIcon(path.join(app.getAppPath(), "assets/argo-icon.png"))
	}
	ipcMain.handle("doables:list", () =>
		listDoables(path.join(app.getAppPath(), "data/doables")),
	)
	ipcMain.handle("imessage:list", (_event, limit: number) => listIMessageChats(limit))
	ipcMain.handle("imessage:chat", (_event, id: number) => readIMessageChat(id))
	ipcMain.handle("imessage:draft", (_event, id: number) => imessageDrafts.draft(id))
	ipcMain.handle("imessage:saveDraft", (_event, id: number, draft: IMessageDraft) =>
		imessageDrafts.saveDraft(id, draft),
	)
	ipcMain.handle("imessage:sendDraft", (_event, id: number) =>
		imessageDrafts.sendDraft(id),
	)
	ipcMain.handle("imessage:discardDraft", (_event, id: number) =>
		imessageDrafts.discardDraft(id),
	)
	ipcMain.handle(
		"imessage:messages",
		(_event, chatId: number, limit: number, messageId?: string) =>
			readIMessageMessages(chatId, limit, messageId),
	)
	ipcMain.handle("whatsapp:list", (_event, page: number) => whatsapp.list(page))
	ipcMain.handle("whatsapp:chat", (_event, id: string) => whatsapp.chat(id))
	ipcMain.handle("whatsapp:draft", (_event, id: string) => whatsapp.draft(id))
	ipcMain.handle("whatsapp:saveDraft", (_event, id: string, draft: WhatsAppDraft) =>
		whatsapp.saveDraft(id, draft),
	)
	ipcMain.handle("whatsapp:sendDraft", (_event, id: string) => whatsapp.sendDraft(id))
	ipcMain.handle("whatsapp:discardDraft", (_event, id: string) =>
		whatsapp.discardDraft(id),
	)
	ipcMain.handle("whatsapp:messages", (_event, chatId: string, page: number) =>
		whatsapp.messages(chatId, page),
	)
	ipcMain.handle("whatsapp:context", (_event, id: string) => whatsapp.context(id))
	ipcMain.handle("granola:list", (_event, month: string) => listGranolaMeetings(month))
	ipcMain.handle("granola:meeting", (_event, id: string) => readGranolaMeeting(id))
	ipcMain.handle("granola:transcript", (_event, id: string) => readGranolaTranscript(id))
	ipcMain.handle("granola:refresh", () => refreshGranola())
	ipcMain.handle("workflowy:read", (_event, target: string, limit: number) =>
		workflowy.read(target, limit),
	)
	ipcMain.handle("workflowy:refresh", () => workflowy.refresh())
	ipcMain.handle("teams:list", (_event, pageToken?: string) => listTeamsChats(pageToken))
	ipcMain.handle("teams:chat", (_event, id: string) => readTeamsChat(id))
	ipcMain.handle("teams:draft", (_event, id: string) => teamsDrafts.draft(id))
	ipcMain.handle("teams:saveDraft", (_event, id: string, draft: TeamsDraft) =>
		teamsDrafts.saveDraft(id, draft),
	)
	ipcMain.handle("teams:sendDraft", (_event, id: string) => teamsDrafts.sendDraft(id))
	ipcMain.handle("teams:discardDraft", (_event, id: string) =>
		teamsDrafts.discardDraft(id),
	)
	ipcMain.handle("teams:messages", (_event, chatId: string, pageToken?: string) =>
		readTeamsMessages(chatId, pageToken),
	)
	ipcMain.handle("teams:refresh", () => refreshTeams())
	ipcMain.handle("calendar:list", (_event, account: string, month: string) =>
		listCalendar(account, month),
	)
	ipcMain.handle("calendar:refresh", () => refreshCalendar())
	ipcMain.handle(
		"calendar:respond",
		(_event, account: string, event: CalendarEvent, response: CalendarResponse) =>
			respondCalendar(account, event, response),
	)
	ipcMain.handle("mail:list", (_event, account: string, pageToken?: string) =>
		listMail(account, pageToken),
	)
	ipcMain.handle("mail:refresh", () => refreshMail())
	ipcMain.handle("mail:thread", (_event, account: string, id: string) =>
		readMailThread(account, id),
	)
	ipcMain.handle("mail:draft", (_event, account: string, id: string) =>
		readMailDraft(account, id),
	)
	ipcMain.handle(
		"mail:createDraft",
		(_event, account: string, threadId: string, messageId: string, mode: ReplyMode) =>
			createMailDraft(account, threadId, messageId, mode),
	)
	ipcMain.handle("mail:saveDraft", (_event, account: string, draft: MailDraft) =>
		saveMailDraft(account, draft),
	)
	ipcMain.handle("mail:sendDraft", (_event, account: string, id: string) =>
		sendMailDraft(account, id),
	)
	ipcMain.handle("mail:discardDraft", (_event, account: string, id: string) =>
		discardMailDraft(account, id),
	)
	createWindow()

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow()
		}
	})
})

app.on("before-quit", () => claude.close())

app.on("will-quit", () => {
	void mcp.close()
})

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit()
	}
})
