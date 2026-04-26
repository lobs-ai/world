// Applier: takes a validated state change and writes it to the DB.
// Each branch must be idempotent under the assumption that the caller
// wraps a tick in a transaction (see tick.ts).

import { randomUUID } from "node:crypto";
import type { Db } from "../db/index.js";
import type { StateChange, WorldId } from "./types.js";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function applyChange(db: Db, worldId: WorldId, change: StateChange, tick: number): void {
  switch (change.kind) {
    case "mood_shift": {
      const c = db.getCharacter(worldId, change.characterId);
      if (!c) return;
      c.mood = {
        dominant: change.dominant,
        valence: clamp(change.valence, -1, 1),
        arousal: clamp(change.arousal, 0, 1),
      };
      db.updateCharacter(c);
      return;
    }
    case "desire_added": {
      const c = db.getCharacter(worldId, change.characterId);
      if (!c) return;
      c.desires = [
        ...c.desires,
        {
          goal: change.goal,
          intensity: clamp(change.intensity, 0, 1),
          unspoken: change.unspoken,
        },
      ].slice(-4);
      db.updateCharacter(c);
      return;
    }
    case "desire_satisfied": {
      const c = db.getCharacter(worldId, change.characterId);
      if (!c) return;
      c.desires = c.desires.filter((_, i) => i !== change.goalIndex);
      db.updateCharacter(c);
      return;
    }
    case "memory_formed": {
      db.insertMemory({
        id: randomUUID(),
        worldId,
        characterId: change.characterId,
        weight: clamp(change.weight, 0, 1),
        text: change.text,
        tickLearned: tick,
      });
      return;
    }
    case "relationship_shift": {
      const existing = db
        .listRelationshipsFrom(worldId, change.fromId)
        .find((r) => r.toId === change.toId);
      const base = existing ?? {
        worldId,
        fromId: change.fromId,
        toId: change.toId,
        typeFromMe: "acquaintance",
        affection: 0,
        trust: 0,
        note: "",
      };
      db.upsertRelationship({
        ...base,
        affection: clamp(base.affection + change.affectionDelta, -1, 1),
        trust: clamp(base.trust + change.trustDelta, -1, 1),
        note: change.note ?? base.note,
      });
      return;
    }
    case "character_moved": {
      const c = db.getCharacter(worldId, change.characterId);
      if (!c) return;
      c.where = change.toLocationId;
      db.updateCharacter(c);
      return;
    }
    case "rumor_planted": {
      db.insertRumor({
        id: randomUUID(),
        worldId,
        locationId: change.locationId,
        text: change.text,
        truth: clamp(change.truth, 0, 1),
        tickPlanted: tick,
      });
      return;
    }
    case "prophecy_echoed": {
      // A character (or beat) has touched the prophecy. We bump the echoes
      // counter and, if it is still unfulfilled, move it to "echoing".
      // The director / scribe is what drives further status moves.
      const pr = db.getProphecy(worldId, change.prophecyId);
      if (!pr) return;
      pr.echoes = pr.echoes + 1;
      if (pr.status === "unfulfilled") pr.status = "echoing";
      db.updateProphecy(pr);
      return;
    }
    case "character_died": {
      const c = db.getCharacter(worldId, change.characterId);
      if (!c) return;
      c.alive = false;
      db.updateCharacter(c);
      // The cause becomes a heavy memory shared by the actor — but we
      // don't know who that is at this layer; the character agent that
      // proposed this should also propose a memory_formed for itself.
      return;
    }
    case "oath_sworn": {
      const c = db.getCharacter(worldId, change.characterId);
      if (!c) return;
      c.desires = [
        ...c.desires.filter((d) => d.goal !== change.vow),
        { goal: change.vow, intensity: 1.0 },
      ].slice(-4);
      db.updateCharacter(c);
      // A heavy memory marks the moment the oath was bound.
      db.insertMemory({
        id: randomUUID(),
        worldId,
        characterId: change.characterId,
        weight: 0.95,
        text: `Sworn: ${change.vow}` + (change.beforeWhom ? ` (before ${change.beforeWhom})` : ""),
        tickLearned: tick,
      });
      return;
    }
    case "secret_revealed": {
      const c = db.getCharacter(worldId, change.characterId);
      if (!c) return;
      const secret = c.secrets[change.secretIndex];
      if (!secret) return;
      c.secrets = c.secrets.filter((_, i) => i !== change.secretIndex);
      db.updateCharacter(c);
      // The secret leaves private state: it becomes a rumour at the
      // scene's location with high truth (these are confessions, not
      // gossip).
      // The applier doesn't know the scene location directly, but the
      // tick caller passes it via the "rumor_planted" change typically.
      // Here we just plant at the character's current `where` since
      // they are physically present there.
      db.insertRumor({
        id: randomUUID(),
        worldId,
        locationId: c.where,
        text: secret,
        truth: change.asRumourTruth ?? 0.95,
        tickPlanted: tick,
      });
      // Heavy memory for the speaker.
      db.insertMemory({
        id: randomUUID(),
        worldId,
        characterId: change.characterId,
        weight: 0.9,
        text: `Spoke aloud what had been kept: ${secret}`,
        tickLearned: tick,
      });
      return;
    }
    case "faction_changed": {
      const c = db.getCharacter(worldId, change.characterId);
      if (!c) return;
      c.factionId = change.toFactionId ?? undefined;
      db.updateCharacter(c);
      db.insertMemory({
        id: randomUUID(),
        worldId,
        characterId: change.characterId,
        weight: 0.85,
        text: `Changed banner: ${change.reason}`,
        tickLearned: tick,
      });
      return;
    }
    case "plot_deflected": {
      const plot = db.getPlot(worldId, change.plotId);
      if (!plot) return;
      plot.arc = change.newArc;
      if (typeof change.newTension === "number") {
        plot.tension = clamp(change.newTension, 0, 1);
      }
      if (change.newState) plot.state = change.newState;
      plot.lastAdvancedTick = tick;
      db.updatePlot(plot);
      // A heavy memory for the deflector — the deed sits on them.
      db.insertMemory({
        id: randomUUID(),
        worldId,
        characterId: change.characterId,
        weight: 0.95,
        text: `Bent the thread: ${change.why}`,
        tickLearned: tick,
      });
      return;
    }
  }
}
