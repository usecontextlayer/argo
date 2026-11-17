const { app, BrowserWindow } = require("electron")
const { readFileSync } = require("node:fs")
const { join } = require("node:path")
const ts = require("typescript")

app.setPath("userData", process.argv[2])

app
	.whenReady()
	.then(async () => {
		const window = new BrowserWindow({ show: false })
		await window.loadURL("data:text/html,<title>Granola parser test</title>")
		const source = readFileSync(join(__dirname, "../src/granola.ts"), "utf8")
		const compiled = ts.transpileModule(source, {
			compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
		}).outputText
		const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
		const fixtures = ["list", "meeting"].map((name) =>
			readFileSync(join(__dirname, `fixtures/granola-${name}.xml`), "utf8"),
		)
		const result = await window.webContents.executeJavaScript(
			`import(${JSON.stringify(moduleUrl)}).then(({ decodeGranolaMeetings }) => ${JSON.stringify(fixtures)}.map(decodeGranolaMeetings))`,
		)
		process.stdout.write(JSON.stringify(result))
		app.exit(0)
	})
	.catch((error) => {
		console.error(error)
		app.exit(1)
	})
