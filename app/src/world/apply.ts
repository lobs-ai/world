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
  }
}
