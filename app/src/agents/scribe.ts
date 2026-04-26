// Scribe agent: receives the director's plan + each character's actable
// output and renders the chronicle entry. Returns prose + an optional
// plot advance. Never decides events.

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
  const here = db.getLocation(input.worldId, input.plan.locationId);
  const plot = db.getPlot(input.worldId, input.plan.plotId);
  const recent = db.listEntries(input.worldId, 2).map((e) => ({
    title: e.title,
    inWorldDate: e.inWorldDate,
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

  const ctx = {
    world: {
      name: world.name,
      tone: world.tone,
      themes: world.themes,
      era: world.era,
    },
    plan: input.plan,
    plot: plot
      ? { id: plot.id, title: plot.title, state: plot.state, tension: plot.tension }
      : null,
    where: here
      ? {
          id: here.id,
          name: here.name,
          description: here.description,
          weather: here.weather,
        }
      : null,
    cast,
    recentTitles: recent,
  };

  const raw = await callScribe({
    system: loadPrompt("scribe"),
    user: `Render the next chronicle entry from this material:\n\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`\n\nReturn one fenced JSON block.`,
    maxTokens: 2048,
  });

  return scribeOutputSchema.parse(extractJson(raw));
}
