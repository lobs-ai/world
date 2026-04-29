// Generic parse-with-repair loop for LLM JSON output.
//
// The model produces JSON; we validate (Zod schema + optional referential
// checks). On failure we collect the issues and either:
//   1. Targeted repair (preferred) — group issues by their owner fragment
//      (e.g. `characters[3]`, `plots[1]`), ask the model to fix only that
//      one fragment and return only the corrected fragment, then splice it
//      back into the working tree. Many small calls beat one huge re-emit.
//   2. Full re-prompt fallback — used when the JSON is unparseable or when
//      issues land at root-level paths we can't address as a fragment.
//
// Caller wires the model calls via `repairFragment` (preferred) and
// `repair` (fallback). The loop never speaks to the model directly.
//
// Two failure surfaces feed the same loop:
//   - Zod parse errors (shape, type, length, missing keys)
//   - Caller-supplied `extraIssues` (referential integrity, semantic rules)

import { ZodError, type ZodTypeAny, type infer as ZInfer } from "zod";
import { extractJson } from "./client.js";

export interface RepairIssue {
  path: string;
  message: string;
}

export interface FragmentRepair {
  // Container path of the fragment, e.g. "characters[3]" or "world".
  path: string;
  // Issues whose paths start at or under this container.
  issues: RepairIssue[];
  // Current value at the container path, lifted from the raw parsed JSON.
  value: unknown;
  // The whole raw root, in case the fragment-repairer needs sibling context
  // (e.g. valid id sets for fk repair).
  rawRoot: unknown;
}

export interface RepairOptions<S extends ZodTypeAny> {
  // Human-readable label for error messages and logs.
  label: string;
  schema: S;
  initialRaw: string;
  // Targeted repair. Returns a corrected value for the given fragment.
  // If omitted (or if the issue set can't be fragmented), the loop falls
  // back to `repair` for a full re-emit.
  repairFragment?: (frag: FragmentRepair) => Promise<unknown>;
  // Full-rewrite fallback. Always required.
  repair: (previousRaw: string, issues: RepairIssue[]) => Promise<string>;
  // Optional referential / semantic checks beyond schema shape.
  extraIssues?: (parsed: ZInfer<S>) => RepairIssue[];
  maxAttempts?: number;
  onAttempt?: (
    attempt: number,
    issues: RepairIssue[],
    accepted: boolean,
    mode: "fragment" | "full" | null,
  ) => void;
}

interface ValidationState<T> {
  parsed: T | null;
  rawJson: unknown;
  issues: RepairIssue[];
}

function validate<S extends ZodTypeAny>(
  raw: string | unknown,
  schema: S,
  extras?: (p: ZInfer<S>) => RepairIssue[],
): ValidationState<ZInfer<S>> {
  let rawJson: unknown;
  try {
    rawJson = typeof raw === "string" ? extractJson(raw) : raw;
  } catch (err) {
    return {
      parsed: null,
      rawJson: undefined,
      issues: [{ path: "(json)", message: (err as Error).message }],
    };
  }
  const result = schema.safeParse(rawJson);
  if (!result.success) {
    return { parsed: null, rawJson, issues: zodErrorToIssues(result.error) };
  }
  const issues = extras ? extras(result.data as ZInfer<S>) : [];
  return { parsed: result.data as ZInfer<S>, rawJson, issues };
}

