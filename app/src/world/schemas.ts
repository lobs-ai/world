// Zod schemas for everything that crosses an LLM boundary. The LLM proposes
// JSON; we parse against these schemas before any state change reaches the
// applier. Failed parses are loud failures, not silent fallbacks.

import { z } from "zod";

const id = z.string().regex(/^[a-z][a-z0-9_-]{1,40}$/);

// ── Genesis output ───────────────────────────────────────────────────────────

const moodSchema = z.object({
  dominant: z.string().min(1).max(120),
  valence: z.number().min(-1).max(1),
  arousal: z.number().min(0).max(1),
});

const desireSchema = z.object({
  goal: z.string().min(1).max(200),
  intensity: z.number().min(0).max(1),
  unspoken: z.boolean().optional(),
});

const castWeightSchema = z.enum(["principal", "secondary", "atmospheric"]);

const characterSeedSchema = z.object({
  id,
  name: z.string().min(1).max(80),
  epithet: z.string().max(120),
  age: z.number().int().min(1).max(120),
  where: z.string(),
  weight: castWeightSchema,
  factionId: z.string().optional(),
  portrait: z.string().min(1).max(200),
  summary: z.string().min(1).max(600),
  mood: moodSchema,
  desires: z.array(desireSchema).min(1).max(4),
  traits: z.record(z.number().min(0).max(1)),
  // 1–3 private hooks. Required for every character — even atmospheric.
  // The character agent receives only their own.
  secrets: z.array(z.string().min(4).max(280)).min(1).max(3),
});

const locationSeedSchema = z.object({
  id,
  name: z.string().min(1).max(80),
  type: z.enum(["capital", "town", "village", "ruin", "wilderness", "fortress"]),
  description: z.string().min(1).max(600),
  weather: z.string().max(120),
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
  title: z.string().min(1).max(120),
  tier: plotTierSchema,
  state: z.enum(["seeded", "setup", "rising", "climax", "falling", "resolved"]),
  tension: z.number().min(0).max(1),
  arc: z.string().min(1).max(800),
  central: z.array(z.string()).min(1).max(6),
  factionIds: z.array(z.string()).max(4).default([]),
  themes: z.array(z.string()).max(4),
  hooks: z.array(z.string()).max(6),
});

const factionSeedSchema = z.object({
  id,
  name: z.string().min(1).max(80),
  banner: z.string().min(1).max(200),
  summary: z.string().min(1).max(600),
  themes: z.array(z.string()).max(4).default([]),
  desires: z.array(desireSchema).min(1).max(3),
  tension: z.number().min(0).max(1),
  seatLocationId: z.string().optional(),
});

const prophecySeedSchema = z.object({
  id,
  text: z.string().min(8).max(400),
  source: z.string().min(1).max(160),
  targetPayoffMin: z.number().int().min(10).max(500),
  targetPayoffMax: z.number().int().min(20).max(800),
  relatedPlotIds: z.array(z.string()).max(4).default([]),
  relatedCharacterIds: z.array(z.string()).max(6).default([]),
  hiddenMeaning: z.string().max(400).optional(),
});

const relationshipSeedSchema = z.object({
  fromId: z.string(),
  toId: z.string(),
  typeFromMe: z.string().min(1).max(40),
  affection: z.number().min(-1).max(1),
  trust: z.number().min(-1).max(1),
  note: z.string().max(280).default(""),
});

const deepHistoryFigureSchema = z.object({
  name: z.string().min(1).max(80),
  epithet: z.string().max(120).optional(),
  era: z.string().min(1).max(120),
  one_line: z.string().min(1).max(240),
});

const deepHistoryEventSchema = z.object({
  title: z.string().min(1).max(120),
  era: z.string().min(1).max(120),
  one_line: z.string().min(1).max(240),
});

