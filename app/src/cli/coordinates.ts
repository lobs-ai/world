// Backfill coordinates + region for a world's locations.
//
// Old worlds were seeded before locations carried `coordinates` and
// `region`. The new Atlas page needs both to place markers on the realm
// map. This CLI makes one LLM call: given the world's premise, era, and
// every location's name/type/description, the model returns a normalized
// (x, y) over a 16:9 realm parchment plus a region label per id.
//
// Usage:
//   tsx app/src/cli/coordinates.ts <worldId> [--force]
//
// Idempotent: skips locations that already have coordinates unless
// `--force` is passed.

import { z } from "zod";
import { callGenesis, extractJson } from "../llm/client.js";
import { getConfig } from "../config.js";
import { openDb } from "../db/index.js";
import { parseAndRepair } from "../llm/repair.js";

const placementSchema = z.object({
  placements: z.array(
    z.object({
      id: z.string(),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      region: z.string().min(1).max(200),
    }),
  ),
});

const SYSTEM = `You are the cartographer. You receive a list of named places
in a medieval-fantasy realm and the world's premise; you place each on a
16:9 horizontal parchment-map and group them into regions.

## Critical: copy the ids verbatim

Every location id you return MUST be one of the ids from the input list,
copied character-for-character. Do not invent new ids. Do not rename
\`pellan_marsh\` to \`marsh_pellan\`. Do not anglicise \`bell_and_buckle\` to
\`bell_inn\`. Use the exact strings the input gives you. The validator
rejects unknown ids and missing ids; if you cannot place a real input id,
you have failed the task.

## Coordinates

Coordinates are normalized 0..1. Origin is **top-left**:
- x grows west (0) → east (1).
- y grows north (0) → south (1).

Constraints — read once, then obey:
- Stay in the 0.05..0.95 band on both axes — keep markers off the edges.
- The capital sits roughly central (x ≈ 0.4..0.6, y ≈ 0.35..0.55).
- Northern places (the marches, mountain seats) get y ≤ 0.30.
- Southern places (a marsh, a warm coast, the orchard towns) get y ≥ 0.70.
- Eastern roads / sea: x ≥ 0.70. Western: x ≤ 0.30.
- Coordinates must be consistent with each location's description (a
  river-mouth town isn't centred; a city under the marsh is in marsh
  country).
- No two locations within 0.05 of each other unless they are paired
  (a town and its abbey).

## Regions

Group every place into 2–4 named regions. The \`region\` is short prose:
"the northern marches", "the marsh and its drowned shrines",
"the heart of the realm", "the orchard country". Same-region places
should cluster on the map.

## Output

Return one fenced JSON block of the shape:

\`\`\`json
{
  "placements": [
    { "id": "<exact id from input>", "x": 0.46, "y": 0.40, "region": "the heart of the realm" }
  ]
}
\`\`\`

One entry per input location, no more, no less. No prose outside the
JSON. No invented ids.`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith("--"));
  const force = args.includes("--force");
  const worldId = positional[0];
  if (!worldId) {
    console.error("usage: coordinates <worldId> [--force]");
    process.exit(2);
  }
  if (!process.env.MINIMAX_API_KEY) {
    console.error("MINIMAX_API_KEY is not set. Add it to .env.");
    process.exit(2);
  }
  const cfg = getConfig();
  const db = openDb(cfg.dbPath);
  const world = db.getWorld(worldId);
  if (!world) {
    console.error(`world ${worldId} not found`);
    process.exit(2);
  }
  const all = db.listLocations(world.id);
  const eligible = force ? all : all.filter((l) => !l.coordinates);
  if (eligible.length === 0) {
    console.error(`all ${all.length} locations already placed; pass --force to redo`);
    return;
  }
  console.error(
    `placing ${eligible.length} of ${all.length} locations on the map of ${world.name}…`,
  );

  const ctx = {
    premise: world.premise,
    era: world.era,
    locations: eligible.map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type,
      description: l.description,
    })),
  };

  const eligibleIds = new Set(eligible.map((l) => l.id));
  const idList = eligible.map((l) => l.id).join(", ");
  const initialRaw = await callGenesis({
    system: SYSTEM,
    user:
      `World premise: ${world.premise}\n\n` +
      `Place these locations on the realm map. The ONLY valid ids you may use are:\n` +
      `[${idList}]\n` +
      `Every one of these ids must appear exactly once. No other ids are allowed.\n\n` +
      `Locations:\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`\n\n` +
      `Return one fenced JSON block; one placement per input id.`,
    maxTokens: 4000,
  });

  const parsed = await parseAndRepair({
    label: "coordinates",
    schema: placementSchema,
    initialRaw,
    maxAttempts: 3,
    extraIssues: (p) => {
      const issues: { path: string; message: string }[] = [];
      const seen = new Set<string>();
      for (const item of p.placements) {
        if (!eligibleIds.has(item.id)) {
          issues.push({
            path: `placements[${item.id}]`,
            message: `unknown location id "${item.id}"`,
          });
        }
        if (seen.has(item.id)) {
          issues.push({
            path: `placements[${item.id}]`,
            message: `duplicate placement for "${item.id}"`,
          });
        }
        seen.add(item.id);
      }
      for (const id of eligibleIds) {
        if (!seen.has(id)) {
          issues.push({
            path: `placements`,
            message: `missing placement for location "${id}"`,
          });
        }
      }
      return issues;
    },
    onAttempt: (attempt, issues, accepted) => {
      if (accepted) {
        if (attempt > 1) console.error(`        ✓ repaired on attempt ${attempt}`);
        return;
      }
      console.error(
        `        ✗ attempt ${attempt}: ${issues.length} issue${issues.length === 1 ? "" : "s"}`,
      );
    },
    repair: async (previous, issues) => {
      const lines = issues.map((i) => `- ${i.path}: ${i.message}`).join("\n");
      return callGenesis({
        system: SYSTEM,
        user:
          `Your previous response was rejected. Issues:\n${lines}\n\n` +
          `The ONLY valid ids are these (copy verbatim, every one must appear, none others):\n` +
          `[${idList}]\n\n` +
          `Locations (for reference):\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`\n\n` +
          `Return one fenced JSON block, ${eligible.length} placements, one per id above.`,
        maxTokens: 4000,
      });
    },
  });

  // Commit
  let written = 0;
  for (const p of parsed.placements) {
    db.setLocationPlacement(world.id, p.id, { x: p.x, y: p.y }, p.region);
    written++;
  }
  console.error(`placed ${written} location${written === 1 ? "" : "s"} on the map.`);
  // Quick read-back so the user can sanity-check.
  const after = db.listLocations(world.id);
  for (const l of after) {
    if (!l.coordinates) continue;
    console.error(
      `  ${l.id}: (${l.coordinates.x.toFixed(2)}, ${l.coordinates.y.toFixed(2)}) — ${l.region || "—"}`,
    );
  }
  // Silence unused import
  void extractJson;
}

main().catch((err: unknown) => {
  console.error("coordinates failed:", err);
  process.exit(1);
});
