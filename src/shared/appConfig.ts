import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_VERSION = "unknown";

function readVersionFile(path: string): string | null {
  if (!existsSync(path)) return null;

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as {
      version?: unknown;
    };
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
}

function resolveVersion(candidates: string[]): string {
  for (const candidate of candidates) {
    const version = readVersionFile(candidate);
    if (version) return version;
  }
  return DEFAULT_VERSION;
}

const appVersion = resolveVersion([
  join(import.meta.dirname, "../../package.json"),
  join(process.cwd(), "package.json"),
]);

const daemonVersion = resolveVersion([
  join(process.cwd(), "version.json"),
  join(process.cwd(), "package.json"),
]);

export const appConfig = {
  name: "Pincer",
  identifier: "com.mariodian.pincer",
  version: appVersion,
} as const;

export const daemonConfig = {
  name: "Pincer Daemon",
  identifier: "com.mariodian.pincer",
  version: daemonVersion,
} as const;
