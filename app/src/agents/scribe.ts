// Scribe agent: receives the director's plan + each character's actable
// output and renders the chronicle entry. Returns prose + an optional
// plot advance and an optional prophecy advance. Never decides events.
//
// For a world_report beat there is no character cast and no scene
// location — the scribe writes a chronicler's-aside paragraph or two.

import { callScribe, extractJson } from "../llm/client.js";
import { loadPrompt } from "../prompts/loader.js";
import {
  scribeOutputSchema,
  type ScribeOutputParsed,
} from "../world/schemas.js";
import type { Db } from "../db/index.js";
import type {
  CharacterActionParsed,
} from "../world/schemas.js";
import type { CharacterId, DirectorPlan, WorldId } from "../world/types.js";

export interface ScribeInput {
  worldId: WorldId;
  plan: DirectorPlan;
  actions: { characterId: CharacterId; action: CharacterActionParsed }[];
}

export async function scribe(
  db: Db,
  input: ScribeInput,
): Promise<ScribeOutputParsed> {
  const world = db.getWorld(input.worldId);
  if (!world) throw new Error(`world not found`);
  const plot = input.plan.plotId ? db.getPlot(input.worldId, input.plan.plotId) : null;
  const here = input.plan.locationId ? db.getLocation(input.worldId, input.plan.locationId) : null;
  const faction = input.plan.factionId ? db.getFaction(input.worldId, input.plan.factionId) : null;
  const prophecy = input.plan.prophecyId ? db.getProphecy(input.worldId, input.plan.prophecyId) : null;
  const recent = db.listEntries(input.worldId, 3).map((e) => ({
    title: e.title,
    inWorldDate: e.inWorldDate,
    beatType: e.beatType,
  }));
  const cast = input.actions.map(({ characterId, action }) => {
    const c = db.getCharacter(input.worldId, characterId);
    return {
      id: characterId,
      name: c?.name ?? characterId,
      epithet: c?.epithet ?? "",
      thought: action.thought,
      saysOrDoes: action.saysOrDoes,
    };
  });

  // For world_report, gather a wider rumour sample across locations so the
  // chronicler has something to weave.
  const ambientRumours: { where: string; text: string; truth: number }[] = [];
  if (input.plan.beatType === "world_report") {
    const locs = db.listLocations(input.worldId);
    for (const l of locs) {
      const rs = db.listRumors(input.worldId, l.id).slice(0, 2);
      for (const r of rs) ambientRumours.push({ where: l.name, text: r.text, truth: r.truth });
      if (ambientRumours.length >= 8) break;
    }
  }

  const ctx = {
    world: {
      name: world.name,
      tone: world.tone,
      themes: world.themes,
      era: world.era,
    },
    deepHistory: world.deepHistory,
    plan: {
      beatType: input.plan.beatType,
      beatTitle: input.plan.beatTitle,
      sketch: input.plan.sketch,
      pacingNote: input.plan.pacingNote,
    },
    plot: plot
      ? {
          id: plot.id,
          title: plot.title,
          tier: plot.tier,
          state: plot.state,
          tension: plot.tension,
        }
      : null,
    where: here
      ? {
          id: here.id,
          name: here.name,
          description: here.description,
          weather: here.weather,
        }
      : null,
    faction: faction
      ? {
          id: faction.id,
          name: faction.name,
          banner: faction.banner,
          summary: faction.summary,
        }
      : null,
    prophecy: prophecy
      ? {
          // Note: hiddenMeaning is intentionally NOT included.
          id: prophecy.id,
          text: prophecy.text,
          source: prophecy.source,
          status: prophecy.status,
        }
      : null,
    cast,
    ambientRumours,
    recentTitles: recent,
  };

  const raw = await callScribe({
    system: loadPrompt("scribe"),
    user: `Render the next chronicle entry from this material:\n\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`\n\nReturn one fenced JSON block.`,
    maxTokens: 2048,
  });

  return scribeOutputSchema.parse(extractJson(raw));
}