export async function parseAndRepair<S extends ZodTypeAny>(
  opts: RepairOptions<S>,
): Promise<ZInfer<S>> {
  const max = opts.maxAttempts ?? 3;
  let raw = opts.initialRaw;
  let state = validate(raw, opts.schema, opts.extraIssues);

  for (let attempt = 1; attempt <= max; attempt++) {
    const ok = state.parsed !== null && state.issues.length === 0;
    if (opts.onAttempt) opts.onAttempt(attempt, state.issues, ok, null);
    if (ok) return state.parsed as ZInfer<S>;
    if (attempt === max) break;

    const groups =
      opts.repairFragment && state.rawJson !== undefined
        ? groupByContainer(state.issues, state.rawJson)
        : null;

    if (groups && groups.length > 0 && groups.every((g) => g.value !== undefined)) {
      // Targeted: repair each fragment in parallel and splice back.
      const root = state.rawJson;
      const updates = await Promise.all(
        groups.map(async (g) => ({
          path: g.path,
          value: await opts.repairFragment!({
            path: g.path,
            issues: g.issues,
            value: g.value,
            rawRoot: root,
          }),
        })),
      );
      for (const u of updates) setFragment(root, u.path, u.value);
      if (opts.onAttempt) {
        opts.onAttempt(attempt, state.issues, false, "fragment");
      }
      state = validate(root, opts.schema, opts.extraIssues);
    } else {
      // Fallback: full re-emit.
      if (opts.onAttempt) {
        opts.onAttempt(attempt, state.issues, false, "full");
      }
      raw = await opts.repair(raw, state.issues);
      state = validate(raw, opts.schema, opts.extraIssues);
    }
  }

  const lines = state.issues
    .slice(0, 40)
    .map((i) => `  ${i.path || "(root)"}: ${i.message}`)
    .join("\n");
  const more =
    state.issues.length > 40 ? `\n  …and ${state.issues.length - 40} more` : "";
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

// ── Path utilities ──────────────────────────────────────────────────────────

// Container path = the outermost `name[idx]` segment (canonicalized to
// bracket form), or top-level key if no array index appears. Issues at the
// same container are repaired together. Accepts both Zod's dot form
// (`characters.3.where`) and our manual bracket form (`characters[3].where`).
//
//   "characters[3].where"      → "characters[3]"
//   "characters.3.where"       → "characters[3]"
//   "plots[1].central[2]"      → "plots[1]"
//   "prophecies[0]"            → "prophecies[0]"
//   "world.themes"             → "world"
//   "world"                    → "world"
//   "(json)" / "(root)" / ""   → ""  (unaddressable; forces full repair)
export function containerPath(issuePath: string): string {
  const m = issuePath.match(/^([^.\[\]]+)(?:\[(\d+)\]|\.(\d+))/);
  if (m && m[1] !== undefined) {
    const idx = m[2] ?? m[3];
    return `${m[1]}[${idx}]`;
  }
  if (!issuePath || issuePath.startsWith("(")) return "";
  const dot = issuePath.indexOf(".");
  return dot === -1 ? issuePath : issuePath.slice(0, dot);
}

interface IssueGroup {
  path: string;
  issues: RepairIssue[];
  value: unknown;
}

function groupByContainer(issues: RepairIssue[], rawRoot: unknown): IssueGroup[] {
  const map = new Map<string, RepairIssue[]>();
  for (const issue of issues) {
    const c = containerPath(issue.path);
    if (!c) {
      // Unaddressable issue — bail out of fragment mode entirely.
      return [];
    }
    const existing = map.get(c);
    if (existing) existing.push(issue);
    else map.set(c, [issue]);
  }
  return Array.from(map, ([path, is]) => ({
    path,
    issues: is,
    value: getFragment(rawRoot, path),
  }));
}

function pathSegments(path: string): (string | number)[] {
  const out: (string | number)[] = [];
  const re = /([^.\[\]]+)|\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) {
    if (m[2] !== undefined) out.push(parseInt(m[2], 10));
    else if (m[1] !== undefined) out.push(m[1]);
  }
  return out;
}

function getFragment(obj: unknown, path: string): unknown {
  const segs = pathSegments(path);
  let cur: unknown = obj;
  for (const s of segs) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string | number, unknown>)[s as never];
  }
  return cur;
}

function setFragment(obj: unknown, path: string, value: unknown): void {
  const segs = pathSegments(path);
  if (segs.length === 0 || obj == null || typeof obj !== "object") return;
  let cur = obj as Record<string | number, unknown>;
  for (let i = 0; i < segs.length - 1; i++) {
    const next = cur[segs[i]! as never];
    if (next == null || typeof next !== "object") return;
    cur = next as Record<string | number, unknown>;
  }
  cur[segs[segs.length - 1]! as never] = value as never;
}

// ── Prompt builders ─────────────────────────────────────────────────────────

// Full-rewrite fix-up message. Used as fallback only.
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

// Targeted fragment fix-up message. The caller supplies a textual `context`
// blob — id lists, premise summary, etc. — so the model has what it needs to
// fix the fragment without seeing the rest of the world JSON.
export function buildFragmentRepairPrompt(args: {
  path: string;
  value: unknown;
  issues: RepairIssue[];
  context: string;
}): string {
  const list = args.issues
    .map((i) => `- ${i.path || args.path}: ${i.message}`)
    .join("\n");
  return [
    "A single fragment of a larger world failed validation. Return ONLY a corrected version of THAT fragment.",
    "",
    "Context:",
    args.context.trim(),
    "",
    `Fragment path: ${args.path}`,
    "",
    "Issues to fix:",
    list,
    "",
    "Current fragment value:",
    "```json",
    JSON.stringify(args.value, null, 2),
    "```",
    "",
    "Return ONLY a single fenced JSON block (```json … ```) containing the corrected fragment value (the same shape — object, array, string, etc. — as the current value). No commentary. Keep all fields that were not flagged. Fix only the listed issues. Do not introduce new fields. Do not return the surrounding world.",
  ].join("\n");
}
