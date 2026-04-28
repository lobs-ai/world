// Image orchestration. Above the bare API client this layer adds:
//   - per-world style prefix so faces/places feel like one painter
//   - subject-specific prompt builders (character / location / scene)
//   - a "scene image cooldown" so we generate at most ~1 hero image / hour
//   - fire-and-forget helpers that write back to the DB when ready
//   - a serial queue so we never fire >1 generation in flight at once
//     (the API throttles parallel calls and the budget check isn't atomic
//     across overlapping requests). Genesis enqueues 20+ jobs at once;
//     they now run one after the other instead of stampeding.
//
// Failures are non-fatal everywhere — the UI falls back to placeholders.
// Callers never await image generation on the critical path of a tick.

import { generateImage, withStyle } from "../llm/image.js";
import type { Db } from "../db/index.js";
import type {
  Character,
  ChronicleEntry,
  Location,
  World,
} from "../world/types.js";

// One scene hero image per hour, real time. The tick loop runs every
// 15 min; a 60-min gate caps us at 24 hero images / day even if every
// scene beat asked for one.
const SCENE_COOLDOWN_MS = 60 * 60 * 1000;

// Soft daily ceiling (the bare client also enforces this, with the same
// number). 50 is the user's API quota; we treat it as the hard cap.
const DAILY_BUDGET = 50;

// Style suffix applied to every image so the world looks coherent. We mix
// a fixed "painter" with the world's tone/themes so a grimdark world and
// a hopeful one don't look the same.
function styleFor(world: World): string {
  const tone = world.tone || "epic fantasy";
  const themes = (world.themes ?? []).slice(0, 2).join(", ");
  return [
    `Style: oil painting in the manner of John Howe and Alan Lee, soft chiaroscuro,`,
    `muted earth palette, candlelight where indoors, overcast where outdoors,`,
    `19th-century romantic mood. Tone: ${tone}.`,
    themes ? `Thematic colour: ${themes}.` : "",
    `No text, no logos, no modern objects.`,
  ]
    .filter(Boolean)
    .join(" ");
}

// ── Prompt builders ─────────────────────────────────────────────────────────

export function characterPrompt(c: Character, world: World): string {
  const subject = [
    `Portrait of ${c.name}, ${c.epithet || ""}.`.trim(),
    `${c.age} years old.`,
    c.portrait,
    c.summary ? `${c.summary}` : "",
    `Their dominant feeling: ${c.mood.dominant}.`,
    `Three-quarter view, head and shoulders, lit from one side, plain dark backdrop, expressive face, in-period clothing for a ${world.era || "medieval fantasy"} world.`,
  ]
    .filter(Boolean)
    .join(" ");
  return withStyle(subject, styleFor(world));
}

export function locationPrompt(l: Location, world: World): string {
  const subject = [
    `${l.name}, a ${l.type} of the realm.`,
    l.description,
    l.weather ? `Weather: ${l.weather}.` : "",
    `Wide establishing shot, no people in frame, atmospheric, painterly, in-period architecture for a ${world.era || "medieval fantasy"} world.`,
  ]
    .filter(Boolean)
    .join(" ");
  return withStyle(subject, styleFor(world));
}

export function realmPrompt(world: World, locations: Location[]): string {
  // The realm map gets its own register — parchment, not painting. We let
  // the model invent the geography that fits the place names; it tends to
  // do beautifully here. Skip the painterly suffix; substitute a map suffix.
  const places = locations
    .slice(0, 14)
    .map((l) => `${l.name} (${l.type})`)
    .join("; ");
  return [
    `An old illustrated map of ${world.name}, painted on aged parchment.`,
    `${world.era}.`,
    `Place names labeled in elegant calligraphy: ${places}.`,
    `River systems, coastlines, mountain ridges, forests indicated by hand-drawn`,
    `symbology in the medieval cartographic tradition. Compass rose in one corner.`,
    `Decorative cartouche with the realm's name. Sea-monster or mythic creature`,
    `at the map's edge. Sepia and muted ochre palette, ink lines, watercolor wash.`,
    `Top-down view, no people, no modern objects, no anachronism.`,
    `Style: 17th-century atlas plate; the work of an old-world cartographer.`,
  ].join(" ");
}

