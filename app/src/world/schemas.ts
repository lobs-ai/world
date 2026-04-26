// Zod schemas for everything that crosses an LLM boundary. The LLM proposes
// JSON; we parse against these schemas before any state change reaches the
// applier. Failed parses are loud failures, not silent fallbacks.

import { z } from "zod";

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

const characterSeedSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_-]{1,30}$/),
  name: z.string().min(1).max(80),
  epithet: z.string().max(120),
  age: z.number().int().min(1).max(120),
  where: z.string(),
  portrait: z.string().min(1).max(200),
  summary: z.string().min(1).max(600),
  mood: moodSchema,
  desires: z.array(desireSchema).min(1).max(4),
  traits: z.record(z.number().min(0).max(1)),
});

const locationSeedSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_-]{1,30}$/),
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
]);

const plotSeedSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_-]{1,30}$/),
  title: z.string().min(1).max(120),
  state: z.enum(["seeded", "setup", "rising", "climax", "falling", "resolved"]),
  tension: z.number().min(0).max(1),
  arc: z.string().min(1).max(800),
  central: z.array(z.string()).min(1).max(5),
  themes: z.array(z.string()).max(4),
  hooks: z.array(z.string()).max(6),
});

const relationshipSeedSchema = z.object({
  fromId: z.string(),
  toId: z.string(),
  typeFromMe: z.string().min(1).max(40),
  affection: z.number().min(-1).max(1),
  trust: z.number().min(-1).max(1),
  note: z.string().max(280).default(""),
});

export const genesisOutputSchema = z.object({
  world: z.object({
    name: z.string().min(1).max(80),
    tone: z.string().min(1).max(60),
    themes: z.array(z.string()).min(1).max(5),
    era: z.string().min(1).max(160),
    inWorldDate: z.string().min(1).max(200),
  }),
  characters: z.array(characterSeedSchema).min(3).max(8),
  locations: z.array(locationSeedSchema).min(3).max(7),
  plots: z.array(plotSeedSchema).min(2).max(4),
  relationships: z.array(relationshipSeedSchema).max(20),
});

export type GenesisOutput = z.infer<typeof genesisOutputSchema>;

// ── Director output ──────────────────────────────────────────────────────────

export const directorPlanSchema = z.object({
  plotId: z.string(),
  beatType: beatTypeSchema,
  beatTitle: z.string().min(1).max(120),
  sketch: z.string().min(1).max(400),
  locationId: z.string(),
  characterIds: z.array(z.string()).min(1).max(5),
  pacingNote: z.string().min(1).max(80),
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
]);

// ── Character output ─────────────────────────────────────────────────────────

export const characterActionSchema = z.object({
  thought: z.string().min(1).max(400),
  saysOrDoes: z.string().min(1).max(800),
  proposedChanges: z.array(stateChangeSchema).max(4),
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
]);

export const scribeOutputSchema = z.object({
  title: z.string().min(1).max(120),
  inWorldDate: z.string().min(1).max(200),
  timeOfDay: z.string().min(1).max(60),
  weather: z.string().min(1).max(120),
  paragraphs: z.array(paragraphSchema).min(2).max(8),
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
});

export type ScribeOutputParsed = z.infer<typeof scribeOutputSchema>;
