// Helpers that name "the protagonist" and "the main story" so every page
// can speak about them consistently. The chronicle's spine plot is the
// through-line; its first central character is the protagonist. If a world
// has no spine (shouldn't happen post-genesis, but defensive), we fall
// back to the first principal we find.

import "server-only";
import type { Character, Plot, World } from "@world/app";
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
