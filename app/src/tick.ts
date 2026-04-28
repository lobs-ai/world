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
import { backfillMissingImages, imageForCharacter, imageForScene } from "./images/index.js";

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

    // Character agents are read-only against the DB during the act phase, so
    // run them in parallel. Wall-clock per tick used to be (director + N×char +
    // scribe) sequential; now it's max(char) instead of sum(char).
    const settled = await Promise.allSettled(
      cast.map((c) => {
        const others = cast
          .filter((o) => o.id !== c.id)
          .map((o) => ({ id: o.id, name: o.name, epithet: o.epithet }));
        return characterAct(db, worldId, c.id, plan, others).then((action) => ({
          characterId: c.id,
          action,
        }));
      }),
    );

    for (let i = 0; i < settled.length; i++) {
      const r = settled[i]!;
      if (r.status === "fulfilled") {
        actions.push(r.value);
      } else {
        notes.push(`character ${cast[i]!.id}: ${(r.reason as Error).message}`);
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
          // Chapter identity. Prefer scribe-finalized phrasing; fall back
          // to whatever the director proposed in the plan so we never
          // lose them on the way through.
          question: pa.beatQuestion ?? plan.beatQuestion,
          stakes: pa.beatStakes ?? plan.beatStakes,
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

    // ── Memory propagation ────────────────────────────────────────────
    // Off-stage characters who *would have heard* about this scene gain a
    // low-weight memory. Without this, only the focal cast ever has an
    // opinion about anything, and the world doesn't feel populated. We
    // propagate to anyone with a strong-enough relationship (trust ≥ 0.3
    // or affection ≥ 0.3) to a focal participant, capped to keep memory
    // tables manageable. Skipped for world_report (no focal cast) and for
    // private beats (the whole point is the audience is small).
    if (plan.beatType !== "world_report" && plan.beatType !== "private" && charIds.length > 0) {
      const PROPAGATION_CAP = 12;
      const seen = new Set<string>(charIds);
      const candidates: { characterId: string; weight: number }[] = [];
      for (const focalId of charIds) {
        const rels = db.listRelationshipsFrom(worldId, focalId);
        for (const r of rels) {
          if (seen.has(r.toId)) continue;
          if (r.trust < 0.3 && r.affection < 0.3) continue;
          // Also skip dead listeners — checking aliveness lets us avoid
          // lighting up corpses with fresh memories.
          const other = db.getCharacter(worldId, r.toId);
          if (!other || !other.alive) continue;
          seen.add(r.toId);
          // Heavier bond → heavier memory, but always low-weight (this is
          // hearsay, not lived experience).
          const w = Math.min(0.18, Math.max(0.06, (r.trust + r.affection) * 0.07 + 0.06));
          candidates.push({ characterId: r.toId, weight: w });
          if (candidates.length >= PROPAGATION_CAP) break;
        }
        if (candidates.length >= PROPAGATION_CAP) break;
      }
      const text = `Word reached me of "${rendered.title}" — ${plan.sketch.slice(0, 240)}`;
      for (const cand of candidates) {
        db.insertMemory({
          id: randomUUID(),
          worldId,
          characterId: cand.characterId,
          weight: cand.weight,
          text,
          tickLearned: tickNumber,
        });
      }
      if (candidates.length > 0) {
        notes.push(`propagated ${candidates.length} hearsay memories`);
      }
    }

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

  // Top up missing images for locations and principals/secondaries. Cap
  // each tick so we don't burn the daily budget in one go: 4 per 15-min
  // tick = ~16/hour ceiling, and the 50/day budget gate inside the bare
  // client is the hard backstop.
  backfillMissingImages(db, startWorld, 4);

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