export function scenePrompt(
  sketch: string,
  entry: { title: string; weather?: string },
  characters: Character[],
  location: Location | null,
  world: World,
): string {
  const cast = characters
    .slice(0, 3)
    .map((c) => `${c.name} (${c.portrait || c.epithet})`)
    .join("; ");
  const subject = [
    `${entry.title}.`,
    sketch,
    cast ? `Figures in the scene: ${cast}.` : "",
    location ? `Setting: ${location.name} — ${location.description}.` : "",
    entry.weather ? `Weather: ${entry.weather}.` : "",
    `Cinematic composition, characters captured mid-action, painterly, in-period for a ${world.era || "medieval fantasy"} world.`,
  ]
    .filter(Boolean)
    .join(" ");
  return withStyle(subject, styleFor(world));
}

// ── Cooldown state ──────────────────────────────────────────────────────────
// Persisted with the DB so cadence survives process restarts. We store it
// in the worlds table's updated_at-adjacent space — actually, simplest
// storage is the tick_log: walk back to find the most recent entry that
// has an image_path. This avoids new schema and is exactly what the
// cooldown wants.
export function lastSceneImageAt(db: Db, worldId: string): number | null {
  const recent = db.listEntries(worldId, 10);
  for (const e of recent) {
    if (e.imagePath) return new Date(e.createdAt).getTime();
  }
  return null;
}

export function sceneImageDue(db: Db, worldId: string, now = Date.now()): boolean {
  const last = lastSceneImageAt(db, worldId);
  if (last === null) return true;
  return now - last >= SCENE_COOLDOWN_MS;
}

// ── Fire-and-forget helpers ─────────────────────────────────────────────────
// All three return immediately on the caller's path; image work resolves on
// the JS event loop and writes back to the DB when ready (or logs and gives
// up if the API/budget refuses).

export function imageForCharacter(
  db: Db,
  world: World,
  characterId: string,
): void {
  const c = db.getCharacter(world.id, characterId);
  if (!c || c.imagePath) return;
  void runAndStore({
    label: `character:${c.id}`,
    subjectKey: `character:${world.id}:${c.id}`,
    prompt: characterPrompt(c, world),
    aspectRatio: "3:4",
    onSuccess: (relPath) => db.setCharacterImage(world.id, c.id, relPath),
  });
}

export function imageForRealm(db: Db, world: World): void {
  if (world.realmImagePath) return;
  const locations = db.listLocations(world.id);
  if (locations.length === 0) return;
  void runAndStore({
    label: `realm:${world.id}`,
    subjectKey: `realm:${world.id}`,
    prompt: realmPrompt(world, locations),
    aspectRatio: "16:9",
    onSuccess: (relPath) => db.setWorldRealmImage(world.id, relPath),
  });
}

export function imageForLocation(
  db: Db,
  world: World,
  locationId: string,
): void {
  const l = db.getLocation(world.id, locationId);
  if (!l || l.imagePath) return;
  void runAndStore({
    label: `location:${l.id}`,
    subjectKey: `location:${world.id}:${l.id}`,
    prompt: locationPrompt(l, world),
    aspectRatio: "16:9",
    onSuccess: (relPath) => db.setLocationImage(world.id, l.id, relPath),
  });
}

export interface SceneImageInput {
  entry: ChronicleEntry;
  sketch: string;
  characters: Character[];
  location: Location | null;
}

export function imageForScene(db: Db, world: World, input: SceneImageInput): void {
  if (input.entry.beatType === "world_report") return;
  if (input.entry.imagePath) return;
  if (!sceneImageDue(db, world.id)) return;
  void runAndStore({
    label: `entry:${input.entry.id}`,
    subjectKey: `entry:${world.id}:${input.entry.id}`,
    prompt: scenePrompt(
      input.sketch,
      { title: input.entry.title, weather: input.entry.weather },
      input.characters,
      input.location,
      world,
    ),
    aspectRatio: "16:9",
    onSuccess: (relPath) => db.setEntryImage(world.id, input.entry.id, relPath),
  });
}

