// Validators run on parsed state changes. They check referential integrity
// and game-rule plausibility against the live DB. A change that fails any
// validator is rejected; the tick still commits the rest of the entry.

import type { Db } from "../db/index.js";
import type { StateChange, WorldId } from "./types.js";

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

export function validateChange(
  db: Db,
  worldId: WorldId,
  change: StateChange,
): ValidationResult {
  switch (change.kind) {
    case "mood_shift": {
      if (!db.getCharacter(worldId, change.characterId))
        return { ok: false, reason: `unknown character ${change.characterId}` };
      return { ok: true };
    }
    case "desire_added": {
      if (!db.getCharacter(worldId, change.characterId))
        return { ok: false, reason: `unknown character ${change.characterId}` };
      return { ok: true };
    }
    case "desire_satisfied": {
      const c = db.getCharacter(worldId, change.characterId);
      if (!c) return { ok: false, reason: `unknown character` };
      if (change.goalIndex >= c.desires.length)
        return { ok: false, reason: `goalIndex out of range` };
      return { ok: true };
    }
    case "memory_formed": {
      if (!db.getCharacter(worldId, change.characterId))
        return { ok: false, reason: `unknown character` };
      return { ok: true };
    }
    case "relationship_shift": {
      if (change.fromId === change.toId)
        return { ok: false, reason: `self-relationship` };
      if (!db.getCharacter(worldId, change.fromId))
        return { ok: false, reason: `unknown fromId` };
      if (!db.getCharacter(worldId, change.toId))
        return { ok: false, reason: `unknown toId` };
      return { ok: true };
    }
    case "character_moved": {
      if (!db.getCharacter(worldId, change.characterId))
        return { ok: false, reason: `unknown character` };
      if (!db.getLocation(worldId, change.toLocationId))
        return { ok: false, reason: `unknown location` };
      return { ok: true };
    }
    case "rumor_planted": {
      if (!db.getLocation(worldId, change.locationId))
        return { ok: false, reason: `unknown location` };
      return { ok: true };
    }
    default: {
      const _exhaustive: never = change;
      void _exhaustive;
      return { ok: false, reason: `unknown change kind` };
    }
  }
}
