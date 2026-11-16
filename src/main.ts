import path from "node:path"
import { app, BrowserWindow, ipcMain } from "electron"
import started from "electron-squirrel-startup"
import { listMail, readMailThread, refreshMail } from "@/composio"

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
	ipcMain.handle("mail:list", (_event, pageToken?: string) => listMail(pageToken))
	ipcMain.handle("mail:refresh", () => refreshMail())
	ipcMain.handle("mail:thread", (_event, id: string) => readMailThread(id))
	createWindow()

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow()
		}
	})
})

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit()
	}
})
