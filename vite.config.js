import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

import { electrobunViteAliases } from "./.hutch/devkit/api/config/electrobun-vite";
import svelteConfig from "./svelte.config.js";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [svelte({ configFile: false, ...svelteConfig }), tailwindcss()],
  resolve: {
    alias: [
      ...electrobunViteAliases(resolve(rootDir, ".hutch/devkit")),
      { find: "$assets", replacement: resolve(rootDir, "src/mainview/assets") },
      { find: "$bun", replacement: resolve(rootDir, "src/bun") },
      { find: "$lib", replacement: resolve(rootDir, "src/mainview/lib") },
      { find: "$resources", replacement: resolve(rootDir, "src/resources") },
      { find: "$shared", replacement: resolve(rootDir, "src/shared") },
    ],
  },
  root: "src/mainview",
  base: "./",
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      input: {
        main: resolve(rootDir, "src/mainview/index.html"),
        trayPopover: resolve(rootDir, "src/mainview/tray-popover.html"),
      },
    },
  },
  server: {
    forwardConsole: true,
  },
});
