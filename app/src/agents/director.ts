// Director agent: picks the next beat. Sees plots, characters (shallow),
// locations, and recent chronicle titles. Does NOT see character thoughts
// or memories.

import { callDirector, extractJson } from "../llm/client.js";
import { loadPrompt } from "../prompts/loader.js";
import { directorPlanSchema, type DirectorPlanParsed } from "../world/schemas.js";
import type { Db } from "../db/index.js";
import type { WorldId } from "../world/types.js";

export async function director(db: Db, worldId: WorldId): Promise<DirectorPlanParsed> {
  const world = db.getWorld(worldId);
  if (!world) throw new Error(`world ${worldId} not found`);
  const characters = db.listCharacters(worldId);
  const locations = db.listLocations(worldId);
  const plots = db.listPlots(worldId);
  const recent = db.listEntries(worldId, 4);

  const ctx = {
    world: {
      name: world.name,
      premise: world.premise,
      era: world.era,
      tone: world.tone,
      themes: world.themes,
      inWorldDate: world.inWorldDate,
    },
    plots: plots.map((p) => ({
      id: p.id,
      title: p.title,
      state: p.state,
      tension: p.tension,
      arc: p.arc,
      central: p.central,
      hooks: p.hooks,
      lastBeats: p.beats.slice(-3),
    })),
    characters: characters.map((c) => ({
      id: c.id,
      name: c.name,
      epithet: c.epithet,
      where: c.where,
      mood: c.mood.dominant,
      alive: c.alive,
    })),
    locations: locations.map((l) => ({ id: l.id, name: l.name, type: l.type })),
    recentEntries: recent.map((e) => ({
      title: e.title,
      inWorldDate: e.inWorldDate,
      plotIds: e.plotIds,
      locationIds: e.locationIds,
      characterIds: e.characterIds,
    })),
  };

  const raw = await callDirector({
    system: loadPrompt("director"),
    user: `Current world state:\n\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`\n\nReturn the plan for the next chronicle entry as a single fenced JSON block.`,
    maxTokens: 1024,
  });

  const plan = directorPlanSchema.parse(extractJson(raw));

  // Cross-check ids
  if (!plots.find((p) => p.id === plan.plotId))
    throw new Error(`Director chose unknown plot ${plan.plotId}`);
  if (!locations.find((l) => l.id === plan.locationId))
    throw new Error(`Director chose unknown location ${plan.locationId}`);
  for (const cid of plan.characterIds) {
    if (!characters.find((c) => c.id === cid))
      throw new Error(`Director chose unknown character ${cid}`);
  }
  return plan;
}
