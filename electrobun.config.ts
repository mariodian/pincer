import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "svelte-tailwind-vite",
    identifier: "sveltetailwindvite.electrobun.dev",
    version: "0.0.1",
  },
  build: {
    // Vite builds to dist/, we copy from there
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/agent-config.html": "views/mainview/agent-config.html",
      "dist/tray-popover.html": "views/mainview/tray-popover.html",
      "dist/assets": "views/mainview/assets",
      "src/bun/libMacWindowEffects.dylib": "bun/libMacWindowEffects.dylib",
    },
    mac: {
      bundleCEF: false,
    },
    linux: {
      bundleCEF: false,
    },
    win: {
      bundleCEF: false,
    },
  },
} satisfies ElectrobunConfig;
