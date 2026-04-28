// Pure cross-reference checks for genesis output. Each function returns a
// list of `RepairIssue` instead of throwing, so a parser/repair loop can fold
// them in alongside Zod's structural issues. Throwing was the wrong shape:
// the LLM is one re-prompt away from fixing most of these — we just need to
// hand it the path and the constraint.
//
// We also expose `dropStaleRelationships` for the cases where a re-prompt is
// not worth the cost: relationships are noise, the model invents ids freely,
// and a few dropped edges are harmless compared to a 2-minute LLM call.

import type {
  GenesisAtmospherics,
  GenesisFrame,
  GenesisSecondaries,
} from "../world/schemas.js";
import type { RepairIssue } from "../llm/repair.js";

export interface FrameContext {
  locIds: Set<string>;
  factionIds: Set<string>;
  charIds: Set<string>;
  plotIds: Set<string>;
}

export function frameContext(frame: GenesisFrame): FrameContext {
  return {
    locIds: new Set(frame.locations.map((l) => l.id)),
    factionIds: new Set(frame.factions.map((f) => f.id)),
    charIds: new Set(frame.characters.map((c) => c.id)),
    plotIds: new Set(frame.plots.map((p) => p.id)),
  };
}

function listIds(set: Set<string>, max = 10): string {
  const arr = [...set];
  if (arr.length <= max) return arr.join(", ");
  return `${arr.slice(0, max).join(", ")}, …`;
}

export function frameIssues(frame: GenesisFrame): RepairIssue[] {
  const ctx = frameContext(frame);
  const issues: RepairIssue[] = [];

  for (const [i, c] of frame.characters.entries()) {
    if (c.weight !== "principal") {
      issues.push({
        path: `characters[${i}].weight`,
        message: `must be "principal", got "${c.weight}"`,
      });
    }
    if (!ctx.locIds.has(c.where)) {
      issues.push({
        path: `characters[${i}].where`,
        message: `unknown location id "${c.where}" — must be one of: ${listIds(ctx.locIds)}`,
      });
    }
    if (c.factionId && !ctx.factionIds.has(c.factionId)) {
      issues.push({
        path: `characters[${i}].factionId`,
        message: `unknown faction id "${c.factionId}" — must be one of: ${listIds(ctx.factionIds)} (or omit the key)`,
      });
    }
  }

  for (const [i, f] of frame.factions.entries()) {
    if (f.seatLocationId && !ctx.locIds.has(f.seatLocationId)) {
      issues.push({
        path: `factions[${i}].seatLocationId`,
        message: `unknown location id "${f.seatLocationId}" (or omit the key)`,
      });
    }
  }

  for (const [i, p] of frame.plots.entries()) {
    for (const cid of p.central) {
      if (!ctx.charIds.has(cid)) {
        issues.push({
          path: `plots[${i}].central`,
          message: `unknown character id "${cid}" — must be one of: ${listIds(ctx.charIds)}`,
        });
      }
    }
    for (const fid of p.factionIds) {
      if (!ctx.factionIds.has(fid)) {
        issues.push({
          path: `plots[${i}].factionIds`,
          message: `unknown faction id "${fid}"`,
        });
      }
    }
  }

  for (const [i, pr] of frame.prophecies.entries()) {
    for (const pid of pr.relatedPlotIds) {
      if (!ctx.plotIds.has(pid)) {
        issues.push({
          path: `prophecies[${i}].relatedPlotIds`,
          message: `unknown plot id "${pid}" — known plots: ${listIds(ctx.plotIds)}`,
        });
      }
    }
    for (const cid of pr.relatedCharacterIds) {
      if (!ctx.charIds.has(cid)) {
        issues.push({
          path: `prophecies[${i}].relatedCharacterIds`,
          message: `unknown character id "${cid}"`,
        });
      }
    }
    if (pr.targetPayoffMax <= pr.targetPayoffMin) {
      issues.push({
        path: `prophecies[${i}]`,
        message: `targetPayoffMax (${pr.targetPayoffMax}) must be greater than targetPayoffMin (${pr.targetPayoffMin})`,
      });
    }
  }

  for (const [i, r] of frame.relationships.entries()) {
    if (!ctx.charIds.has(r.fromId)) {
      issues.push({
        path: `relationships[${i}].fromId`,
        message: `unknown character id "${r.fromId}"`,
      });
    }
    if (!ctx.charIds.has(r.toId)) {
      issues.push({
        path: `relationships[${i}].toId`,
        message: `unknown character id "${r.toId}"`,
      });
    }
  }

  // Spine count is normalized post-parse (`normalizeSpineCount`) — the model
  // routinely tags 0 or 2+ spines and a re-prompt rarely fixes it. Demoting
  // the extras (or promoting the highest-tension plot) is harmless and saves
  // a 30-60s LLM round trip.

  return issues;
}

