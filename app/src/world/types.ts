// Domain types. Every persisted entity has its shape declared here.
// Anything that crosses an LLM boundary is *also* expressed as a Zod schema
// in `schemas.ts` — types here are the source of truth for the rest of the
// codebase.

export type WorldId = string;
export type CharacterId = string;
export type LocationId = string;
export type PlotId = string;
export type EntryId = string;

export interface World {
  id: WorldId;
  name: string;
  premise: string;
  tone: string;
  themes: string[];
  era: string;          // in-world dating phrase: "Year of the Owl"
  inWorldDate: string;  // current rendered date
  tick: number;
  createdAt: string;
  updatedAt: string;
}

export interface Mood {
  dominant: string;
  valence: number;   // -1..1
  arousal: number;   //  0..1
}

export interface Desire {
  goal: string;
  intensity: number; // 0..1
  unspoken?: boolean;
}

export interface Character {
  id: CharacterId;
  worldId: WorldId;
  name: string;
  epithet: string;
  age: number;
  where: LocationId;
  portrait: string;       // short prose description
  summary: string;
  mood: Mood;
  desires: Desire[];
  traits: Record<string, number>;
  alive: boolean;
}

export interface Relationship {
  worldId: WorldId;
  fromId: CharacterId;
  toId: CharacterId;
  typeFromMe: string;     // "mother", "rival", "complicit"
  affection: number;      // -1..1
  trust: number;          // -1..1
  note: string;
}

export interface Memory {
  id: string;
  worldId: WorldId;
  characterId: CharacterId;
  weight: number;         // 0..1, decays
  text: string;
  tickLearned: number;
}

export interface Rumor {
  id: string;
  worldId: WorldId;
  locationId: LocationId;
  text: string;
  truth: number;          // 0..1
  tickPlanted: number;
}

export interface Location {
  id: LocationId;
  worldId: WorldId;
  name: string;
  type: "capital" | "town" | "village" | "ruin" | "wilderness" | "fortress";
  description: string;
  weather: string;
}

export type PlotState =
  | "seeded"
  | "setup"
  | "rising"
  | "climax"
  | "falling"
  | "resolved";

export type BeatType =
  | "setup"
  | "complication"
  | "rising"
  | "climax"
  | "falling"
  | "resolution";

export interface PlotBeat {
  tick: number;
  type: BeatType;
  title: string;
  when: string;           // in-world phrasing
  sketch: string;         // one-line beat description
}

export interface Plot {
  id: PlotId;
  worldId: WorldId;
  title: string;
  state: PlotState;
  tension: number;        // 0..1
  arc: string;            // projected arc, two sentences
  central: CharacterId[];
  themes: string[];
  hooks: string[];        // breadcrumbs the director has set down
  beats: PlotBeat[];
}

export type ParagraphKind = "scene" | "dialogue";

export interface Paragraph {
  kind: ParagraphKind;
  who?: CharacterId;
  text: string;
}

export interface ChronicleEntry {
  id: EntryId;
  worldId: WorldId;
  tick: number;
  inWorldDate: string;
  timeOfDay: string;
  weather: string;
  title: string;
  plotIds: PlotId[];
  locationIds: LocationId[];
  characterIds: CharacterId[];
  paragraphs: Paragraph[];
  createdAt: string;
}

// ── State changes (proposed by agents, validated, then applied) ──────────────

export type StateChangeKind =
  | "mood_shift"
  | "desire_added"
  | "desire_satisfied"
  | "memory_formed"
  | "relationship_shift"
  | "character_moved"
  | "rumor_planted";

export interface MoodShift {
  kind: "mood_shift";
  characterId: CharacterId;
  dominant: string;
  valence: number;
  arousal: number;
}

export interface DesireAdded {
  kind: "desire_added";
  characterId: CharacterId;
  goal: string;
  intensity: number;
  unspoken?: boolean;
}

export interface DesireSatisfied {
  kind: "desire_satisfied";
  characterId: CharacterId;
  goalIndex: number;
}

export interface MemoryFormed {
  kind: "memory_formed";
  characterId: CharacterId;
  text: string;
  weight: number;
}

export interface RelationshipShift {
  kind: "relationship_shift";
  fromId: CharacterId;
  toId: CharacterId;
  affectionDelta: number; // -2..2
  trustDelta: number;     // -2..2
  note?: string;
}

export interface CharacterMoved {
  kind: "character_moved";
  characterId: CharacterId;
  toLocationId: LocationId;
}

export interface RumorPlanted {
  kind: "rumor_planted";
  locationId: LocationId;
  text: string;
  truth: number;
}

export type StateChange =
  | MoodShift
  | DesireAdded
  | DesireSatisfied
  | MemoryFormed
  | RelationshipShift
  | CharacterMoved
  | RumorPlanted;

// ── Director output (the steer for the next tick) ────────────────────────────

export interface DirectorPlan {
  plotId: PlotId;
  beatType: BeatType;
  beatTitle: string;
  sketch: string;
  locationId: LocationId;
  characterIds: CharacterId[]; // who is in this scene
  pacingNote: string;          // "quiet", "rising", "decisive"
}

// ── Character output (what a character does in a beat) ───────────────────────

export interface CharacterAction {
  characterId: CharacterId;
  thought: string;             // private, never rendered
  saysOrDoes: string;          // in-voice, the actable thing
  proposedChanges: StateChange[];
}
