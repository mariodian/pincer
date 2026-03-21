import { Updater } from "electrobun/bun";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Resolve the correct page URL for dev (Vite HMR) and packaged builds.
export async function getViewUrl(pagePath = "index.html"): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      console.log(`View URL: ${DEV_SERVER_URL}/${pagePath}`);
      return `${DEV_SERVER_URL}/${pagePath}`;
    } catch {
      console.log(
        "Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
      );
    }
  }
  console.log(`View URL: views://mainview/${pagePath}`);
  return `views://mainview/${pagePath}`;
}

/** Strip hash fragment from a URL to avoid accumulation on re-navigation. */
export function stripHash(url: string): string {
  const hashIndex = url.indexOf("#");
  return hashIndex !== -1 ? url.slice(0, hashIndex) : url;
}
