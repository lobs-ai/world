// Zod schemas for everything that crosses an LLM boundary. The LLM proposes
// JSON; we parse against these schemas before any state change reaches the
// applier. Failed parses are loud failures, not silent fallbacks.

import { z } from "zod";

const id = z.string().regex(/^[a-z][a-z0-9_-]{1,40}$/);

// Long-form prose: tolerate overruns by truncating, not rejecting. The cap
// exists for storage and layout, not as a content gate — and the LLM is
// chronically verbose on summary/arc/hiddenMeaning/etc. We trim trailing
// whitespace so the cut isn't visibly mid-word-ish more than necessary.
//
//   softStr(600)            → at most 600 chars, trimmed
//   softStr(600, { min: 1 }) → also requires non-empty
const softStr = (
  max: number,
  opts: { min?: number } = {},
): z.ZodEffects<z.ZodString, string, unknown> => {
  const inner = opts.min !== undefined ? z.string().min(opts.min) : z.string();
  return z.preprocess((v) => {
    if (typeof v !== "string") return v;
    return v.length > max ? v.slice(0, max).replace(/\s+$/, "") : v;
  }, inner) as unknown as z.ZodEffects<z.ZodString, string, unknown>;
};

// Like softStr but with a default for fields the model frequently omits.
const softStrDef = (max: number, def = "") =>
  z
    .preprocess((v) => {
      if (v === undefined) return def;
      if (typeof v !== "string") return v;
      return v.length > max ? v.slice(0, max).replace(/\s+$/, "") : v;
    }, z.string())
    .default(def);

// Coerce stringified numbers ("47", "0.8") to numbers. The model copies the
// shape of nearby string fields and quotes age, intensity, tension, etc. We
// don't apply this globally (a string field with text "47" should stay a
// string) — only at the schema sites that ask for a number.
const coerceNumber = (v: unknown): unknown => {
  if (typeof v !== "string") return v;
  const trimmed = v.trim();
  if (trimmed === "") return v;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : v;
};

const softNum = (min?: number, max?: number) => {
  let inner = z.number();
  if (min !== undefined) inner = inner.min(min);
  if (max !== undefined) inner = inner.max(max);
  return z.preprocess(coerceNumber, inner);
};

const softInt = (min?: number, max?: number) => {
  let inner = z.number().int();
  if (min !== undefined) inner = inner.min(min);
  if (max !== undefined) inner = inner.max(max);
  return z.preprocess((v) => {
    const c = coerceNumber(v);
    return typeof c === "number" ? Math.round(c) : c;
  }, inner);
};

const softBool = () =>
  z.preprocess((v) => {
    if (typeof v === "string") {
      const t = v.trim().toLowerCase();
      if (t === "true" || t === "yes" || t === "1") return true;
      if (t === "false" || t === "no" || t === "0") return false;
    }
    return v;
  }, z.boolean());

// Map alternate key names onto the canonical shape. The LLM frequently picks
// shorter or differently-named keys ("from"/"to"/"type" instead of
// "fromId"/"toId"/"typeFromMe"). One pass at parse time, declared per-schema,
// is more dynamic than per-field error messages or rigid prompt repetition.
const aliasKeys = <T extends z.ZodTypeAny>(
  map: Record<string, string>,
  schema: T,
): z.ZodEffects<T, z.output<T>, unknown> =>
  z.preprocess((v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return v;
    const src = v as Record<string, unknown>;
    const out: Record<string, unknown> = { ...src };
    for (const [alias, canonical] of Object.entries(map)) {
      if (out[canonical] === undefined && src[alias] !== undefined) {
        out[canonical] = src[alias];
        delete out[alias];
      }
    }
    return out;
  }, schema) as z.ZodEffects<T, z.output<T>, unknown>;

// ── Genesis output ───────────────────────────────────────────────────────────

const moodSchema = z.object({
  dominant: softStr(400, { min: 1 }),
  valence: softNum(-1, 1),
  arousal: softNum(0, 1),
});

const desireSchema = z.object({
  goal: softStr(800, { min: 1 }),
  intensity: softNum(0, 1),
  unspoken: softBool().optional(),
});

const castWeightSchema = z.enum(["principal", "secondary", "atmospheric"]);

