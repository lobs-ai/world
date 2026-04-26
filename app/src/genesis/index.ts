// Genesis pipeline: premise -> seeded world.
// Single LLM call against the genesis prompt. The output is parsed,
// referentially checked, and committed inside one transaction.

import { randomUUID } from "node:crypto";
import { callGenesis, extractJson } from "../llm/client.js";
import { loadPrompt } from "../prompts/loader.js";
import { genesisOutputSchema } from "../world/schemas.js";
import type { Db } from "../db/index.js";
import type { World } from "../world/types.js";

export interface GenesisOptions {
  premise: string;
  name?: string;       // override the model's chosen name
  tone?: string;       // optional flavor hint
}

export async function genesis(db: Db, opts: GenesisOptions): Promise<World> {
  const system = loadPrompt("genesis");
  const user = `Premise: ${opts.premise.trim()}\n${opts.tone ? `Tone hint: ${opts.tone}\n` : ""}Produce the world. Return only the fenced JSON block.`;

  const raw = await callGenesis({ system, user, maxTokens: 4096 });
  const parsed = genesisOutputSchema.parse(extractJson(raw));

  // Cross-references
  const locIds = new Set(parsed.locations.map((l) => l.id));
  const charIds = new Set(parsed.characters.map((c) => c.id));

  for (const c of parsed.characters) {
    if (!locIds.has(c.where)) {
      throw new Error(`Genesis: character ${c.id} placed at unknown location ${c.where}`);
    }
  }
  for (const p of parsed.plots) {
    for (const cid of p.central) {
      if (!charIds.has(cid))
        throw new Error(`Genesis: plot ${p.id} references unknown character ${cid}`);
    }
  }
  for (const r of parsed.relationships) {
    if (!charIds.has(r.fromId) || !charIds.has(r.toId)) {
      throw new Error(`Genesis: relationship references unknown character`);
    }
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const world: World = {
    id,
    name: opts.name ?? parsed.world.name,
    premise: opts.premise.trim(),
    tone: parsed.world.tone,
    themes: parsed.world.themes,
    era: parsed.world.era,
    inWorldDate: parsed.world.inWorldDate,
    tick: 0,
    createdAt: now,
    updatedAt: now,
  };

  db.raw.transaction(() => {
    db.insertWorld(world);
    for (const l of parsed.locations) {
      db.insertLocation({ ...l, worldId: id });
    }
    for (const c of parsed.characters) {
      db.insertCharacter({
        ...c,
        worldId: id,
        alive: true,
      });
    }
    for (const p of parsed.plots) {
      db.insertPlot({
        ...p,
        worldId: id,
        beats: [], // beats accrue over time; the seeded "hooks" are breadcrumbs only
      });
    }
    for (const r of parsed.relationships) {
      db.upsertRelationship({
        ...r,
        worldId: id,
      });
    }
  })();

  return world;
}
