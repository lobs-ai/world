// One-shot image backfill for an existing world. Walks every location and
// every principal/secondary/atmospheric character that doesn't yet have a
// portrait or plate, queues them through the serial generation queue, and
// awaits the queue. Bounded by the daily budget set inside images/index.ts.
//
// Usage:
//   npx tsx app/src/cli/images.ts <worldId>           # default cap = 50
//   npx tsx app/src/cli/images.ts <worldId> --cap 12  # only fill 12 jobs

import { getConfig } from "../config.js";
import { openDb } from "../db/index.js";
import {
  backfillMissingImages,
  drainImageQueue,
  pendingImageJobs,
} from "../images/index.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const worldId = args.find((a) => !a.startsWith("--"));
  const capIdx = args.indexOf("--cap");
  const cap = capIdx >= 0 ? Number(args[capIdx + 1]) : 50;
  if (!worldId) {
    console.error("usage: images <worldId> [--cap N]");
    process.exit(2);
  }
  if (!process.env.MINIMAX_API_KEY) {
    console.error("MINIMAX_API_KEY is not set. Add it to .env.");
    process.exit(2);
  }
  const db = openDb(getConfig().dbPath);
  const world = db.getWorld(worldId);
  if (!world) {
    console.error(`world ${worldId} not found`);
    process.exit(1);
  }

  const result = backfillMissingImages(db, world, cap);
  console.error(
    `[images] queued ${result.enqueuedLocations} locations, ` +
      `${result.enqueuedCharacters} characters ` +
      `(remaining: ${result.remainingLocations} loc, ${result.remainingCharacters} char)`,
  );
  if (result.enqueuedLocations + result.enqueuedCharacters === 0) {
    console.error("[images] nothing to do — every subject already has a picture");
    return;
  }

  // Stream progress.
  const startedAt = Date.now();
  const tick = setInterval(() => {
    const remaining = pendingImageJobs();
    process.stderr.write(
      `\r[images] in flight: ${remaining}    elapsed: ${Math.round((Date.now() - startedAt) / 1000)}s   `,
    );
  }, 2000);

  await drainImageQueue();
  clearInterval(tick);
  process.stderr.write("\n[images] done.\n");
}

main().catch((err: unknown) => {
  console.error("images failed:", err);
  process.exit(1);
});