const characterSeedSchema = z.object({
  id,
  name: softStr(200, { min: 1 }),
  epithet: softStrDef(500),
  age: softInt(1, 120),
  where: z.string(),
  weight: castWeightSchema,
  factionId: z.string().optional(),
  portrait: softStr(1000, { min: 1 }),
  summary: softStr(3000, { min: 1 }),
  mood: moodSchema,
  desires: z.array(desireSchema).min(1).max(6),
  traits: z.record(softNum(0, 1)),
  // 1–4 private hooks. Required for every character — even atmospheric.
  // The character agent receives only their own.
  secrets: z.array(softStr(1200, { min: 4 })).min(1).max(4),
});

// Location `type` is a short descriptive noun phrase, not a closed enum —
// the LLM emits whatever fits the place: "capital", "inn", "marsh-shrine",
// "crossroads", "abbey", "seat of a great house". The UI renders it as a
// label ("a {type} of the realm") and no code path branches on the value.
const locationSeedSchema = z.object({
  id,
  name: softStr(200, { min: 1 }),
  type: softStr(160, { min: 1 }),
  description: softStr(3000, { min: 1 }),
  weather: softStrDef(600),
});

const beatTypeSchema = z.enum([
  "setup",
  "complication",
  "rising",
  "climax",
  "falling",
  "resolution",
  "world_report",
]);

const plotTierSchema = z.enum(["spine", "subplot", "ambient"]);

const plotSeedSchema = z.object({
  id,
  title: softStr(400, { min: 1 }),
  tier: plotTierSchema,
  state: z.enum(["seeded", "setup", "rising", "climax", "falling", "resolved"]),
  tension: softNum(0, 1),
  arc: softStr(4000, { min: 1 }),
  central: z.array(z.string()).min(1).max(8),
  factionIds: z.array(z.string()).max(8).default([]),
  themes: z.array(softStr(120)).max(8),
  hooks: z.array(softStr(800)).max(10),
});

const factionSeedSchema = z.object({
  id,
  name: softStr(200, { min: 1 }),
  banner: softStr(800, { min: 1 }),
  summary: softStr(3000, { min: 1 }),
  themes: z.array(softStr(120)).max(8).default([]),
  desires: z.array(desireSchema).min(1).max(5),
  tension: softNum(0, 1),
  seatLocationId: z.string().optional(),
});

const prophecySeedSchema = z.object({
  id,
  text: softStr(2000, { min: 8 }),
  source: softStr(800, { min: 1 }),
  targetPayoffMin: softInt(10, 500),
  targetPayoffMax: softInt(20, 800),
  relatedPlotIds: z.array(z.string()).max(8).default([]),
  relatedCharacterIds: z.array(z.string()).max(10).default([]),
  hiddenMeaning: softStr(2400).optional(),
});

const relationshipSeedSchema = aliasKeys(
  {
    from: "fromId",
    fromCharacterId: "fromId",
    fromCharId: "fromId",
    source: "fromId",
    a: "fromId",
    to: "toId",
    toCharacterId: "toId",
    toCharId: "toId",
    target: "toId",
    b: "toId",
    type: "typeFromMe",
    relation: "typeFromMe",
    relationship: "typeFromMe",
    kind: "typeFromMe",
    bond: "typeFromMe",
    affectionScore: "affection",
    affinity: "affection",
    trustScore: "trust",
    description: "note",
  },
  z.object({
    fromId: z.string(),
    toId: z.string(),
    typeFromMe: softStr(240, { min: 1 }),
    affection: softNum(-1, 1),
    trust: softNum(-1, 1),
    note: softStrDef(1200),
  }),
);

const deepHistoryFigureSchema = z.object({
  name: softStr(200, { min: 1 }),
  epithet: softStrDef(500),
  era: softStr(400, { min: 1 }),
  one_line: softStr(1200, { min: 1 }),
});

const deepHistoryEventSchema = z.object({
  title: softStr(400, { min: 1 }),
  era: softStr(400, { min: 1 }),
  one_line: softStr(1200, { min: 1 }),
});

const deepHistorySchema = z.object({
  ancients: z.array(deepHistoryFigureSchema).min(2).max(12),
  brokenOaths: z.array(deepHistoryEventSchema).max(10).default([]),
  fallenOrders: z.array(deepHistoryEventSchema).max(10).default([]),
  lostPlaces: z.array(deepHistoryEventSchema).max(10).default([]),
  cosmology: softStr(4000, { min: 1 }),
});

