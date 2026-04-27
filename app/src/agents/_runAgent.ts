// Thin wrapper that wires an agent call through `parseAndRepair`. Every
// agent (director, character, scribe) does the same dance: build prompt,
// call model, parse with schema, run cross-checks. Repair on failure.
//
// The agent supplies:
//   - `call` — the model client (callDirector/callCharacter/callScribe)
//   - `system` / `user` — prompt halves
//   - `schema` — Zod schema
//   - `validate` — optional referential cross-checks
//
// The wrapper handles the repair loop, max-attempt bound, and identical
// fix-up prompt format used at genesis. One implementation, all agents.

import type { ZodTypeAny, infer as ZInfer } from "zod";
import { buildRepairPrompt, parseAndRepair, type RepairIssue } from "../llm/repair.js";

export interface AgentRunArgs<S extends ZodTypeAny> {
  label: string;
  call: (opts: {
    system: string;
    user: string;
    maxTokens?: number;
  }) => Promise<string>;
  system: string;
  user: string;
  schema: S;
  maxTokens: number;
  validate?: (parsed: ZInfer<S>) => RepairIssue[];
  maxAttempts?: number;
  onAttempt?: (attempt: number, issues: RepairIssue[], accepted: boolean) => void;
}

export async function runAgent<S extends ZodTypeAny>(
  args: AgentRunArgs<S>,
): Promise<ZInfer<S>> {
  const initialRaw = await args.call({
    system: args.system,
    user: args.user,
    maxTokens: args.maxTokens,
  });
  return parseAndRepair<S>({
    label: args.label,
    schema: args.schema,
    initialRaw,
    extraIssues: args.validate,
    maxAttempts: args.maxAttempts ?? 3,
    onAttempt: args.onAttempt,
    repair: async (previousRaw, issues) => {
      const repairUser = buildRepairPrompt(previousRaw, issues);
      return args.call({
        system: args.system,
        user: repairUser,
        maxTokens: args.maxTokens,
      });
    },
  });
}
