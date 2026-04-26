// Director agent: picks the next beat. Sees plots (with tier, last
// advanced), factions, prophecies, characters (grouped by weight), and
// recent chronicle titles. Does NOT see character thoughts or memories.
// Receives prophecy hidden meanings — the director is the only agent that
// does. Never serialise hidden meanings to non-director outputs.

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
  const factions = db.listFactions(worldId);
  const prophecies = db.listProphecies(worldId);
  const recent = db.listEntries(worldId, 4);

  const principal = characters.filter((c) => c.weight === "principal");
  const secondary = characters.filter((c) => c.weight === "secondary");
  const atmospheric = characters.filter((c) => c.weight === "atmospheric");

  const ctx = {
    world: {
      name: world.name,
      premise: world.premise,
      era: world.era,
      tone: world.tone,
      themes: world.themes,
      tick: world.tick,
      inWorldDate: world.inWorldDate,
    },
    deepHistory: world.deepHistory,
    plots: plots.map((p) => ({
      id: p.id,
      title: p.title,
      tier: p.tier,
      state: p.state,
      tension: p.tension,
      arc: p.arc,
      central: p.central,
      factionIds: p.factionIds,
      hooks: p.hooks,
      lastAdvancedTick: p.lastAdvancedTick,
      ticksSinceAdvanced: world.tick - p.lastAdvancedTick,
      lastBeats: p.beats.slice(-3),
    })),
    factions: factions.map((f) => ({
      id: f.id,
      name: f.name,
      banner: f.banner,
      summary: f.summary,
      desires: f.desires,
      tension: f.tension,
      ticksSinceAdvanced: world.tick - f.lastAdvancedTick,
      seatLocationId: f.seatLocationId,
    })),
    prophecies: prophecies.map((p) => ({
      id: p.id,
      text: p.text,
      source: p.source,
      status: p.status,
      echoes: p.echoes,
      plantedTick: p.plantedTick,
      targetPayoffMin: p.targetPayoffMin,
      targetPayoffMax: p.targetPayoffMax,
      window:
        world.tick < p.targetPayoffMin
          ? "before"
          : world.tick > p.targetPayoffMax
            ? "overdue"
            : "open",
      relatedPlotIds: p.relatedPlotIds,
      relatedCharacterIds: p.relatedCharacterIds,
      hiddenMeaning: p.hiddenMeaning, // director-only — never echoed downstream
    })),
    cast: {
      principal: principal.map((c) => ({
        id: c.id, name: c.name, epithet: c.epithet,
        where: c.where, mood: c.mood.dominant, factionId: c.factionId,
        // Top desire surfaces so the director can steer scenes toward
        // what each character actually wants right now.
        topDesire: c.desires[0]?.goal,
        alive: c.alive,
      })),
      secondary: secondary.map((c) => ({
        id: c.id, name: c.name, epithet: c.epithet,
        where: c.where, factionId: c.factionId,
        topDesire: c.desires[0]?.goal,
        alive: c.alive,
      })),
      atmospheric: atmospheric.map((c) => ({
        id: c.id, name: c.name, epithet: c.epithet,
        where: c.where, factionId: c.factionId,
        // Atmospheric characters get their top desire surfaced too —
        // they are real people. The director needs this to know when an
        // atmospheric should be focal.
        topDesire: c.desires[0]?.goal,
        alive: c.alive,
      })),
    },
    locations: locations.map((l) => ({ id: l.id, name: l.name, type: l.type })),
    recentEntries: recent.map((e) => ({
      title: e.title,
      inWorldDate: e.inWorldDate,
      beatType: e.beatType,
      plotIds: e.plotIds,
      factionIds: e.factionIds,
      prophecyIds: e.prophecyIds,
      locationIds: e.locationIds,
      characterIds: e.characterIds,
    })),
  };

  const raw = await callDirector({
    system: loadPrompt("director"),
    user: `Current world state (tick ${world.tick}):\n\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`\n\nReturn the plan for the next chronicle entry as a single fenced JSON block.`,
    maxTokens: 1500,
  });

  const plan = directorPlanSchema.parse(extractJson(raw));

  // Beat-shape validation: world_report may omit plot/location/cast.
  // Everything else must have plot, location, and ≥1 character.
  if (plan.beatType === "world_report") {
    // optional ids must still resolve if given
    if (plan.plotId && !plots.find((p) => p.id === plan.plotId))
      throw new Error(`Director chose unknown plot ${plan.plotId}`);
    if (plan.locationId && !locations.find((l) => l.id === plan.locationId))
      throw new Error(`Director chose unknown location ${plan.locationId}`);
  } else {
    if (!plan.plotId)
      throw new Error(`Director: ${plan.beatType} beat requires plotId`);
    if (!plots.find((p) => p.id === plan.plotId))
      throw new Error(`Director chose unknown plot ${plan.plotId}`);
    if (!plan.locationId)
      throw new Error(`Director: ${plan.beatType} beat requires locationId`);
    if (!locations.find((l) => l.id === plan.locationId))
      throw new Error(`Director chose unknown location ${plan.locationId}`);
    if (plan.characterIds.length < 1)
      throw new Error(`Director: ${plan.beatType} beat requires at least one focal character`);
  }
  if (plan.factionId && !factions.find((f) => f.id === plan.factionId))
    throw new Error(`Director chose unknown faction ${plan.factionId}`);
  if (plan.prophecyId && !prophecies.find((p) => p.id === plan.prophecyId))
    throw new Error(`Director chose unknown prophecy ${plan.prophecyId}`);

  // Spawn validation. Spawned ids must be fresh; spawned plots/characters
  // must reference existing locations/factions/characters. The tick loop
  // applies these before character agents run, so a spawned character may
  // appear in characterIds.
  const knownCharIds = new Set(characters.map((c) => c.id));
  const knownLocIds = new Set(locations.map((l) => l.id));
  const knownFactionIds = new Set(factions.map((f) => f.id));
  const knownPlotIds = new Set(plots.map((p) => p.id));

  if (plan.spawnCharacter) {
    const sc = plan.spawnCharacter;
    if (knownCharIds.has(sc.id))
      throw new Error(`Director spawnCharacter: id ${sc.id} already exists`);
    if (!knownLocIds.has(sc.where))
      throw new Error(`Director spawnCharacter: unknown location ${sc.where}`);
    if (sc.factionId && !knownFactionIds.has(sc.factionId))
      throw new Error(`Director spawnCharacter: unknown faction ${sc.factionId}`);
    knownCharIds.add(sc.id);
  }
  if (plan.spawnPlot) {
    const sp = plan.spawnPlot;
    if (knownPlotIds.has(sp.id))
      throw new Error(`Director spawnPlot: id ${sp.id} already exists`);
    for (const cid of sp.central) {
      if (!knownCharIds.has(cid))
        throw new Error(`Director spawnPlot: unknown character ${cid}`);
    }
    for (const fid of sp.factionIds) {
      if (!knownFactionIds.has(fid))
        throw new Error(`Director spawnPlot: unknown faction ${fid}`);
    }
  }

  // After spawn registration, characterIds (the focal cast) may reference
  // the freshly spawned character.
  for (const cid of plan.characterIds) {
    if (!knownCharIds.has(cid))
      throw new Error(`Director chose unknown character ${cid}`);
  }

  return plan;
}