// Stage 1: the world frame. World meta, deep history, locations, factions,
// principals only, plots, prophecies, relationships among principals.
export const genesisFrameSchema = z.object({
  world: z.object({
    name: softStr(400, { min: 1 }),
    tone: softStr(400, { min: 1 }),
    themes: z.array(softStr(200)).min(1).max(8),
    era: softStr(800, { min: 1 }),
    inWorldDate: softStr(800, { min: 1 }),
  }),
  deepHistory: deepHistorySchema,
  locations: z.array(locationSeedSchema).min(8).max(24),
  factions: z.array(factionSeedSchema).min(3).max(10),
  characters: z.array(characterSeedSchema).min(5).max(12),  // principals only
  plots: z.array(plotSeedSchema).min(4).max(12),
  prophecies: z.array(prophecySeedSchema).min(3).max(10),
  relationships: z.array(relationshipSeedSchema).max(40),
});

export type GenesisFrame = z.infer<typeof genesisFrameSchema>;

// Stage 2: secondaries. Recurring characters with strong relationships to
// principals or factions.
export const genesisSecondariesSchema = z.object({
  characters: z.array(characterSeedSchema).min(8).max(24),
  relationships: z.array(relationshipSeedSchema).max(60),
});

export type GenesisSecondaries = z.infer<typeof genesisSecondariesSchema>;

// Stage 3: atmospherics. The wide population. Each is a real person with
// a top desire and 1–3 surprising secrets. Innkeeps, stewards, marsh-
// witches, caravan-masters, abbots, courtiers, urchins.
export const genesisAtmosphericsSchema = z.object({
  characters: z.array(characterSeedSchema).min(15).max(48),
  relationships: z.array(relationshipSeedSchema).max(40),
});

export type GenesisAtmospherics = z.infer<typeof genesisAtmosphericsSchema>;

// Backwards compatibility alias.
export const genesisOutputSchema = genesisFrameSchema;
export type GenesisOutput = GenesisFrame;

// ── Director output ──────────────────────────────────────────────────────────

// A new subplot or ambient plot the director may seed mid-chronicle.
// The chronicle's scope grows when characters' deeds open new threads.
const plotSpawnSchema = z.object({
  id,
  title: softStr(400, { min: 1 }),
  tier: z.enum(["subplot", "ambient"]),     // never spawn a new spine
  state: z.enum(["seeded", "setup", "rising"]).default("seeded"),
  tension: softNum(0, 1),
  arc: softStr(4000, { min: 8 }),
  central: z.array(z.string()).min(1).max(8),
  factionIds: z.array(z.string()).max(8).default([]),
  themes: z.array(softStr(120)).max(8).default([]),
  hooks: z.array(softStr(800)).max(8).default([]),
  why: softStr(1200, { min: 2 }),
});

// A new atmospheric character the director may introduce mid-chronicle.
// Always atmospheric — principals/secondaries are seeded at genesis. The
// character can be focal in this same tick's beat.
const characterSpawnSchema = z.object({
  id,
  name: softStr(200, { min: 1 }),
  epithet: softStrDef(500),
  age: softInt(1, 120),
  where: z.string(),
  factionId: z.string().optional(),
  portrait: softStr(1000, { min: 1 }),
  summary: softStr(3000, { min: 1 }),
  mood: moodSchema,
  desires: z.array(desireSchema).min(1).max(5),
  traits: z.record(softNum(0, 1)),
  secrets: z.array(softStr(1200, { min: 4 })).min(1).max(3),
});

export const directorPlanSchema = z.object({
  beatType: beatTypeSchema,
  beatTitle: softStr(400, { min: 1 }),
  sketch: softStr(2400, { min: 1 }),
  pacingNote: softStr(400, { min: 1 }),
  // For most beats: required. For world_report: optional. We enforce in
  // director.ts after parse.
  plotId: z.string().optional(),
  locationId: z.string().optional(),
  characterIds: z.array(z.string()).max(8).default([]),
  factionId: z.string().optional(),
  prophecyId: z.string().optional(),
  arcRevision: softStr(2400).optional(),
  // Story-flexibility levers — both optional, both rare.
  spawnPlot: plotSpawnSchema.optional(),
  spawnCharacter: characterSpawnSchema.optional(),
});

export type DirectorPlanParsed = z.infer<typeof directorPlanSchema>;

// ── State changes ────────────────────────────────────────────────────────────

const stateChangeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("mood_shift"),
    characterId: z.string(),
    dominant: softStr(500, { min: 1 }),
    valence: softNum(-1, 1),
    arousal: softNum(0, 1),
  }),
  z.object({
    kind: z.literal("desire_added"),
    characterId: z.string(),
    goal: softStr(800, { min: 1 }),
    intensity: softNum(0, 1),
    unspoken: softBool().optional(),
  }),
  z.object({
    kind: z.literal("desire_satisfied"),
    characterId: z.string(),
    goalIndex: softInt(0, 12),
  }),
  z.object({
    kind: z.literal("memory_formed"),
    characterId: z.string(),
    text: softStr(2400, { min: 1 }),
    weight: softNum(0, 1),
  }),
  z.object({
    kind: z.literal("relationship_shift"),
    fromId: z.string(),
    toId: z.string(),
    affectionDelta: softNum(-2, 2),
    trustDelta: softNum(-2, 2),
    note: softStr(1200).optional(),
  }),
  z.object({
    kind: z.literal("character_moved"),
    characterId: z.string(),
    toLocationId: z.string(),
  }),
  z.object({
    kind: z.literal("rumor_planted"),
    locationId: z.string(),
    text: softStr(1200, { min: 1 }),
    truth: softNum(0, 1),
  }),
  z.object({
    kind: z.literal("prophecy_echoed"),
    prophecyId: z.string(),
    note: softStr(1200, { min: 1 }),
  }),
  z.object({
    kind: z.literal("character_died"),
    characterId: z.string(),
    cause: softStr(1200, { min: 2 }),
  }),
  z.object({
    kind: z.literal("oath_sworn"),
    characterId: z.string(),
    vow: softStr(1200, { min: 4 }),
    beforeWhom: z.string().optional(),
  }),
  z.object({
    kind: z.literal("secret_revealed"),
    characterId: z.string(),
    secretIndex: softInt(0, 12),
    asRumourTruth: softNum(0, 1).optional(),
  }),
  z.object({
    kind: z.literal("faction_changed"),
    characterId: z.string(),
    toFactionId: z.string().nullable(),
    reason: softStr(1200, { min: 2 }),
  }),
  z.object({
    kind: z.literal("plot_deflected"),
    characterId: z.string(),
    plotId: z.string(),
    newArc: softStr(4000, { min: 8 }),
    newTension: softNum(0, 1).optional(),
    newState: z.enum(["seeded","setup","rising","climax","falling","resolved"]).optional(),
    why: softStr(1200, { min: 2 }),
  }),
]);

// ── Character output ─────────────────────────────────────────────────────────

export const characterActionSchema = z.object({
  thought: softStr(2400, { min: 1 }),
  saysOrDoes: softStr(4000, { min: 1 }),
  // Up to 8 — most turns produce 0–2; a turn that delivers a death, an
  // oath, and a deflection together can produce more.
  proposedChanges: z.array(stateChangeSchema).max(8),
});

export type CharacterActionParsed = z.infer<typeof characterActionSchema>;

// ── Scribe output ────────────────────────────────────────────────────────────

const paragraphSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("scene"), text: softStr(6000, { min: 1 }) }),
  z.object({
    kind: z.literal("dialogue"),
    who: z.string(),
    text: softStr(4000, { min: 1 }),
  }),
  // For world_report or chronicler-asides: an unattributed paragraph in the
  // chronicler's own voice.
  z.object({ kind: z.literal("aside"), text: softStr(6000, { min: 1 }) }),
]);

export const scribeOutputSchema = z.object({
  title: softStr(400, { min: 1 }),
  inWorldDate: softStr(800, { min: 1 }),
  timeOfDay: softStr(400, { min: 1 }),
  weather: softStr(600, { min: 1 }),
  paragraphs: z.array(paragraphSchema).min(1).max(16),
  plotAdvance: z
    .object({
      plotId: z.string(),
      newState: z.enum([
        "seeded",
        "setup",
        "rising",
        "climax",
        "falling",
        "resolved",
      ]),
      newTension: softNum(0, 1),
      beatTitle: softStr(400, { min: 1 }),
      beatWhen: softStr(400, { min: 1 }),
      beatSketch: softStr(2400, { min: 1 }),
    })
    .nullable(),
  prophecyAdvance: z
    .object({
      prophecyId: z.string(),
      newStatus: z.enum([
        "unfulfilled",
        "echoing",
        "half_fulfilled",
        "fulfilled",
        "broken",
      ]),
      note: softStr(1200, { min: 1 }),
    })
    .nullable()
    .default(null),
});

export type ScribeOutputParsed = z.infer<typeof scribeOutputSchema>;
