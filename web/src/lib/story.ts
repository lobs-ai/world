// Helpers that name "the protagonist" and "the main story" so every page
// can speak about them consistently. The chronicle's spine plot is the
// through-line; its first central character is the protagonist. If a world
// has no spine (shouldn't happen post-genesis, but defensive), we fall
// back to the first principal we find.

import "server-only";
import type { Character, ChronicleEntry, Plot, PlotBeat, World } from "@world/app";
import { db } from "./db";

export interface MainStory {
  spine: Plot | null;
  protagonist: Character | null;
  // The spine's central cast minus the protagonist — major figures whose
  // arcs braid with the protagonist's.
  cocast: Character[];
}

export function mainStory(world: World): MainStory {
  const plots = db().listPlots(world.id);
  const spine = plots.find((p) => p.tier === "spine") ?? null;
  if (!spine || spine.central.length === 0) {
    // Fall back to the first principal so the UI never shows nothing.
    const principal = db().listCharacters(world.id).find((c) => c.weight === "principal") ?? null;
    return { spine, protagonist: principal, cocast: [] };
  }
  const protagonist = db().getCharacter(world.id, spine.central[0]!);
  const cocast = spine.central
    .slice(1)
    .map((cid) => db().getCharacter(world.id, cid))
    .filter((c): c is Character => c !== null);
  return { spine, protagonist, cocast };
}

// Lightweight summary built from the spine's `arc`, plus the most recent
// beat's title + sketch if there is one. This is the "Story So Far" you
// drop into a hero card.
export function storySoFar(world: World): {
  arc: string;
  latestBeatTitle: string | null;
  latestBeatSketch: string | null;
} {
  const story = mainStory(world);
  const arc = story.spine?.arc ?? "";
  const last = story.spine?.beats[story.spine.beats.length - 1];
  return {
    arc,
    latestBeatTitle: last?.title ?? null,
    latestBeatSketch: last?.sketch ?? null,
  };
}

// The "current chapter" is the latest spine beat. Entries belonging to it
// are those written after the spine last advanced (i.e. tick >
// spine.lastAdvancedTick). When the spine has no beats yet, we treat all
// entries as the opening chapter.
export interface CurrentChapter {
  number: number;          // 1-based chapter number
  total: number;           // total beats so far
  beat: PlotBeat | null;   // the active beat, when one exists
  thisChapter: ChronicleEntry[];   // entries since the spine last advanced
  earlier: ChronicleEntry[];       // everything older
}

export function currentChapter(world: World, limit = 30): CurrentChapter {
  const story = mainStory(world);
  const entries = db().listEntries(world.id, limit);
  const spine = story.spine;

  if (!spine || spine.beats.length === 0) {
    return {
      number: 1,
      total: 1,
      beat: null,
      thisChapter: entries,
      earlier: [],
    };
  }

  const beat = spine.beats[spine.beats.length - 1] ?? null;
  // First chapter is special: there is no "before" the spine started, so
  // every entry up to the next advancement belongs to chapter 1.
  const isFirstChapter = spine.beats.length === 1;
  const cutoff = isFirstChapter ? -1 : spine.lastAdvancedTick;
  const thisChapter = entries.filter((e) => e.tick > cutoff);
  const earlier = entries.filter((e) => e.tick <= cutoff);

  return {
    number: spine.beats.length,
    total: spine.beats.length,
    beat,
    thisChapter,
    earlier,
  };
}

// A compact view of the spine's progress for the chapter-strip in the
// hero. Each beat becomes a marker with done/active state.
export interface ChapterMarker {
  index: number;       // 1-based
  title: string;
  type: string;
  when: string;
  active: boolean;     // current beat
}

export function chapterTimeline(world: World): ChapterMarker[] {
  const story = mainStory(world);
  const beats = story.spine?.beats ?? [];
  return beats.map((b, i) => ({
    index: i + 1,
    title: b.title,
    type: b.type,
    when: b.when,
    active: i === beats.length - 1,
  }));
}

// First quote-bearing line of the most recent entry. Useful as a pull
// quote on the chronicle home, the way book covers tease.
export function latestPullQuote(world: World): {
  quote: string;
  speakerName: string | null;
  entryTitle: string;
  entryId: string;
} | null {
  const recent = db().listEntries(world.id, 1)[0];
  if (!recent) return null;
  const dialogueLine = recent.paragraphs.find((p) => p.kind === "dialogue");
  if (!dialogueLine || dialogueLine.kind !== "dialogue") return null;
  const speaker = dialogueLine.who
    ? db().getCharacter(world.id, dialogueLine.who)
    : null;
  return {
    quote: dialogueLine.text,
    speakerName: speaker?.name ?? null,
    entryTitle: recent.title,
    entryId: recent.id,
  };
}
