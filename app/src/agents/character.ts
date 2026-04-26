// Character agent: produces one character's thought + saysOrDoes for a beat.
// Receives ONLY this character's slice: their own state, top memories, the
// relationships *they* hold, and the public facts of the scene. If the
// director threaded a prophecy through this beat, the character receives
// the prophecy's surface text (never the hidden meaning) so they can
// propose `prophecy_echoed` without speaking the prophecy aloud.

import { callCharacter, extractJson } from "../llm/client.js";
import { loadPrompt } from "../prompts/loader.js";
import {
  characterActionSchema,
  type CharacterActionParsed,
} from "../world/schemas.js";
import type { Db } from "../db/index.js";
import type { CharacterId, DirectorPlan, WorldId } from "../world/types.js";

export async function characterAct(
  db: Db,
  worldId: WorldId,
  characterId: CharacterId,
  plan: DirectorPlan,
  sceneOthers: { id: CharacterId; name: string; epithet: string }[],
): Promise<CharacterActionParsed> {
  const me = db.getCharacter(worldId, characterId);
  if (!me) throw new Error(`unknown character ${characterId}`);
  const here = plan.locationId ? db.getLocation(worldId, plan.locationId) : null;
  const myRels = db.listRelationshipsFrom(worldId, characterId);
  const memories = db.listMemories(worldId, characterId).slice(0, 4);
  const prophecyHint = plan.prophecyId
    ? db.getProphecy(worldId, plan.prophecyId)
    : null;

  // Plots this character has standing in — used to gate plot_deflected.
  const allPlots = db.listPlots(worldId);
  const myPlots = allPlots.filter(
    (p) =>
      p.central.includes(me.id) ||
      (me.factionId !== undefined && p.factionIds.includes(me.factionId)),
  );

  const ctx = {
    me: {
      id: me.id,
      name: me.name,
      epithet: me.epithet,
      age: me.age,
      weight: me.weight,
      summary: me.summary,
      mood: me.mood,
      desires: me.desires,
      traits: me.traits,
      factionId: me.factionId,
      // The character's own secrets, indexed — they may choose to reveal one
      // by index. NEVER passed to any other agent.
      mySecrets: me.secrets.map((text, index) => ({ index, text })),
    },
    scene: {
      where: here ? { name: here.name, description: here.description, weather: here.weather } : null,
      pacing: plan.pacingNote,
      beat: plan.sketch,
      others: sceneOthers,
      // Surface text only — never hidden meaning.
      prophecyInTheAir: prophecyHint
        ? { id: prophecyHint.id, text: prophecyHint.text, source: prophecyHint.source }
        : null,
    },
    plotsIHaveStandingIn: myPlots.map((p) => ({
      id: p.id,
      title: p.title,
      tier: p.tier,
      state: p.state,
      arc: p.arc,
    })),
    myMemories: memories.map((m) => ({ weight: m.weight, text: m.text })),
    howIHoldOthers: myRels.map((r) => ({
      whom: r.toId,
      typeFromMe: r.typeFromMe,
      affection: r.affection,
      trust: r.trust,
      note: r.note,
    })),
  };

  const raw = await callCharacter({
    system: loadPrompt("character"),
    user: `You are ${me.name} (${me.epithet}). The scene is:\n\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`\n\nReturn one fenced JSON block with thought, saysOrDoes, and proposedChanges.`,
    maxTokens: 800,
  });

  return characterActionSchema.parse(extractJson(raw));
}
