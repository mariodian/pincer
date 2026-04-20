import { readFileSync } from "fs";
import { join } from "path";

// Read version from package.json
const appPackageJson = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../package.json"), "utf8"),
);
const daemonPackageJson = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../daemon/package.json"), "utf8"),
);

export const appConfig = {
  name: "Pincer",
  identifier: "com.mariodian.pincer",
  version: appPackageJson.version,
} as const;

export const daemonConfig = {
  name: "Pincer Daemon",
  identifier: "com.mariodian.pincer",
  version: daemonPackageJson.version,
} as const;
