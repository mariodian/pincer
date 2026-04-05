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
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/mainview/index.html"),
        trayPopover: resolve(__dirname, "src/mainview/tray-popover.html"),
      },
      output: {
        manualChunks: {
          "layerchart-d3": ["layerchart", "d3-array", "d3-scale", "d3-shape"],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
