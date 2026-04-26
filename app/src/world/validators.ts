// Validators run on parsed state changes. They check referential integrity
// and game-rule plausibility against the live DB. A change that fails any
// validator is rejected; the tick still commits the rest of the entry.

import type { Db } from "../db/index.js";
import type { CharacterId, LocationId, StateChange, WorldId } from "./types.js";

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

export interface ValidateContext {
  // Public facts of the current scene used to gate physical actions. A
  // character can only kill someone in the room, not at long distance.
  sceneLocationId?: LocationId;
  sceneCharacterIds?: CharacterId[];
}

export function validateChange(
  db: Db,
  worldId: WorldId,
  change: StateChange,
  ctx: ValidateContext = {},
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
    case "prophecy_echoed": {
      if (!db.getProphecy(worldId, change.prophecyId))
        return { ok: false, reason: `unknown prophecy ${change.prophecyId}` };
      return { ok: true };
    }
    case "character_died": {
      const target = db.getCharacter(worldId, change.characterId);
      if (!target) return { ok: false, reason: `unknown character ${change.characterId}` };
      if (!target.alive) return { ok: false, reason: `target already dead` };
      // The death must happen in the scene — the dying character must be
      // physically present. Atmospheric off-stage deaths come from the
      // director (via a future world_report or beat), not from a character
      // agent.
      if (ctx.sceneCharacterIds && !ctx.sceneCharacterIds.includes(change.characterId))
        return { ok: false, reason: `target not in scene` };
      return { ok: true };
    }
    case "oath_sworn": {
      if (!db.getCharacter(worldId, change.characterId))
        return { ok: false, reason: `unknown character` };
      if (change.beforeWhom && !db.getCharacter(worldId, change.beforeWhom))
        return { ok: false, reason: `unknown witness ${change.beforeWhom}` };
      return { ok: true };
    }
    case "secret_revealed": {
      const c = db.getCharacter(worldId, change.characterId);
      if (!c) return { ok: false, reason: `unknown character` };
      if (change.secretIndex >= c.secrets.length)
        return { ok: false, reason: `secretIndex out of range` };
      if (!ctx.sceneLocationId)
        return { ok: false, reason: `no scene location to plant rumour` };
      return { ok: true };
    }
    case "faction_changed": {
      if (!db.getCharacter(worldId, change.characterId))
        return { ok: false, reason: `unknown character` };
      if (change.toFactionId !== null && !db.getFaction(worldId, change.toFactionId))
        return { ok: false, reason: `unknown faction ${change.toFactionId}` };
      return { ok: true };
    }
    case "plot_deflected": {
      const actor = db.getCharacter(worldId, change.characterId);
      if (!actor) return { ok: false, reason: `unknown actor` };
      const plot = db.getPlot(worldId, change.plotId);
      if (!plot) return { ok: false, reason: `unknown plot` };
      const isCentral = plot.central.includes(change.characterId);
      const sharesFaction =
        actor.factionId !== undefined && plot.factionIds.includes(actor.factionId);
      if (!isCentral && !sharesFaction)
        return {
          ok: false,
          reason: `actor lacks standing to deflect plot (not central, not in faction)`,
        };
      return { ok: true };
    }
    default: {
      const _exhaustive: never = change;
      void _exhaustive;
      return { ok: false, reason: `unknown change kind` };
    }
  }
}
