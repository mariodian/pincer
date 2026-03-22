import type { ElectrobunConfig } from "electrobun";
import { readFileSync } from "fs";

// Read version from package.json
const packageJson = JSON.parse(readFileSync("./package.json", "utf8"));

export default {
  app: {
    name: "CrabMon",
    identifier: "com.mariodian.crabmonitor",
    version: packageJson.version,
  },
  runtime: {
    exitOnLastWindowClosed: false, // keep running when all windows are closed
  },
  build: {
    // Vite builds to dist/, we copy from there
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/tray-popover.html": "views/mainview/tray-popover.html",
      "dist/assets": "views/mainview/assets",
      "src/resources": "views/resources",
      "src/bun/libs/libMacWindowEffects.dylib":
        "bun/libs/libMacWindowEffects.dylib",
      "drizzle/migrations": "drizzle/migrations",
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
