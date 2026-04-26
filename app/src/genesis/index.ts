// Genesis pipeline: premise -> seeded world.
// Three stages, three LLM calls:
//   1) Frame      — world meta, deep history, locations, factions,
//                    principals (5–8), plots, prophecies, principal-only
//                    relationships.
//   2) Secondaries — 8–15 recurring characters bound to factions and
//                    principals.
//   3) Atmospherics — 15–25 named-but-rare NPCs spread across locations.
// All output is parsed against tight Zod schemas, referentially
// cross-checked, and committed in one transaction.

import { randomUUID } from "node:crypto";
import { callGenesis, extractJson } from "../llm/client.js";
import { loadPrompt } from "../prompts/loader.js";
import {
  genesisAtmosphericsSchema,
  genesisFrameSchema,
  genesisSecondariesSchema,
  type GenesisFrame,
  type GenesisSecondaries,
  type GenesisAtmospherics,
} from "../world/schemas.js";
import type { Db } from "../db/index.js";
import type { World } from "../world/types.js";

export interface GenesisOptions {
  premise: string;
  name?: string;
  tone?: string;
  // skip stage 2/3 — useful for a quick smoke test of just the spine.
  framedOnly?: boolean;
}

interface FrameSummary {
  worldName: string;
  tone: string;
  themes: string[];
  era: string;
  inWorldDate: string;
  deepHistory: GenesisFrame["deepHistory"];
  locations: { id: string; name: string; type: string }[];
  factions: { id: string; name: string; banner: string; summary: string }[];
  principals: {
    id: string;
    name: string;
    epithet: string;
    where: string;
    factionId?: string;
    summary: string;
  }[];
  plots: { id: string; title: string; tier: string; arc: string }[];
  prophecies: { id: string; text: string }[];
}

function makeFrameSummary(f: GenesisFrame): FrameSummary {
  return {
    worldName: f.world.name,
    tone: f.world.tone,
    themes: f.world.themes,
    era: f.world.era,
    inWorldDate: f.world.inWorldDate,
    deepHistory: f.deepHistory,
    locations: f.locations.map((l) => ({ id: l.id, name: l.name, type: l.type })),
    factions: f.factions.map((fa) => ({
      id: fa.id,
      name: fa.name,
      banner: fa.banner,
      summary: fa.summary,
    })),
    principals: f.characters.map((c) => ({
      id: c.id,
      name: c.name,
      epithet: c.epithet,
      where: c.where,
      factionId: c.factionId,
      summary: c.summary,
    })),
    plots: f.plots.map((p) => ({ id: p.id, title: p.title, tier: p.tier, arc: p.arc })),
    prophecies: f.prophecies.map((p) => ({ id: p.id, text: p.text })),
  };
}

async function runFrame(opts: GenesisOptions): Promise<GenesisFrame> {
  const system = loadPrompt("genesis_frame");
  const user = `Premise: ${opts.premise.trim()}\n${opts.tone ? `Tone hint: ${opts.tone}\n` : ""}Produce the world frame. Return only the fenced JSON block.`;
  const raw = await callGenesis({ system, user, maxTokens: 32768 });
  return genesisFrameSchema.parse(extractJson(raw));
}

async function runSecondaries(
  premise: string,
  frame: GenesisFrame,
): Promise<GenesisSecondaries> {
  const system = loadPrompt("genesis_secondaries");
  const summary = makeFrameSummary(frame);
  const user = `Premise: ${premise}\n\nThe world has been framed. Produce the secondaries.\n\nFrame:\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n\nReturn only the fenced JSON.`;
  const raw = await callGenesis({ system, user, maxTokens: 32768 });
  return genesisSecondariesSchema.parse(extractJson(raw));
}

