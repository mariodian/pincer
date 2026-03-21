import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/bun/storage/sqlite/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  dbCredentials: {
    // This path is only for the drizzle-kit CLI (generate, push, migrate).
    // The app uses Utils.paths.userData at runtime.
    url: "./drizzle/dev.db",
  },
});
