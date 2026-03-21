import { Utils } from "electrobun/bun";
import { mkdir, stat } from "node:fs/promises";

/** Ensure the app's user-data directory exists. */
export async function ensureAppDataDir(): Promise<void> {
  const appDataDir = Utils.paths.userData;
  try {
    await stat(appDataDir);
  } catch {
    await mkdir(appDataDir, { recursive: true });
  }
}