// Force exactly one spine plot. If the model returned 2+, keep the
// highest-tension one and demote the rest to subplot. If it returned 0,
// promote the highest-tension non-ambient plot. Returns the number of
// re-tiered plots for logging.
export function normalizeSpineCount(plots: GenesisFrame["plots"]): number {
  const spines = plots.filter((p) => p.tier === "spine");
  if (spines.length === 1) return 0;

  if (spines.length > 1) {
    const keep = spines.reduce((a, b) => (b.tension > a.tension ? b : a));
    let changed = 0;
    for (const p of spines) {
      if (p !== keep) {
        p.tier = "subplot";
        changed++;
      }
    }
    return changed;
  }

  // 0 spines — promote the highest-tension subplot, or the highest-tension
  // plot of any tier if there are no subplots.
  const candidates = plots.filter((p) => p.tier === "subplot");
  const pool = candidates.length > 0 ? candidates : plots;
  if (pool.length === 0) return 0;
  const promote = pool.reduce((a, b) => (b.tension > a.tension ? b : a));
  promote.tier = "spine";
  return 1;
}

// Issues for a stage that adds characters to an existing context. We don't
// flag relationship reference errors here — the orchestrator drops stale
// relationships post-parse rather than spending a re-prompt on them.
export function stageCharacterIssues(
  stage: GenesisSecondaries | GenesisAtmospherics,
  ctx: FrameContext,
  expectedWeight: "secondary" | "atmospheric",
): RepairIssue[] {
  const issues: RepairIssue[] = [];
  const seen = new Set<string>(ctx.charIds);
  for (const [i, c] of stage.characters.entries()) {
    if (c.weight !== expectedWeight) {
      issues.push({
        path: `characters[${i}].weight`,
        message: `must be "${expectedWeight}", got "${c.weight}"`,
      });
    }
    if (!ctx.locIds.has(c.where)) {
      issues.push({
        path: `characters[${i}].where`,
        message: `unknown location id "${c.where}" — must be one of: ${listIds(ctx.locIds)}`,
      });
    }
    if (c.factionId && !ctx.factionIds.has(c.factionId)) {
      issues.push({
        path: `characters[${i}].factionId`,
        message: `unknown faction id "${c.factionId}" (or omit)`,
      });
    }
    if (seen.has(c.id)) {
      issues.push({
        path: `characters[${i}].id`,
        message: `duplicate character id "${c.id}" — already exists in the frame or earlier in this list`,
      });
    }
    seen.add(c.id);
  }
  return issues;
}

// Filter relationships against an id set — used to drop invented refs without
// re-prompting. Returns both the kept list and a dropped count for logging.
export function dropStaleRelationships<R extends { fromId: string; toId: string }>(
  rels: R[],
  validIds: Set<string>,
): { kept: R[]; dropped: number } {
  const kept: R[] = [];
  let dropped = 0;
  for (const r of rels) {
    if (validIds.has(r.fromId) && validIds.has(r.toId)) kept.push(r);
    else dropped++;
  }
  return { kept, dropped };
}
