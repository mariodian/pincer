import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./daemon/schema.ts",
  out: "./daemon/drizzle/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DB_PATH || "./daemon/drizzle/dev.db",
  },
});