interface RunArgs {
  label: string;
  subjectKey: string;
  prompt: string;
  aspectRatio: "1:1" | "16:9" | "4:3" | "3:2" | "2:3" | "3:4" | "9:16" | "21:9";
  onSuccess: (relPath: string) => void;
}

// Serial queue. Each new job chains onto the tail. Errors are swallowed at
// the chain level so one failure doesn't poison the rest.
let queueTail: Promise<void> = Promise.resolve();
let queueDepth = 0;

function enqueue(fn: () => Promise<void>): void {
  queueDepth++;
  queueTail = queueTail.then(async () => {
    try {
      await fn();
    } finally {
      queueDepth--;
    }
  });
}

export function pendingImageJobs(): number {
  return queueDepth;
}

// Awaitable form — used by tools that want to wait for the queue to drain
// (e.g. the backfill CLI). Day-to-day code uses fire-and-forget.
export async function drainImageQueue(): Promise<void> {
  await queueTail;
}

// Transient API failures ("fetch failed", 5xx) are common at this scale.
// We retry up to N times with exponential backoff before giving up. Budget
// still only ticks on a successful save inside the bare client.
const MAX_RETRIES = 3;

function runAndStore(args: RunArgs): void {
  enqueue(async () => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const out = await generateImage(
          {
            subjectKey: args.subjectKey,
            prompt: args.prompt,
            aspectRatio: args.aspectRatio,
          },
          { dailyBudget: DAILY_BUDGET },
        );
        if (!out) return; // budget exhausted — caller already logged
        args.onSuccess(out.path);
        return;
      } catch (err) {
        const msg = (err as Error).message;
        if (attempt === MAX_RETRIES) {
          console.error(
            `[image] ${args.label} failed after ${MAX_RETRIES} tries: ${msg}`,
          );
          return;
        }
        const wait = 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s
        console.error(
          `[image] ${args.label} attempt ${attempt} failed (${msg}); retrying in ${wait}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
  });
}

// Walk the world and enqueue images for everything important that doesn't
// have one yet. Caller controls the cap so a tick doesn't burn through the
// daily budget in one go. Order matters: locations are scarcer and a more
// reliable visual win, so they fill before atmospherics.
export interface BackfillResult {
  enqueuedLocations: number;
  enqueuedCharacters: number;
  remainingLocations: number;
  remainingCharacters: number;
}

export function backfillMissingImages(
  db: Db,
  world: World,
  limit: number,
): BackfillResult {
  const out: BackfillResult = {
    enqueuedLocations: 0,
    enqueuedCharacters: 0,
    remainingLocations: 0,
    remainingCharacters: 0,
  };
  let budget = limit;

  // The realm map first — single biggest visual upgrade per image spent.
  if (!world.realmImagePath && budget > 0) {
    imageForRealm(db, world);
    budget--;
  }

  // Locations next.
  const locations = db.listLocations(world.id);
  const missingLocs = locations.filter((l) => !l.imagePath);
  for (const l of missingLocs) {
    if (budget <= 0) {
      out.remainingLocations++;
      continue;
    }
    imageForLocation(db, world, l.id);
    out.enqueuedLocations++;
    budget--;
  }

  // Then characters — principals and secondaries are the priority.
  // Atmospherics get covered when there's spare budget.
  const chars = db.listCharacters(world.id);
  const ordered = [
    ...chars.filter((c) => c.weight === "principal" && !c.imagePath),
    ...chars.filter((c) => c.weight === "secondary" && !c.imagePath),
    ...chars.filter((c) => c.weight === "atmospheric" && !c.imagePath),
  ];
  for (const c of ordered) {
    if (budget <= 0) {
      out.remainingCharacters++;
      continue;
    }
    imageForCharacter(db, world, c.id);
    out.enqueuedCharacters++;
    budget--;
  }

  return out;
}
