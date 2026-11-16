import path from "node:path"
import { app, BrowserWindow, ipcMain } from "electron"
import started from "electron-squirrel-startup"
import { listCalendar, refreshCalendar } from "@/calendar-service"
import { listDoables } from "@/doables-service"
import {
	listGranolaMeetings,
	readGranolaMeeting,
	readGranolaTranscript,
	refreshGranola,
} from "@/granola-service"
import {
	listIMessageChats,
	readIMessageChat,
	readIMessageMessages,
} from "@/imessage-service"
import { listMail, readMailThread, refreshMail } from "@/mail-service"
import { McpConnections } from "@/mcp"
import { listTeamsChats, readTeamsMessages, refreshTeams } from "@/teams-service"
import { createWhatsAppService } from "@/whatsapp-service"
import { createWorkflowyService } from "@/workflowy-service"

const mcp = new McpConnections(path.join(app.getAppPath(), "mcp.json"))
const workflowy = createWorkflowyService(mcp)
const whatsapp = createWhatsAppService(mcp)

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

	if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
	} else {
		mainWindow.loadFile(
			path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
		)
	}
}

app.whenReady().then(() => {
	if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		app.dock?.setIcon(path.join(app.getAppPath(), "assets/argo-icon.png"))
	}
	ipcMain.handle("doables:list", () =>
		listDoables(path.join(app.getAppPath(), "data/doables")),
	)
	ipcMain.handle("imessage:list", (_event, limit: number) => listIMessageChats(limit))
	ipcMain.handle("imessage:chat", (_event, id: number) => readIMessageChat(id))
	ipcMain.handle(
		"imessage:messages",
		(_event, chatId: number, limit: number, messageId?: string) =>
			readIMessageMessages(chatId, limit, messageId),
	)
	ipcMain.handle("whatsapp:list", (_event, page: number) => whatsapp.list(page))
	ipcMain.handle("whatsapp:chat", (_event, id: string) => whatsapp.chat(id))
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
	ipcMain.handle("teams:messages", (_event, chatId: string, pageToken?: string) =>
		readTeamsMessages(chatId, pageToken),
	)
	ipcMain.handle("teams:refresh", () => refreshTeams())
	ipcMain.handle("calendar:list", (_event, account: string, month: string) =>
		listCalendar(account, month),
	)
	ipcMain.handle("calendar:refresh", () => refreshCalendar())
	ipcMain.handle("mail:list", (_event, account: string, pageToken?: string) =>
		listMail(account, pageToken),
	)
	ipcMain.handle("mail:refresh", () => refreshMail())
	ipcMain.handle("mail:thread", (_event, account: string, id: string) =>
		readMailThread(account, id),
	)
	createWindow()

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow()
		}
	})
})

app.on("will-quit", () => {
	void mcp.close()
})

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit()
	}
})
