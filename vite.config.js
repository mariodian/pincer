import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
	plugins: [svelte(), tailwindcss()],
	root: "src/mainview",
	build: {
		outDir: "../../dist",
		emptyOutDir: true,
		rollupOptions: {
			input: {
				main: resolve(__dirname, "src/mainview/index.html"),
				agentConfig: resolve(__dirname, "src/mainview/agent-config.html"),
			},
		},
	},
	server: {
		port: 5173,
		strictPort: true,
	},
});