const deepHistorySchema = z.object({
  ancients: z.array(deepHistoryFigureSchema).min(2).max(8),
  brokenOaths: z.array(deepHistoryEventSchema).max(6).default([]),
  fallenOrders: z.array(deepHistoryEventSchema).max(6).default([]),
  lostPlaces: z.array(deepHistoryEventSchema).max(6).default([]),
  cosmology: z.string().min(1).max(800),
});

// Stage 1: the world frame. World meta, deep history, locations, factions,
// principals only, plots, prophecies, relationships among principals.
export const genesisFrameSchema = z.object({
  world: z.object({
    name: z.string().min(1).max(80),
    tone: z.string().min(1).max(60),
    themes: z.array(z.string()).min(1).max(5),
    era: z.string().min(1).max(160),
    inWorldDate: z.string().min(1).max(200),
  }),
  deepHistory: deepHistorySchema,
  locations: z.array(locationSeedSchema).min(8).max(16),
  factions: z.array(factionSeedSchema).min(3).max(6),
  characters: z.array(characterSeedSchema).min(5).max(8),  // principals only
  plots: z.array(plotSeedSchema).min(4).max(8),
  prophecies: z.array(prophecySeedSchema).min(3).max(6),
  relationships: z.array(relationshipSeedSchema).max(20),
});

export type GenesisFrame = z.infer<typeof genesisFrameSchema>;

// Stage 2: secondaries. Recurring characters with strong relationships to
// principals or factions.
export const genesisSecondariesSchema = z.object({
  characters: z.array(characterSeedSchema).min(8).max(15),
  relationships: z.array(relationshipSeedSchema).max(30),
});

export type GenesisSecondaries = z.infer<typeof genesisSecondariesSchema>;

// Stage 3: atmospherics. The wide population. Each is a real person with
// a top desire and 1–3 surprising secrets. Innkeeps, stewards, marsh-
// witches, caravan-masters, abbots, courtiers, urchins.
export const genesisAtmosphericsSchema = z.object({
  characters: z.array(characterSeedSchema).min(15).max(28),
  relationships: z.array(relationshipSeedSchema).max(20),
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
  title: z.string().min(1).max(120),
  tier: z.enum(["subplot", "ambient"]),     // never spawn a new spine
  state: z.enum(["seeded", "setup", "rising"]).default("seeded"),
  tension: z.number().min(0).max(1),
  arc: z.string().min(8).max(800),
  central: z.array(z.string()).min(1).max(5),
  factionIds: z.array(z.string()).max(3).default([]),
  themes: z.array(z.string()).max(4).default([]),
  hooks: z.array(z.string()).max(4).default([]),
  why: z.string().min(2).max(240),          // why this opens now
});

// A new atmospheric character the director may introduce mid-chronicle.
// Always atmospheric — principals/secondaries are seeded at genesis. The
// character can be focal in this same tick's beat.
const characterSpawnSchema = z.object({
  id,
  name: z.string().min(1).max(80),
  epithet: z.string().max(120),
  age: z.number().int().min(1).max(120),
  where: z.string(),
  factionId: z.string().optional(),
  portrait: z.string().min(1).max(200),
  summary: z.string().min(1).max(600),
  mood: moodSchema,
  desires: z.array(desireSchema).min(1).max(3),
  traits: z.record(z.number().min(0).max(1)),
  secrets: z.array(z.string().min(4).max(280)).min(1).max(2),
});

