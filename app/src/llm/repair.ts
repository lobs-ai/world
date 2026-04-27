// Generic parse-with-repair loop for LLM JSON output.
//
// The model produces JSON; we validate (Zod schema + optional referential
// checks). On failure, we collect the issues into a structured list, build a
// focused fix-up prompt, and re-call the model. The model returns a corrected
// JSON; we retry. Bounded by `maxAttempts`.
//
// Two failure surfaces feed the same loop:
//   - Zod parse errors (shape, type, length, missing keys)
//   - Caller-supplied `extraIssues` (referential integrity, semantic rules)
//
// Caller wires the actual model call via `repair(previousRaw, issues)` →
// returns the next raw string. The loop never speaks to the model directly,
// which keeps the layering clean and the loop easy to test offline.

import { ZodError, type ZodTypeAny, type infer as ZInfer } from "zod";
import { extractJson } from "./client.js";

export interface RepairIssue {
  path: string;
  message: string;
}

export interface RepairOptions<S extends ZodTypeAny> {
  // Human-readable label for error messages and logs.
  label: string;
  schema: S;
  initialRaw: string;
  // Build the fix-up call. Callers usually re-use the original system prompt
  // and only swap the user message.
  repair: (previousRaw: string, issues: RepairIssue[]) => Promise<string>;
  // Optional referential / semantic checks beyond schema shape.
  extraIssues?: (parsed: ZInfer<S>) => RepairIssue[];
  maxAttempts?: number;
  onAttempt?: (
    attempt: number,
    issues: RepairIssue[],
    accepted: boolean,
  ) => void;
}

export async function parseAndRepair<S extends ZodTypeAny>(
  opts: RepairOptions<S>,
): Promise<ZInfer<S>> {
  const max = opts.maxAttempts ?? 3;
  let raw = opts.initialRaw;
  let issues: RepairIssue[] = [];
  let parsed: ZInfer<S> | null = null;

  for (let attempt = 1; attempt <= max; attempt++) {
    parsed = null;
    issues = [];
    try {
      parsed = opts.schema.parse(extractJson(raw)) as ZInfer<S>;
    } catch (err) {
      issues.push(...zodErrorToIssues(err));
    }
    if (parsed && opts.extraIssues) {
      const extras = opts.extraIssues(parsed);
      if (extras.length) issues.push(...extras);
    }

    const ok = parsed !== null && issues.length === 0;
    if (opts.onAttempt) opts.onAttempt(attempt, issues, ok);
    if (ok) return parsed as ZInfer<S>;
    if (attempt === max) break;

    raw = await opts.repair(raw, issues);
  }

  const lines = issues
    .slice(0, 40)
    .map((i) => `  ${i.path || "(root)"}: ${i.message}`)
    .join("\n");
  const more = issues.length > 40 ? `\n  …and ${issues.length - 40} more` : "";
  throw new Error(
    `${opts.label} failed after ${max} attempts. Outstanding issues:\n${lines}${more}`,
  );
}

function zodErrorToIssues(err: unknown): RepairIssue[] {
  if (err instanceof ZodError) {
    return err.issues.map((i) => ({
      path: i.path.map(String).join("."),
      message: i.message,
    }));
  }
  if (err instanceof Error && err.message.startsWith("Failed to parse JSON")) {
    return [{ path: "(json)", message: err.message }];
  }
  return [{ path: "(unknown)", message: String((err as Error)?.message ?? err) }];
}

// Helper for callers: build a focused fix-up user message. Includes the
// previous JSON (extracted from any fence) and a bulleted issue list.
export function buildRepairPrompt(
  previousRaw: string,
  issues: RepairIssue[],
  options: { maxIssues?: number } = {},
): string {
  const fenceMatch = previousRaw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const previousJson = fenceMatch ? (fenceMatch[1] ?? "") : previousRaw;
  const cap = options.maxIssues ?? 30;
  const list = issues
    .slice(0, cap)
    .map((i) => `- ${i.path || "(root)"}: ${i.message}`)
    .join("\n");
  const more =
    issues.length > cap ? `\n…and ${issues.length - cap} more — fix all of them` : "";
  return [
    "Your previous JSON did not validate. Return a corrected version that keeps the same content but fixes ONLY the issues listed below.",
    "",
    "Validation issues:",
    list + more,
    "",
    "Previous JSON:",
    "```json",
    previousJson,
    "```",
    "",
    "Return ONLY a single fenced JSON block (```json … ```) containing the full corrected output. No commentary, no apology, no partial output. Do not introduce new fields. Do not rename existing fields except to fix the listed issues.",
  ].join("\n");
}
