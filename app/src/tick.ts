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
import { imageForCharacter, imageForScene } from "./images/index.js";

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

  // ── Spawn phase ──────────────────────────────────────────────────────
  // The director may introduce a new atmospheric character or open a new
  // subplot/ambient plot in this tick. Spawned characters can be focal in
  // this same tick's beat.
  if (plan.spawnCharacter) {
    const sc = plan.spawnCharacter;
    db.insertCharacter({
      id: sc.id,
      worldId,
      name: sc.name,
      epithet: sc.epithet,
      age: sc.age,
      where: sc.where,
      weight: "atmospheric",
      factionId: sc.factionId,
      portrait: sc.portrait,
      summary: sc.summary,
      mood: sc.mood,
      desires: sc.desires,
      traits: sc.traits,
      alive: true,
      secrets: sc.secrets,
    });
    notes.push(`spawned character ${sc.id}`);
    // Generate a portrait for the new figure — fire-and-forget.
    if (startWorld) imageForCharacter(db, startWorld, sc.id);
  }
  if (plan.spawnPlot) {
    const sp = plan.spawnPlot;
    db.insertPlot({
      id: sp.id,
      worldId,
      title: sp.title,
      tier: sp.tier,
      state: sp.state,
      tension: sp.tension,
      arc: sp.arc,
      central: sp.central,
      factionIds: sp.factionIds,
      themes: sp.themes,
      hooks: sp.hooks,
      beats: [],
      lastAdvancedTick: tickNumber,
    });
    notes.push(`spawned plot ${sp.id} (${sp.tier})`);
  }

  const isWorldReport = plan.beatType === "world_report";

  // ── Act phase ────────────────────────────────────────────────────────
  // For most beats: each focal character acts in turn. For world_report:
  // skipped — the scribe writes a chronicler's-aside.
  const actions: { characterId: string; action: CharacterActionParsed }[] = [];

  if (!isWorldReport) {
    const cast = plan.characterIds
      .map((cid) => db.getCharacter(worldId, cid))
      .filter((c): c is NonNullable<typeof c> => c !== null);

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
  }

  // ── Render phase ─────────────────────────────────────────────────────
  let rendered: ScribeOutputParsed;
  try {
    rendered = await scribe(db, { worldId, plan, actions });
  } catch (err) {
    const message = (err as Error).message;
    db.logTick(worldId, tickNumber, false, Date.now() - t0, `scribe: ${message}`);
    return { ok: false, worldId, tick: tickNumber, notes: message, durationMs: Date.now() - t0 };
  }

  // ── Commit phase ─────────────────────────────────────────────────────
  // Apply validated changes, write chronicle entry, advance plot beat,
  // advance prophecy, bump tier-tracking ticks, decay.
  const entryId = randomUUID();
  let appliedCount = 0;
  let rejectedCount = 0;

  db.raw.transaction(() => {
    // Order matters. Scribe's plotAdvance and prophecyAdvance run FIRST —
    // they record the director's intended outcome. Then character state
    // changes apply, which may *override* the plot (plot_deflected) or
    // erase a planned-future character (character_died). Characters get
    // the last word: that's how the chronicle stays dynamic.
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
        plot.lastAdvancedTick = tickNumber;
        db.updatePlot(plot);
      }
    }

    if (rendered.prophecyAdvance) {
      const pa = rendered.prophecyAdvance;
      const pr = db.getProphecy(worldId, pa.prophecyId);
      if (pr) {
        pr.status = pa.newStatus;
        pr.echoes = pr.echoes + 1;
        db.updateProphecy(pr);
      }
    }

    if (plan.factionId) {
      const f = db.getFaction(worldId, plan.factionId);
      if (f) {
        f.lastAdvancedTick = tickNumber;
        db.updateFaction(f);
      }
    }

    // Now character state changes — including ones that bend the world.
    const sceneCharacterIds = plan.characterIds.slice();
    for (const { action } of actions) {
      for (const change of action.proposedChanges) {
        const v = validateChange(db, worldId, change, {
          sceneLocationId: plan.locationId,
          sceneCharacterIds,
        });
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
    const plotIds = plan.plotId ? [plan.plotId] : [];
    if (plan.spawnPlot && !plotIds.includes(plan.spawnPlot.id)) {
      plotIds.push(plan.spawnPlot.id);
    }
    // Track plots deflected by character agency so they appear in the entry.
    for (const { action } of actions) {
      for (const change of action.proposedChanges) {
        if (change.kind === "plot_deflected" && !plotIds.includes(change.plotId)) {
          plotIds.push(change.plotId);
        }
      }
    }
    const factionIds = plan.factionId ? [plan.factionId] : [];
    const prophecyIds = plan.prophecyId ? [plan.prophecyId] : [];
    if (rendered.prophecyAdvance && !prophecyIds.includes(rendered.prophecyAdvance.prophecyId)) {
      prophecyIds.push(rendered.prophecyAdvance.prophecyId);
    }
    const locationIds = plan.locationId ? [plan.locationId] : [];

    const entry: ChronicleEntry = {
      id: entryId,
      worldId,
      tick: tickNumber,
      inWorldDate: rendered.inWorldDate,
      timeOfDay: rendered.timeOfDay,
      weather: rendered.weather,
      title: rendered.title,
      beatType: plan.beatType,
      plotIds,
      factionIds,
      prophecyIds,
      locationIds,
      characterIds: charIds,
      paragraphs: rendered.paragraphs.map((p) =>
        p.kind === "scene"
          ? { kind: "scene", text: p.text }
          : p.kind === "aside"
            ? { kind: "aside", text: p.text }
            : { kind: "dialogue", who: p.who, text: p.text },
      ),
      createdAt: new Date().toISOString(),
    };
    db.insertEntry(entry);

    db.bumpWorldTick(worldId, rendered.inWorldDate);
    db.decayMemories(worldId, 0.985);
  })();

  // Fire-and-forget hero image for scene beats. Cooldown gate (≥1 hour
  // since the last imaged entry) lives inside `imageForScene`.
  if (!isWorldReport) {
    const writtenEntry = db.listEntries(worldId, 1)[0];
    if (writtenEntry && writtenEntry.id === entryId) {
      const sceneCharacters = writtenEntry.characterIds
        .map((cid) => db.getCharacter(worldId, cid))
        .filter((c): c is NonNullable<typeof c> => c !== null);
      const sceneLocation = plan.locationId
        ? db.getLocation(worldId, plan.locationId)
        : null;
      imageForScene(db, startWorld, {
        entry: writtenEntry,
        sketch: plan.sketch,
        characters: sceneCharacters,
        location: sceneLocation,
      });
    }
  }

  const summary =
    `beat=${plan.beatType} applied=${appliedCount} rejected=${rejectedCount} cast=${actions.length}` +
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
