// The tick loop. Order is sacred.
//   direct → act → render → validate → commit → propagate → decay → chronicle
//
// One tick is one transaction. If any step throws, the tick rolls back and
// the world's tick counter is not advanced. Failures are logged loudly.

import { randomUUID } from "node:crypto";
import { director } from "./agents/director.js";
import { characterAct } from "./agents/character.js";
import { scribe } from "./agents/scribe.js";
import type { Db } from "./db/index.js";
import { applyChange } from "./world/apply.js";
import { validateChange } from "./world/validators.js";
import type {
  CharacterActionParsed,
  ScribeOutputParsed,
} from "./world/schemas.js";
import type {
  ChronicleEntry,
  DirectorPlan,
  PlotBeat,
  WorldId,
} from "./world/types.js";

export interface TickResult {
  ok: boolean;
  worldId: WorldId;
  tick: number;
  entryId?: string;
  notes: string;
  durationMs: number;
}

export async function runTick(db: Db, worldId: WorldId): Promise<TickResult> {
  const t0 = Date.now();
  const startWorld = db.getWorld(worldId);
  if (!startWorld) throw new Error(`world ${worldId} not found`);
  const tickNumber = startWorld.tick + 1;
  const notes: string[] = [];

  let plan: DirectorPlan;
  try {
    plan = await director(db, worldId);
  } catch (err) {
    const message = (err as Error).message;
    db.logTick(worldId, tickNumber, false, Date.now() - t0, `director: ${message}`);
    return { ok: false, worldId, tick: tickNumber, notes: message, durationMs: Date.now() - t0 };
  }

  // Resolve cast: each character in the plan, plus a one-line view of the
  // others in the scene that each character receives (no thoughts, no
  // memories — just name + epithet).
  const castIds = plan.characterIds;
  const cast = castIds
    .map((cid) => db.getCharacter(worldId, cid))
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const actions: { characterId: string; action: CharacterActionParsed }[] = [];
  for (const c of cast) {
    const others = cast
      .filter((o) => o.id !== c.id)
      .map((o) => ({ id: o.id, name: o.name, epithet: o.epithet }));
    try {
      const action = await characterAct(db, worldId, c.id, plan, others);
      actions.push({ characterId: c.id, action });
    } catch (err) {
      notes.push(`character ${c.id}: ${(err as Error).message}`);
    }
  }

  if (actions.length === 0) {
    db.logTick(worldId, tickNumber, false, Date.now() - t0, `no character actions: ${notes.join("; ")}`);
    return {
      ok: false,
      worldId,
      tick: tickNumber,
      notes: notes.join("; "),
      durationMs: Date.now() - t0,
    };
  }

  let rendered: ScribeOutputParsed;
  try {
    rendered = await scribe(db, { worldId, plan, actions });
  } catch (err) {
    const message = (err as Error).message;
    db.logTick(worldId, tickNumber, false, Date.now() - t0, `scribe: ${message}`);
    return { ok: false, worldId, tick: tickNumber, notes: message, durationMs: Date.now() - t0 };
  }

  // Commit transaction: apply validated changes, write chronicle entry,
  // append plot beat if present, bump tick.
  const entryId = randomUUID();
  let appliedCount = 0;
  let rejectedCount = 0;

  db.raw.transaction(() => {
    for (const { action } of actions) {
      for (const change of action.proposedChanges) {
        const v = validateChange(db, worldId, change);
        if (!v.ok) {
          notes.push(`rejected ${change.kind}: ${v.reason}`);
          rejectedCount++;
          continue;
        }
        applyChange(db, worldId, change, tickNumber);
        appliedCount++;
      }
    }

    const charIds = Array.from(new Set(actions.map((a) => a.characterId)));
    const entry: ChronicleEntry = {
      id: entryId,
      worldId,
      tick: tickNumber,
      inWorldDate: rendered.inWorldDate,
      timeOfDay: rendered.timeOfDay,
      weather: rendered.weather,
      title: rendered.title,
      plotIds: [plan.plotId],
      locationIds: [plan.locationId],
      characterIds: charIds,
      paragraphs: rendered.paragraphs.map((p) =>
        p.kind === "scene"
          ? { kind: "scene", text: p.text }
          : { kind: "dialogue", who: p.who, text: p.text },
      ),
      createdAt: new Date().toISOString(),
    };
    db.insertEntry(entry);

    if (rendered.plotAdvance) {
      const pa = rendered.plotAdvance;
      const plot = db.getPlot(worldId, pa.plotId);
      if (plot) {
        const beat: PlotBeat = {
          tick: tickNumber,
          type: plan.beatType,
          title: pa.beatTitle,
          when: pa.beatWhen,
          sketch: pa.beatSketch,
        };
        plot.beats = [...plot.beats, beat];
        plot.state = pa.newState;
        plot.tension = pa.newTension;
        db.updatePlot(plot);
      }
    }

    db.bumpWorldTick(worldId, rendered.inWorldDate);
    db.decayMemories(worldId, 0.985);
  })();

  const summary =
    `applied=${appliedCount} rejected=${rejectedCount} cast=${cast.length}` +
    (notes.length ? ` notes="${notes.join("; ")}"` : "");
  db.logTick(worldId, tickNumber, true, Date.now() - t0, summary);

  return {
    ok: true,
    worldId,
    tick: tickNumber,
    entryId,
    notes: summary,
    durationMs: Date.now() - t0,
  };
}
