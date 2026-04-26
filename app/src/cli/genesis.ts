import { genesis } from "../genesis/index.js";
import { getConfig } from "../config.js";
import { openDb } from "../db/index.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const premiseFlagIdx = args.indexOf("--premise");
  let premise: string | null = null;
  if (premiseFlagIdx >= 0) {
    premise = args[premiseFlagIdx + 1] ?? null;
  } else if (args.length === 1) {
    premise = args[0] ?? null;
  }
  if (!premise) {
    console.error('usage: genesis "<one-sentence premise>"');
    process.exit(2);
  }
  if (!process.env.MINIMAX_API_KEY) {
    console.error("MINIMAX_API_KEY is not set. Add it to .env.");
    process.exit(2);
  }
  const cfg = getConfig();
  const db = openDb(cfg.dbPath);
  console.error(`Genesis (premise: ${premise.length} chars). This may take a moment...`);
  const world = await genesis(db, { premise });
  console.log(JSON.stringify({ id: world.id, name: world.name, tick: world.tick }, null, 2));
}

main().catch((err: unknown) => {
  console.error("genesis failed:", err);
  process.exit(1);
});
