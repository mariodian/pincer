import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { defineConfig } from "vite";
import svelteConfig from "./svelte.config.js";

export default defineConfig({
  plugins: [svelte({ configFile: false, ...svelteConfig }), tailwindcss()],
  resolve: {
    alias: {
      $assets: resolve(__dirname, "src/mainview/assets"),
      $bun: resolve(__dirname, "src/bun"),
      $lib: resolve(__dirname, "src/mainview/lib"),
      $resources: resolve(__dirname, "src/resources"),
      $shared: resolve(__dirname, "src/shared"),
    },
  },
  root: "src/mainview",
  base: "./",
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      input: {
        main: resolve(__dirname, "src/mainview/index.html"),
        trayPopover: resolve(__dirname, "src/mainview/tray-popover.html"),
      },
    },
  },
  server: {
    forwardConsole: true,
  },
});
