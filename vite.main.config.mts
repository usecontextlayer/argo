import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

// https://vitejs.dev/config
export default defineConfig({
	build: { rollupOptions: { external: ["node-pty"] } },
	resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
})
