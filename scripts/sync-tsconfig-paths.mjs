// TypeScript replaces paths on extends. Merge the Hutch devkit map with
// project aliases so electrobun/* and $lib resolve together.
import { readFileSync, writeFileSync } from "node:fs";

const devkitTsconfigPath = ".hutch/devkit/tsconfig.json";
const devkit = JSON.parse(readFileSync(devkitTsconfigPath, "utf8"));
const devkitPaths = devkit?.compilerOptions?.paths;

if (!devkitPaths || typeof devkitPaths !== "object") {
  throw new Error(
    `Electrobun devkit tsconfig has no paths at ${devkitTsconfigPath}. Run electrobun prepare first.`,
  );
}

const rewrittenDevkitPaths = Object.fromEntries(
  Object.entries(devkitPaths)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => [
      key,
      values.map((value) =>
        value.startsWith("./") ? `./.hutch/devkit/${value.slice(2)}` : value,
      ),
    ]),
);

const projectPaths = {
  $assets: ["./src/mainview/assets"],
  "$assets/*": ["./src/mainview/assets/*"],
  $lib: ["./src/mainview/lib"],
  "$lib/*": ["./src/mainview/lib/*"],
  $bun: ["./src/bun"],
  "$bun/*": ["./src/bun/*"],
  $resources: ["./src/resources"],
  "$resources/*": ["./src/resources/*"],
  $shared: ["./src/shared"],
  "$shared/*": ["./src/shared/*"],
};

const merged = {
  compilerOptions: {
    paths: {
      ...rewrittenDevkitPaths,
      ...projectPaths,
    },
  },
};

writeFileSync(
  "tsconfig.paths.json",
  `${JSON.stringify(merged, null, 2)}\n`,
);
console.log("wrote tsconfig.paths.json");
