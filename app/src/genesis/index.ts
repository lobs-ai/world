// Genesis pipeline: premise -> seeded world.
// Three stages, three LLM calls, each independently parseable, validatable,
// repairable, and cacheable:
//   1) Frame      — world meta, deep history, locations, factions,
//                   principals (5–8), plots, prophecies, principal-only
//                   relationships.
//   2) Secondaries — 8–15 recurring characters bound to factions and
//                    principals.
//   3) Atmospherics — 15–25 named-but-rare NPCs spread across locations.
//
// On schema or referential failure, the stage is re-prompted with a focused
// fix-up message (`parseAndRepair`) up to a small bound. On success, the
// stage is cached to disk so a later-stage failure doesn't lose earlier
// progress — a retry resumes from the last completed stage. After full
// commit to the DB, the cache is cleared.

import { randomUUID } from "node:crypto";
import { callGenesis } from "../llm/client.js";
import { loadPrompt } from "../prompts/loader.js";
import {
  genesisAtmosphericsSchema,
  genesisFrameSchema,
  genesisSecondariesSchema,
  type GenesisAtmospherics,
  type GenesisFrame,
  type GenesisSecondaries,
} from "../world/schemas.js";
import type { Db } from "../db/index.js";
import type { World } from "../world/types.js";
import { openStageCache, runIdFor, type StageCache } from "./cache.js";
import {
  buildRepairPrompt,
  parseAndRepair,
  type RepairIssue,
} from "../llm/repair.js";
import {
  dropStaleRelationships,
  frameContext,
  frameIssues,
  stageCharacterIssues,
  type FrameContext,
} from "./refs.js";
import { imageForCharacter, imageForLocation } from "../images/index.js";
import type { ZodTypeAny, infer as ZInfer } from "zod";

const MAX_TOKENS = 32768;
const REPAIR_ATTEMPTS = 3;

export interface GenesisOptions {
  premise: string;
  name?: string;
  tone?: string;
  // skip stage 2/3 — useful for a quick smoke test of just the spine.
  framedOnly?: boolean;
  // ignore on-disk cache; always re-call every stage.
  fresh?: boolean;
}

// ── Frame summary (for downstream stage prompts) ────────────────────────────

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

// ── Stage runner ────────────────────────────────────────────────────────────

interface StageRunArgs<S extends ZodTypeAny> {
  cache: StageCache;
  stageName: string;
  schema: S;
  label: string;
  buildPrompt: () => { system: string; user: string };
  extraIssues?: (parsed: ZInfer<S>) => RepairIssue[];
  log: (msg: string) => void;
}

async function runStage<S extends ZodTypeAny>(
  args: StageRunArgs<S>,
): Promise<ZInfer<S>> {
  if (args.cache.has(args.stageName)) {
    args.log(`        ↳ resuming "${args.stageName}" from cache`);
    return args.cache.read<ZInfer<S>>(args.stageName) as ZInfer<S>;
  }

  const { system, user } = args.buildPrompt();
  const initialRaw = await callGenesis({
    system,
    user,
    maxTokens: MAX_TOKENS,
  });

  const parsed = await parseAndRepair<S>({
    label: args.label,
    schema: args.schema,
    initialRaw,
    extraIssues: args.extraIssues,
    maxAttempts: REPAIR_ATTEMPTS,
    onAttempt: (attempt, issues, accepted) => {
      if (accepted) {
        if (attempt > 1) {
          args.log(`        ✓ repaired on attempt ${attempt}/${REPAIR_ATTEMPTS}`);
        }
        return;
      }
      if (attempt < REPAIR_ATTEMPTS) {
        args.log(
          `        ✗ attempt ${attempt}/${REPAIR_ATTEMPTS}: ${issues.length} issue${issues.length === 1 ? "" : "s"} — re-prompting`,
        );
      }
    },
    repair: async (previousRaw, issues) => {
      const repairUser = buildRepairPrompt(previousRaw, issues);
      return callGenesis({
        system,
        user: repairUser,
        maxTokens: MAX_TOKENS,
      });
    },
  });

  args.cache.write(args.stageName, parsed);
  return parsed;
}

// ── Stage prompt builders ───────────────────────────────────────────────────

function framePrompt(opts: GenesisOptions): { system: string; user: string } {
  return {
    system: loadPrompt("genesis_frame"),
    user:
      `Premise: ${opts.premise.trim()}\n` +
      (opts.tone ? `Tone hint: ${opts.tone}\n` : "") +
      `Produce the world frame. Return only the fenced JSON block.`,
  };
}

function secondariesPrompt(
  opts: GenesisOptions,
  frame: GenesisFrame,
): { system: string; user: string } {
  const summary = makeFrameSummary(frame);
  return {
    system: loadPrompt("genesis_secondaries"),
    user:
      `Premise: ${opts.premise}\n\n` +
      `The world has been framed. Produce the secondaries.\n\n` +
      `Frame:\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n\n` +
      `Return only the fenced JSON.`,
  };
}

