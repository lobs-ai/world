import { runTick } from "../tick.js";
import { getConfig } from "../config.js";
import { openDb } from "../db/index.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const idIdx = args.indexOf("--id");
  let worldId = idIdx >= 0 ? args[idIdx + 1] : args[0];
  if (!worldId) {
    console.error("usage: tick <worldId>");
    process.exit(2);
  }
  if (!process.env.MINIMAX_API_KEY) {
    console.error("MINIMAX_API_KEY is not set. Add it to .env.");
    process.exit(2);
  }
  const cfg = getConfig();
  const db = openDb(cfg.dbPath);
  const result = await runTick(db, worldId);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((err: unknown) => {
  console.error("tick failed:", err);
  process.exit(1);
});
