// Director agent: picks the next beat. Sees plots (with tier, last
// advanced), factions, prophecies, characters (grouped by weight), and
// recent chronicle titles. Does NOT see character thoughts or memories.
// Receives prophecy hidden meanings — the director is the only agent that
// does. Never serialise hidden meanings to non-director outputs.

import { callDirector } from "../llm/client.js";
import { loadPrompt } from "../prompts/loader.js";
import { directorPlanSchema, type DirectorPlanParsed } from "../world/schemas.js";
import type { Db } from "../db/index.js";
import type { WorldId } from "../world/types.js";
import { runAgent } from "./_runAgent.js";
import type { RepairIssue } from "../llm/repair.js";

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

  // Cadence telemetry: concrete counters the director can read and act on.
  // The prompt's rules ("if last 3 entries shared a location, move the
  // camera"; "1 in 3 entries should be atmospheric-focal") only bite if the
  // model can see the counters — otherwise it imagines them and gets it
  // wrong. We compute them here from the recent entries so the prompt has
  // something to ground against.
  const RECENT_WINDOW = 6;
  const cadenceWindow = db.listEntries(worldId, RECENT_WINDOW);
  const charWeight = new Map(characters.map((c) => [c.id, c.weight]));

  const beatTypeStreak = (() => {
    if (cadenceWindow.length === 0) return { type: null as string | null, length: 0 };
    const head = cadenceWindow[0]!.beatType;
    let n = 0;
    for (const e of cadenceWindow) {
      if (e.beatType === head) n++;
      else break;
    }
    return { type: head, length: n };
  })();

  const recentLocationIds = cadenceWindow
    .flatMap((e) => e.locationIds)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 6);

  const sameLocationStreak = (() => {
    if (cadenceWindow.length === 0) return { locationId: null as string | null, length: 0 };
    const head = cadenceWindow[0]!.locationIds[0];
    if (!head) return { locationId: null, length: 0 };
    let n = 0;
    for (const e of cadenceWindow) {
      if (e.locationIds[0] === head) n++;
      else break;
    }
    return { locationId: head, length: n };
  })();

  const ticksSinceWorldReport = (() => {
    const idx = cadenceWindow.findIndex((e) => e.beatType === "world_report");
    return idx === -1 ? cadenceWindow.length + 1 : idx;
  })();

  const ticksSinceAtmosphericFocal = (() => {
    const idx = cadenceWindow.findIndex((e) =>
      e.characterIds.some((cid) => charWeight.get(cid) === "atmospheric"),
    );
    return idx === -1 ? cadenceWindow.length + 1 : idx;
  })();

  const ticksSincePrivate = (() => {
    const idx = cadenceWindow.findIndex((e) => e.beatType === "private");
    return idx === -1 ? cadenceWindow.length + 1 : idx;
  })();

  // Per-principal: ticks since they were last focal. The prompt asks the
  // director to weight back in any principal off-stage 8+ ticks.
  const principalLastFocal = new Map<string, number>();
  for (const p of principal) {
    const idx = cadenceWindow.findIndex((e) => e.characterIds.includes(p.id));
    principalLastFocal.set(p.id, idx === -1 ? Infinity : idx);
  }
  const stalePrincipals = principal
    .map((p) => ({
      id: p.id,
      name: p.name,
      ticksSinceFocal: principalLastFocal.get(p.id) ?? Infinity,
    }))
    .filter((p) => p.ticksSinceFocal >= RECENT_WINDOW)
    .map((p) => ({ ...p, ticksSinceFocal: p.ticksSinceFocal === Infinity ? null : p.ticksSinceFocal }));

  const ctx = {
    world: {
      name: world.name,
      premise: world.premise,
      era: world.era,
      tone: world.tone,
      themes: world.themes,
      tick: world.tick,
      inWorldDate: world.inWorldDate,
      // The far horizon the chronicle is bending toward. Director-only.
      // Empty for older worlds (no horizon set at their genesis).
      worldHorizon: world.worldHorizon,
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
    // Cadence counters — ground the prompt's cadence rules against actual
    // recent state, not the model's guess of it.
    cadence: {
      beatTypeStreak,            // {type, length} of the last run of same-type beats
      sameLocationStreak,        // {locationId, length}
      recentLocationIds,         // distinct locations across last 6 entries (for "move the camera")
      ticksSinceWorldReport,     // entries since the last world_report
      ticksSinceAtmosphericFocal,// entries since an atmospheric character was focal
      ticksSincePrivate,         // entries since the last "private" beat
      stalePrincipals,           // principals not focal in 6+ entries (or never)
    },
  };

  const plotIds = new Set(plots.map((p) => p.id));
  const locIds = new Set(locations.map((l) => l.id));
  const factionIds = new Set(factions.map((f) => f.id));
  const prophecyIds = new Set(prophecies.map((p) => p.id));
  const charIds = new Set(characters.map((c) => c.id));

  return runAgent({
    label: "director",
    call: callDirector,
    system: loadPrompt("director"),
    user: `Current world state (tick ${world.tick}):\n\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`\n\nReturn the plan for the next chronicle entry as a single fenced JSON block.`,
    schema: directorPlanSchema,
    maxTokens: 4000,
    validate: (plan) => validateDirectorPlan(plan, { plotIds, locIds, factionIds, prophecyIds, charIds }),
  });
}

interface KnownIds {
  plotIds: Set<string>;
  locIds: Set<string>;
  factionIds: Set<string>;
  prophecyIds: Set<string>;
  charIds: Set<string>;
}

function validateDirectorPlan(
  plan: DirectorPlanParsed,
  ids: KnownIds,
): RepairIssue[] {
  const issues: RepairIssue[] = [];

  // Beat-shape validation: world_report may omit plot/location/cast.
  // Everything else must have plot, location, and ≥1 character.
  if (plan.beatType === "world_report") {
    if (plan.plotId && !ids.plotIds.has(plan.plotId)) {
      issues.push({ path: "plotId", message: `unknown plot id "${plan.plotId}" (or omit for world_report)` });
    }
    if (plan.locationId && !ids.locIds.has(plan.locationId)) {
      issues.push({ path: "locationId", message: `unknown location id "${plan.locationId}" (or omit for world_report)` });
    }
  } else {
    if (!plan.plotId) {
      issues.push({ path: "plotId", message: `${plan.beatType} beat requires plotId` });
    } else if (!ids.plotIds.has(plan.plotId)) {
      issues.push({ path: "plotId", message: `unknown plot id "${plan.plotId}"` });
    }
    if (!plan.locationId) {
      issues.push({ path: "locationId", message: `${plan.beatType} beat requires locationId` });
    } else if (!ids.locIds.has(plan.locationId)) {
      issues.push({ path: "locationId", message: `unknown location id "${plan.locationId}"` });
    }
    if (plan.characterIds.length < 1) {
      issues.push({ path: "characterIds", message: `${plan.beatType} beat requires at least one focal character` });
    }
    if (plan.beatType === "private" && plan.characterIds.length > 2) {
      issues.push({
        path: "characterIds",
        message: `private beat is for 1–2 characters; got ${plan.characterIds.length}. trim the cast or pick a different beatType`,
      });
    }
  }
  if (plan.factionId && !ids.factionIds.has(plan.factionId)) {
    issues.push({ path: "factionId", message: `unknown faction id "${plan.factionId}" (or omit)` });
  }
  if (plan.prophecyId && !ids.prophecyIds.has(plan.prophecyId)) {
    issues.push({ path: "prophecyId", message: `unknown prophecy id "${plan.prophecyId}" (or omit)` });
  }

  // Spawn validation. Spawned ids must be fresh; spawned plots/characters
  // must reference existing locations/factions/characters.
  const knownChar = new Set(ids.charIds);
  if (plan.spawnCharacter) {
    const sc = plan.spawnCharacter;
    if (knownChar.has(sc.id)) {
      issues.push({ path: "spawnCharacter.id", message: `id "${sc.id}" already exists — pick a fresh id` });
    }
    if (!ids.locIds.has(sc.where)) {
      issues.push({ path: "spawnCharacter.where", message: `unknown location id "${sc.where}"` });
    }
    if (sc.factionId && !ids.factionIds.has(sc.factionId)) {
      issues.push({ path: "spawnCharacter.factionId", message: `unknown faction id "${sc.factionId}" (or omit)` });
    }
    knownChar.add(sc.id);
  }
  if (plan.spawnPlot) {
    const sp = plan.spawnPlot;
    if (ids.plotIds.has(sp.id)) {
      issues.push({ path: "spawnPlot.id", message: `id "${sp.id}" already exists — pick a fresh id` });
    }
    for (const cid of sp.central) {
      if (!knownChar.has(cid)) {
        issues.push({ path: "spawnPlot.central", message: `unknown character id "${cid}"` });
      }
    }
    for (const fid of sp.factionIds) {
      if (!ids.factionIds.has(fid)) {
        issues.push({ path: "spawnPlot.factionIds", message: `unknown faction id "${fid}"` });
      }
    }
  }

  // After spawn registration, characterIds (the focal cast) may reference
  // the freshly spawned character.
  for (const cid of plan.characterIds) {
    if (!knownChar.has(cid)) {
      issues.push({ path: "characterIds", message: `unknown character id "${cid}"` });
    }
  }

  return issues;
}
