import { runTick } from "../tick.js";
import { getConfig } from "../config.js";
import { openDb } from "../db/index.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const idIdx = args.indexOf("--id");
  const worldId = idIdx >= 0 ? args[idIdx + 1] : args[0];
  if (!worldId) {
    console.error("usage: tick:loop <worldId>");
    process.exit(2);
  }
  if (!process.env.MINIMAX_API_KEY) {
    console.error("MINIMAX_API_KEY is not set. Add it to .env.");
    process.exit(2);
  }
  const cfg = getConfig();
  const db = openDb(cfg.dbPath);
  const intervalMs = cfg.tickIntervalSeconds * 1000;
  console.error(`tick loop for world ${worldId} every ${cfg.tickIntervalSeconds}s`);
  let stop = false;
  process.on("SIGINT", () => { stop = true; });
  process.on("SIGTERM", () => { stop = true; });
  while (!stop) {
    try {
      const r = await runTick(db, worldId);
      console.log(`[tick ${r.tick}] ok=${r.ok} ${r.durationMs}ms ${r.notes}`);
    } catch (err) {
      console.error("tick error:", err);
    }
    if (stop) break;
    await sleep(intervalMs);
  }
}

main().catch((err: unknown) => {
  console.error("loop failed:", err);
  process.exit(1);
});
