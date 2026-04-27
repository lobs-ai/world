// Domain types. Every persisted entity has its shape declared here.
// Anything that crosses an LLM boundary is *also* expressed as a Zod schema
// in `schemas.ts` — types here are the source of truth for the rest of the
// codebase.

export type WorldId = string;
export type CharacterId = string;
export type LocationId = string;
export type PlotId = string;
export type FactionId = string;
export type ProphecyId = string;
export type EntryId = string;

export interface DeepHistoryFigure {
  name: string;
  epithet?: string;
  era: string;          // "five hundred winters past"
  one_line: string;     // "broke the sword that bound the Pale King"
}

export interface DeepHistoryEvent {
  title: string;
  era: string;
  one_line: string;
}

export interface DeepHistory {
  // Layered antiquity: named ancients, broken oaths, fallen orders, lost
  // places. Generated once at genesis. Read-only thereafter. Director and
  // scribe receive a slice of this so prophecies and hooks can reach back.
  ancients: DeepHistoryFigure[];
  brokenOaths: DeepHistoryEvent[];
  fallenOrders: DeepHistoryEvent[];
  lostPlaces: DeepHistoryEvent[];
  cosmology: string;        // a short paragraph
}

export interface World {
  id: WorldId;
  name: string;
  premise: string;
  tone: string;
  themes: string[];
  era: string;          // in-world dating phrase: "Year of the Owl"
  inWorldDate: string;  // current rendered date
  tick: number;
  deepHistory: DeepHistory;
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

// Cast tier. The director uses this to decide who can be focal.
//   principal   — main characters; spine/major subplot leads. ~6–10.
//   secondary   — recurring; subplot leads, foils, faction lieutenants. ~6–12.
//   atmospheric — named-but-rare; an innkeep, a steward, a witnessing child.
//                 They can be focal but only when a beat needs *them* by
//                 name. ~10–20. They make the world feel populous.
export type CastWeight = "principal" | "secondary" | "atmospheric";

export interface Character {
  id: CharacterId;
  worldId: WorldId;
  name: string;
  epithet: string;
  age: number;
  where: LocationId;
  weight: CastWeight;
  factionId?: FactionId;  // primary affiliation, if any
  portrait: string;       // short prose description
  summary: string;
  mood: Mood;
  desires: Desire[];
  traits: Record<string, number>;
  alive: boolean;
  // Private hooks the character carries — a debt, a vow, a thing they
  // have lied about for decades, a child no one knows of. Each is one
  // sentence. The character agent receives ONLY their own secrets, never
  // anyone else's. Atmospheric NPCs lean hardest on these — a single
  // unexpected fact is what turns "the innkeep" into a person.
  secrets: string[];
  // Repo-relative path to a generated portrait, e.g.
  // "data/images/<hash>.png". Optional — UI falls back to a placeholder.
  imagePath?: string;
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
  type: string;          // free-form short noun: "capital", "inn", "abbey", "marsh-shrine"
  description: string;
  weather: string;
  imagePath?: string;
}

// Factions: groups with their own desires and tension. They aren't a fourth
// agent — they don't generate prose — but the director treats a faction's
// desires the way it treats a plot, and a beat may be "faction-driven"
// (a banner-master rides; a tower's heralds answer; a brotherhood gathers).
export interface Faction {
  id: FactionId;
  worldId: WorldId;
  name: string;
  banner: string;             // a one-line emblem/colour/sigil description
  summary: string;            // who they are, what they want, why they matter
  themes: string[];
  desires: Desire[];          // 1–3 collective goals
  tension: number;            // 0..1
  lastAdvancedTick: number;
  seatLocationId?: LocationId; // their stronghold, if they have one
}

// Prophecies / foretellings / ancient promises. Strategic, not tactical.
// `targetPayoffMin/Max` is the director's commitment band — a payoff should
// land somewhere inside that window. Until then, the prophecy may be
// echoed, half-fulfilled, doubted, mocked, but not closed. Hooks (on Plot)
// stay tactical (paid in <10 entries); prophecies are the slow burn.
export type ProphecyStatus = "unfulfilled" | "echoing" | "half_fulfilled" | "fulfilled" | "broken";

export interface Prophecy {
  id: ProphecyId;
  worldId: WorldId;
  text: string;               // the foretelling itself, in-world phrasing
  source: string;             // "the Withered Oracle of Pellan"
  plantedTick: number;
  targetPayoffMin: number;    // earliest tick the director may pay it
  targetPayoffMax: number;    // by this tick, payoff is overdue
  status: ProphecyStatus;
  echoes: number;             // how many times the chronicle has touched it
  relatedPlotIds: PlotId[];
  relatedCharacterIds: CharacterId[];
  hiddenMeaning?: string;     // only the director sees this
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
  | "resolution"
  | "world_report";          // no scene cast; chronicler's-aside paragraph

export interface PlotBeat {
  tick: number;
  type: BeatType;
  title: string;
  when: string;           // in-world phrasing
  sketch: string;         // one-line beat description
}

// Plot tier. The director uses these in cadence rules:
//   spine     — exactly one. Advances every 2–3 entries. The Dragon Reborn.
//   subplot   — major secondary thread. Advance every 4–6 entries.
//   ambient   — slow-burn, often faction- or place-driven. Every 6–10.
export type PlotTier = "spine" | "subplot" | "ambient";

export interface Plot {
  id: PlotId;
  worldId: WorldId;
  title: string;
  tier: PlotTier;
  state: PlotState;
  tension: number;        // 0..1
  arc: string;            // projected arc, two sentences
  central: CharacterId[];
  factionIds: FactionId[];
  themes: string[];
  hooks: string[];        // tactical breadcrumbs (paid in <10 entries)
  beats: PlotBeat[];
  lastAdvancedTick: number;
}

export type ParagraphKind = "scene" | "dialogue" | "aside";

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
  beatType: BeatType;
  plotIds: PlotId[];
  factionIds: FactionId[];
  prophecyIds: ProphecyId[];
  locationIds: LocationId[];
  characterIds: CharacterId[];
  paragraphs: Paragraph[];
  // Hero image for this entry, when one was generated. World-report beats
  // and budget-skipped beats have none.
  imagePath?: string;
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
  | "rumor_planted"
  | "prophecy_echoed"
  | "character_died"
  | "oath_sworn"
  | "secret_revealed"
  | "faction_changed"
  | "plot_deflected";

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

export interface ProphecyEchoed {
  // The character or scene has touched a prophecy without closing it.
  // status moves toward fulfillment but does not jump it; the director
  // is what closes a prophecy.
  kind: "prophecy_echoed";
  prophecyId: ProphecyId;
  note: string;
}

// Character agency — the levers a character can pull to *change the
// world*, not just record their inner state. These are how a chronicle
// stays dynamic instead of merely staged. Validators enforce that the
// character had the standing to do the thing.

export interface CharacterDied {
  // The actor (or another in-scene character whose death the actor's
  // saysOrDoes plainly causes) is dead. Validator checks the target was
  // alive and is in the scene's location.
  kind: "character_died";
  characterId: CharacterId;
  cause: string;            // one-line in-world phrasing
}

export interface OathSworn {
  // A binding commitment. Becomes a high-intensity desire on the
  // character; also creates a heavy memory.
  kind: "oath_sworn";
  characterId: CharacterId;
  vow: string;              // "to bring my brother's bones home"
  beforeWhom?: CharacterId; // witness, if any
}

export interface SecretRevealed {
  // The character has revealed one of their own secrets. The secret
  // exits private state and becomes a rumour at the scene location with
  // truth ≈ 1.0. Validator requires the secret index belong to the
  // actor.
  kind: "secret_revealed";
  characterId: CharacterId;
  secretIndex: number;
  asRumourTruth?: number;   // optional override; defaults to 0.95
}

export interface FactionChanged {
  // Defection / induction. New faction may be null (severance with no
  // new home).
  kind: "faction_changed";
  characterId: CharacterId;
  toFactionId: FactionId | null;
  reason: string;
}

export interface PlotDeflected {
  // The actor's deed has bent the plot away from the director's
  // projected arc. Validator requires the actor be plot.central OR a
  // member of one of plot.factionIds. Writes a new arc, optional
  // tension/state changes, and bumps lastAdvancedTick.
  kind: "plot_deflected";
  characterId: CharacterId;
  plotId: PlotId;
  newArc: string;
  newTension?: number;       // 0..1
  newState?: PlotState;
  why: string;               // one-line: what the deed was that bent it
}

export type StateChange =
  | MoodShift
  | DesireAdded
  | DesireSatisfied
  | MemoryFormed
  | RelationshipShift
  | CharacterMoved
  | RumorPlanted
  | ProphecyEchoed
  | CharacterDied
  | OathSworn
  | SecretRevealed
  | FactionChanged
  | PlotDeflected;

// ── Director output (the steer for the next tick) ────────────────────────────

export interface PlotSpawn {
  id: PlotId;
  title: string;
  tier: "subplot" | "ambient";
  state: PlotState;
  tension: number;
  arc: string;
  central: CharacterId[];
  factionIds: FactionId[];
  themes: string[];
  hooks: string[];
  why: string;
}

export interface CharacterSpawn {
  id: CharacterId;
  name: string;
  epithet: string;
  age: number;
  where: LocationId;
  factionId?: FactionId;
  portrait: string;
  summary: string;
  mood: Mood;
  desires: Desire[];
  traits: Record<string, number>;
  secrets: string[];
}

export interface DirectorPlan {
  beatType: BeatType;
  beatTitle: string;
  sketch: string;
  pacingNote: string;
  // For most beats: plot + scene + cast.
  plotId?: PlotId;             // omitted for world_report only
  locationId?: LocationId;     // omitted for world_report only
  characterIds: CharacterId[]; // empty for world_report
  // Optional steers — let the director thread factions / prophecies.
  factionId?: FactionId;
  prophecyId?: ProphecyId;
  // Optional projection — director may sketch where the spine is going.
  arcRevision?: string;
  // Optional swerves — let the director widen the world mid-chronicle.
  spawnPlot?: PlotSpawn;
  spawnCharacter?: CharacterSpawn;
}

// ── Character output (what a character does in a beat) ───────────────────────

export interface CharacterAction {
  characterId: CharacterId;
  thought: string;             // private, never rendered
  saysOrDoes: string;          // in-voice, the actable thing
  proposedChanges: StateChange[];
}
