// typecheck only needs the devkit path map. `electrobun prepare` takes
// `.hutch/locks/electrobun-build.lock` and waits until every `electrobun dev`
// reader lease is gone, so check hangs for as long as the dev server runs.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const devkitTsconfig = ".hutch/devkit/tsconfig.json";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(devkitTsconfig)) {
  run("electrobun", ["prepare"]);
}

run("bun", ["scripts/sync-tsconfig-paths.mjs"]);
