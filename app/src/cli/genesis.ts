import { genesis } from "../genesis/index.js";
import { getConfig } from "../config.js";
import { openDb } from "../db/index.js";
import { parsePremiseArgs } from "./parse-premise.js";

async function main(): Promise<void> {
  const result = parsePremiseArgs(process.argv.slice(2));
  if (result.kind === "error") {
    console.error(`genesis: ${result.message}`);
    process.exit(2);
  }
  if (result.kind === "empty") {
    console.error('usage: genesis "<premise>" | -f <path> [--fresh]');
    process.exit(2);
  }
  const { premise, fresh } = result;
  if (!premise) {
    console.error('usage: genesis "<premise>" | -f <path> [--fresh]');
    process.exit(2);
  }
  if (!process.env.MINIMAX_API_KEY) {
    console.error("MINIMAX_API_KEY is not set. Add it to .env.");
    process.exit(2);
  }
  const cfg = getConfig();
  const db = openDb(cfg.dbPath);
  console.error(
    `Genesis (premise: ${premise.length} chars)${fresh ? ", --fresh" : ""}. This may take a moment...`,
  );
  const world = await genesis(db, { premise, fresh });
  console.log(JSON.stringify({ id: world.id, name: world.name, tick: world.tick }, null, 2));
}

main().catch((err: unknown) => {
  console.error("genesis failed:", err);
  process.exit(1);
});
