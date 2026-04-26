// Resolves environment + paths. Loads .env from repo root.

import { config as loadEnv } from "dotenv";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

loadEnv({ path: resolve(repoRoot, ".env") });

export interface AppConfig {
  repoRoot: string;
  dbPath: string;
  tickIntervalSeconds: number;
}

export function getConfig(): AppConfig {
  const dbPath = resolve(repoRoot, process.env.WORLD_DB ?? "data/world.db");
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
  const tickIntervalSeconds = Number(
    process.env.WORLD_TICK_INTERVAL_SECONDS ?? "900",
  );
  return { repoRoot, dbPath, tickIntervalSeconds };
}