function atmosphericsPrompt(
  opts: GenesisOptions,
  frame: GenesisFrame,
  secondaries: GenesisSecondaries,
): { system: string; user: string } {
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
  return {
    system: loadPrompt("genesis_atmospherics"),
    user:
      `Premise: ${opts.premise}\n\n` +
      `The world has been framed and the secondaries placed. Produce the atmospheric population.\n\n` +
      `World:\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`\n\n` +
      `Return only the fenced JSON.`,
  };
}

// ── Orchestration ───────────────────────────────────────────────────────────

export async function genesis(db: Db, opts: GenesisOptions): Promise<World> {
  const runId = runIdFor(opts.premise);
  const cache = openStageCache(runId);
  if (opts.fresh) cache.clear();

  const log = (m: string) => console.error(m);
  const totalStages = opts.framedOnly ? 1 : 3;

  // ── Stage 1: frame ────────────────────────────────────────────────────────
  log(`  [1/${totalStages}] framing world (locations, factions, principals, plots, prophecies)…`);
  const t0 = Date.now();
  const frame = await runStage({
    cache,
    stageName: "frame",
    schema: genesisFrameSchema,
    label: "Genesis frame",
    buildPrompt: () => framePrompt(opts),
    extraIssues: (f) => frameIssues(f),
    log,
  });
  log(
    `        frame complete in ${((Date.now() - t0) / 1000).toFixed(1)}s — ` +
      `${frame.locations.length} loc, ${frame.factions.length} fac, ` +
      `${frame.characters.length} principals, ${frame.plots.length} plots`,
  );

  // ── Stage 2: secondaries ──────────────────────────────────────────────────
  let secondaries: GenesisSecondaries = { characters: [], relationships: [] };
  let ctx: FrameContext = frameContext(frame);
  if (!opts.framedOnly) {
    log(`  [2/${totalStages}] generating secondary characters…`);
    const t1 = Date.now();
    secondaries = await runStage({
      cache,
      stageName: "secondaries",
      schema: genesisSecondariesSchema,
      label: "Genesis secondaries",
      buildPrompt: () => secondariesPrompt(opts, frame),
      extraIssues: (s) => stageCharacterIssues(s, ctx, "secondary"),
      log,
    });
    for (const c of secondaries.characters) ctx.charIds.add(c.id);
    log(
      `        secondaries complete in ${((Date.now() - t1) / 1000).toFixed(1)}s — ` +
        `${secondaries.characters.length} characters`,
    );
  }

  // ── Stage 3: atmospherics ─────────────────────────────────────────────────
  let atmospherics: GenesisAtmospherics = { characters: [], relationships: [] };
  if (!opts.framedOnly) {
    log(`  [3/${totalStages}] generating atmospheric NPCs…`);
    const t2 = Date.now();
    atmospherics = await runStage({
      cache,
      stageName: "atmospherics",
      schema: genesisAtmosphericsSchema,
      label: "Genesis atmospherics",
      buildPrompt: () => atmosphericsPrompt(opts, frame, secondaries),
      extraIssues: (a) => stageCharacterIssues(a, ctx, "atmospheric"),
      log,
    });
    for (const c of atmospherics.characters) ctx.charIds.add(c.id);
    log(
      `        atmospherics complete in ${((Date.now() - t2) / 1000).toFixed(1)}s — ` +
        `${atmospherics.characters.length} characters`,
    );
  }

  // ── Drop stale relationships across all stages ────────────────────────────
  // Relationship references are noise the model frequently invents. We don't
  // re-prompt for them — that wastes 30-60s for a non-load-bearing field.
  const allCharIds = new Set([
    ...frame.characters.map((c) => c.id),
    ...secondaries.characters.map((c) => c.id),
    ...atmospherics.characters.map((c) => c.id),
  ]);
  const frameRels = dropStaleRelationships(frame.relationships, allCharIds);
  const secRels = dropStaleRelationships(secondaries.relationships, allCharIds);
  const atmRels = dropStaleRelationships(atmospherics.relationships, allCharIds);
  const totalDropped = frameRels.dropped + secRels.dropped + atmRels.dropped;
  if (totalDropped > 0) {
    log(`        dropped ${totalDropped} relationship${totalDropped === 1 ? "" : "s"} with unknown character ids`);
  }
  const allRelationships = [...frameRels.kept, ...secRels.kept, ...atmRels.kept];

  // ── Commit ────────────────────────────────────────────────────────────────
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

  // Success — clear the cache. Failure leaves it in place so a retry resumes.
  cache.clear();

  // Fire-and-forget image generation. Principal/secondary portraits and
  // location plates are one-shot per world and cached forever. Atmospherics
  // skip — there are too many; the director can request portraits for the
  // ones it actually pulls into focus mid-chronicle.
  const imageEligible = [
    ...frame.characters,
    ...secondaries.characters,
  ];
  for (const c of imageEligible) imageForCharacter(db, world, c.id);
  for (const l of frame.locations) imageForLocation(db, world, l.id);

  return world;
}
