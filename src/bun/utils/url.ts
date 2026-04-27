import { Updater } from "electrobun/bun";

import { logger } from "../services/loggerService";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Resolve the correct page URL for dev (Vite HMR) and packaged builds.
export async function getViewUrl(pagePath = "index.html"): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      logger.info(
        "url",
        `HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`,
      );
      return `${DEV_SERVER_URL}/${pagePath}`;
    } catch {
      logger.info(
        "url",
        "Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
      );
    }
  }
  logger.debug("url", `View URL: views://mainview/${pagePath}`);
  return `views://mainview/${pagePath}`;
}

/** Strip hash fragment from a URL to avoid accumulation on re-navigation. */
export function stripHash(url: string): string {
  const hashIndex = url.indexOf("#");
  return hashIndex !== -1 ? url.slice(0, hashIndex) : url;
}