async function runAtmospherics(
  premise: string,
  frame: GenesisFrame,
  secondaries: GenesisSecondaries,
): Promise<GenesisAtmospherics> {
  const system = loadPrompt("genesis_atmospherics");
  const summary = makeFrameSummary(frame);
  const ctx = {
    ...summary,
    secondaries: secondaries.characters.map((c) => ({
      id: c.id,
      name: c.name,
      epithet: c.epithet,
      where: c.where,
      factionId: c.factionId,
      summary: c.summary,
    })),
  };
  const user = `Premise: ${premise}\n\nThe world has been framed and the secondaries placed. Produce the atmospheric population.\n\nWorld:\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`\n\nReturn only the fenced JSON.`;
  const raw = await callGenesis({ system, user, maxTokens: 32768 });
  return genesisAtmosphericsSchema.parse(extractJson(raw));
}

export async function genesis(db: Db, opts: GenesisOptions): Promise<World> {
  const totalStages = opts.framedOnly ? 1 : 3;
  console.error(`  [1/${totalStages}] framing world (locations, factions, principals, plots, prophecies)…`);
  const t0 = Date.now();
  const frame = await runFrame(opts);
  console.error(`        frame complete in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${frame.locations.length} loc, ${frame.factions.length} fac, ${frame.characters.length} principals, ${frame.plots.length} plots`);

  // ── Stage 1 cross-checks ────────────────────────────────────────────
  const locIds = new Set(frame.locations.map((l) => l.id));
  const factionIds = new Set(frame.factions.map((f) => f.id));
  const charIds = new Set(frame.characters.map((c) => c.id));
  const plotIds = new Set(frame.plots.map((p) => p.id));

  for (const c of frame.characters) {
    if (c.weight !== "principal")
      throw new Error(`Genesis frame: character ${c.id} must be principal, got ${c.weight}`);
    if (!locIds.has(c.where))
      throw new Error(`Genesis frame: character ${c.id} placed at unknown location ${c.where}`);
    if (c.factionId && !factionIds.has(c.factionId))
      throw new Error(`Genesis frame: character ${c.id} affiliated with unknown faction ${c.factionId}`);
  }
  for (const f of frame.factions) {
    if (f.seatLocationId && !locIds.has(f.seatLocationId))
      throw new Error(`Genesis frame: faction ${f.id} seated at unknown location ${f.seatLocationId}`);
  }
  for (const p of frame.plots) {
    for (const cid of p.central) {
      if (!charIds.has(cid))
        throw new Error(`Genesis frame: plot ${p.id} references unknown character ${cid}`);
    }
    for (const fid of p.factionIds) {
      if (!factionIds.has(fid))
        throw new Error(`Genesis frame: plot ${p.id} references unknown faction ${fid}`);
    }
  }
  for (const pr of frame.prophecies) {
    for (const pid of pr.relatedPlotIds) {
      if (!plotIds.has(pid))
        throw new Error(`Genesis frame: prophecy ${pr.id} references unknown plot ${pid}`);
    }
    for (const cid of pr.relatedCharacterIds) {
      if (!charIds.has(cid))
        throw new Error(`Genesis frame: prophecy ${pr.id} references unknown character ${cid}`);
    }
    if (pr.targetPayoffMax <= pr.targetPayoffMin)
      throw new Error(`Genesis frame: prophecy ${pr.id} has empty payoff window`);
  }
  for (const r of frame.relationships) {
    if (!charIds.has(r.fromId) || !charIds.has(r.toId))
      throw new Error(`Genesis frame: relationship references unknown character`);
  }
  const spinePlots = frame.plots.filter((p) => p.tier === "spine");
  if (spinePlots.length !== 1)
    throw new Error(`Genesis frame: expected exactly one spine plot, got ${spinePlots.length}`);

  // ── Stage 2 ─────────────────────────────────────────────────────────
  let secondaries: GenesisSecondaries = { characters: [], relationships: [] };
  if (!opts.framedOnly) {
    console.error(`  [2/${totalStages}] generating secondary characters…`);
    const t1 = Date.now();
    secondaries = await runSecondaries(opts.premise, frame);
    console.error(`        secondaries complete in ${((Date.now() - t1) / 1000).toFixed(1)}s — ${secondaries.characters.length} characters`);
    for (const c of secondaries.characters) {
      if (c.weight !== "secondary")
        throw new Error(`Genesis secondaries: ${c.id} must be secondary, got ${c.weight}`);
      if (!locIds.has(c.where))
        throw new Error(`Genesis secondaries: ${c.id} placed at unknown location ${c.where}`);
      if (c.factionId && !factionIds.has(c.factionId))
        throw new Error(`Genesis secondaries: ${c.id} affiliated with unknown faction ${c.factionId}`);
      if (charIds.has(c.id))
        throw new Error(`Genesis secondaries: duplicate character id ${c.id}`);
      charIds.add(c.id);
    }
    for (const r of secondaries.relationships) {
      if (!charIds.has(r.fromId) || !charIds.has(r.toId))
        throw new Error(`Genesis secondaries: relationship references unknown character`);
    }
  }

  // ── Stage 3 ─────────────────────────────────────────────────────────
  let atmospherics: GenesisAtmospherics = { characters: [], relationships: [] };
  if (!opts.framedOnly) {
    console.error(`  [3/${totalStages}] generating atmospheric NPCs…`);
    const t2 = Date.now();
    atmospherics = await runAtmospherics(opts.premise, frame, secondaries);
    console.error(`        atmospherics complete in ${((Date.now() - t2) / 1000).toFixed(1)}s — ${atmospherics.characters.length} characters`);
    for (const c of atmospherics.characters) {
      if (c.weight !== "atmospheric")
        throw new Error(`Genesis atmospherics: ${c.id} must be atmospheric, got ${c.weight}`);
      if (!locIds.has(c.where))
        throw new Error(`Genesis atmospherics: ${c.id} placed at unknown location ${c.where}`);
      if (c.factionId && !factionIds.has(c.factionId))
        throw new Error(`Genesis atmospherics: ${c.id} unknown faction ${c.factionId}`);
      if (charIds.has(c.id))
        throw new Error(`Genesis atmospherics: duplicate character id ${c.id}`);
      charIds.add(c.id);
    }
    for (const r of atmospherics.relationships) {
      if (!charIds.has(r.fromId) || !charIds.has(r.toId))
        throw new Error(`Genesis atmospherics: relationship references unknown character`);
    }
  }

  // ── Commit ──────────────────────────────────────────────────────────
  const id = randomUUID();
  const now = new Date().toISOString();
  const world: World = {
    id,
    name: opts.name ?? frame.world.name,
    premise: opts.premise.trim(),
    tone: frame.world.tone,
    themes: frame.world.themes,
    era: frame.world.era,
    inWorldDate: frame.world.inWorldDate,
    tick: 0,
    deepHistory: frame.deepHistory,
    createdAt: now,
    updatedAt: now,
  };

  const allCharacters = [
    ...frame.characters,
    ...secondaries.characters,
    ...atmospherics.characters,
  ];
  const allRelationships = [
    ...frame.relationships,
    ...secondaries.relationships,
    ...atmospherics.relationships,
  ];

  db.raw.transaction(() => {
    db.insertWorld(world);
    for (const l of frame.locations) {
      db.insertLocation({ ...l, worldId: id });
    }
    for (const f of frame.factions) {
      db.insertFaction({
        ...f,
        worldId: id,
        lastAdvancedTick: 0,
      });
    }
    for (const c of allCharacters) {
      db.insertCharacter({
        ...c,
        worldId: id,
        alive: true,
        secrets: c.secrets,
      });
    }
    for (const p of frame.plots) {
      db.insertPlot({
        ...p,
        worldId: id,
        beats: [],
        lastAdvancedTick: 0,
      });
    }
    for (const pr of frame.prophecies) {
      db.insertProphecy({
        ...pr,
        worldId: id,
        plantedTick: 0,
        status: "unfulfilled",
        echoes: 0,
      });
    }
    for (const r of allRelationships) {
      db.upsertRelationship({
        ...r,
        worldId: id,
      });
    }
  })();

  return world;
}
