// Dump a world's chronicle entries to stdout. Useful for sanity checks.

import { getConfig } from "../config.js";
import { openDb } from "../db/index.js";

function main(): void {
  const args = process.argv.slice(2);
  const worldId = args[0];
  if (!worldId) {
    const db = openDb(getConfig().dbPath);
    const worlds = db.listWorlds();
    if (worlds.length === 0) {
      console.error("no worlds");
      process.exit(0);
    }
    for (const w of worlds) {
      // Single-line summary so callers can grep / awk -F'\t' safely.
      // Premise is collapsed and truncated; the full premise is available
      // when dumping a specific world.
      const summary = w.premise.replace(/\s+/g, " ").slice(0, 120);
      console.log(`${w.id}\t${w.name}\ttick=${w.tick}\t${summary}`);
    }
    return;
  }
  const db = openDb(getConfig().dbPath);
  const w = db.getWorld(worldId);
  if (!w) {
    console.error(`world ${worldId} not found`);
    process.exit(1);
  }
  console.log(`# ${w.name}`);
  console.log(`Premise: ${w.premise}`);
  console.log(`Tick ${w.tick} — ${w.inWorldDate}\n`);
  const entries = db.listEntries(worldId, 50).reverse();
  for (const e of entries) {
    const tag = e.beatType === "world_report" ? " — *report*" : "";
    console.log(`## ${e.title}${tag}`);
    console.log(`*${e.inWorldDate}, ${e.timeOfDay}. ${e.weather}.*\n`);
    for (const p of e.paragraphs) {
      if (p.kind === "aside") console.log(`> ${p.text}`);
      else console.log(p.text);
      console.log();
    }
    console.log("---\n");
  }
}

main();