export const directorPlanSchema = z.object({
  beatType: beatTypeSchema,
  beatTitle: z.string().min(1).max(120),
  sketch: z.string().min(1).max(500),
  pacingNote: z.string().min(1).max(80),
  // For most beats: required. For world_report: optional. We enforce in
  // director.ts after parse.
  plotId: z.string().optional(),
  locationId: z.string().optional(),
  characterIds: z.array(z.string()).max(5).default([]),
  factionId: z.string().optional(),
  prophecyId: z.string().optional(),
  arcRevision: z.string().max(500).optional(),
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
    dominant: z.string().min(1).max(120),
    valence: z.number().min(-1).max(1),
    arousal: z.number().min(0).max(1),
  }),
  z.object({
    kind: z.literal("desire_added"),
    characterId: z.string(),
    goal: z.string().min(1).max(200),
    intensity: z.number().min(0).max(1),
    unspoken: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("desire_satisfied"),
    characterId: z.string(),
    goalIndex: z.number().int().min(0).max(8),
  }),
  z.object({
    kind: z.literal("memory_formed"),
    characterId: z.string(),
    text: z.string().min(1).max(500),
    weight: z.number().min(0).max(1),
  }),
  z.object({
    kind: z.literal("relationship_shift"),
    fromId: z.string(),
    toId: z.string(),
    affectionDelta: z.number().min(-2).max(2),
    trustDelta: z.number().min(-2).max(2),
    note: z.string().max(280).optional(),
  }),
  z.object({
    kind: z.literal("character_moved"),
    characterId: z.string(),
    toLocationId: z.string(),
  }),
  z.object({
    kind: z.literal("rumor_planted"),
    locationId: z.string(),
    text: z.string().min(1).max(280),
    truth: z.number().min(0).max(1),
  }),
  z.object({
    kind: z.literal("prophecy_echoed"),
    prophecyId: z.string(),
    note: z.string().min(1).max(240),
  }),
  z.object({
    kind: z.literal("character_died"),
    characterId: z.string(),
    cause: z.string().min(2).max(240),
  }),
  z.object({
    kind: z.literal("oath_sworn"),
    characterId: z.string(),
    vow: z.string().min(4).max(240),
    beforeWhom: z.string().optional(),
  }),
  z.object({
    kind: z.literal("secret_revealed"),
    characterId: z.string(),
    secretIndex: z.number().int().min(0).max(8),
    asRumourTruth: z.number().min(0).max(1).optional(),
  }),
  z.object({
    kind: z.literal("faction_changed"),
    characterId: z.string(),
    toFactionId: z.string().nullable(),
    reason: z.string().min(2).max(240),
  }),
  z.object({
    kind: z.literal("plot_deflected"),
    characterId: z.string(),
    plotId: z.string(),
    newArc: z.string().min(8).max(800),
    newTension: z.number().min(0).max(1).optional(),
    newState: z.enum(["seeded","setup","rising","climax","falling","resolved"]).optional(),
    why: z.string().min(2).max(240),
  }),
]);

// ── Character output ─────────────────────────────────────────────────────────

export const characterActionSchema = z.object({
  thought: z.string().min(1).max(400),
  saysOrDoes: z.string().min(1).max(800),
  // Up to 6 — most turns produce 0–2; a turn that delivers a death, an
  // oath, and a deflection together can produce more.
  proposedChanges: z.array(stateChangeSchema).max(6),
});

export type CharacterActionParsed = z.infer<typeof characterActionSchema>;

// ── Scribe output ────────────────────────────────────────────────────────────

const paragraphSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("scene"), text: z.string().min(1).max(1500) }),
  z.object({
    kind: z.literal("dialogue"),
    who: z.string(),
    text: z.string().min(1).max(800),
  }),
  // For world_report or chronicler-asides: an unattributed paragraph in the
  // chronicler's own voice.
  z.object({ kind: z.literal("aside"), text: z.string().min(1).max(1500) }),
]);

export const scribeOutputSchema = z.object({
  title: z.string().min(1).max(120),
  inWorldDate: z.string().min(1).max(200),
  timeOfDay: z.string().min(1).max(60),
  weather: z.string().min(1).max(120),
  paragraphs: z.array(paragraphSchema).min(1).max(8),
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
      newTension: z.number().min(0).max(1),
      beatTitle: z.string().min(1).max(120),
      beatWhen: z.string().min(1).max(120),
      beatSketch: z.string().min(1).max(400),
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
      note: z.string().min(1).max(280),
    })
    .nullable()
    .default(null),
});

export type ScribeOutputParsed = z.infer<typeof scribeOutputSchema>;
