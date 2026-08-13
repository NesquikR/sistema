import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 move a connection string do schema para cá.
 * A URL nunca fica versionada: vem de .env (veja .env.example).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
