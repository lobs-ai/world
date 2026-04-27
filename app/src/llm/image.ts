// MiniMax image client. Generates images, downloads them (URLs from the API
// expire in 24h), persists to data/images/<hash>.png, and enforces a per-day
// budget so we don't burn through the daily quota in a runaway tick loop.
//
// Caching: identical prompt+params hash to the same path. Subsequent calls
// short-circuit. To force a re-render, pass `bypassCache: true`.
//
// Budget: data/image-budget.json tracks { date: "YYYY-MM-DD", count }.
// When today's count would exceed dailyBudget, generation is skipped and
// `null` is returned. Callers must handle null and fall back to a placeholder.

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

const API_URL = "https://api.minimax.io/v1/image_generation";
const DEFAULT_MODEL = "image-01";

export type AspectRatio =
  | "1:1"
  | "16:9"
  | "4:3"
  | "3:2"
  | "2:3"
  | "3:4"
  | "9:16"
  | "21:9";

export interface ImageRequest {
  prompt: string;
  aspectRatio?: AspectRatio;
  // Stable id for cache filename + dedup. Pass something semantic — the
  // character id, location id, entry id — instead of relying purely on
  // prompt hash. Helps when iterating on prompts for the same subject.
  subjectKey: string;
  // 1..9. Default 1. Multiple images cost more of the daily budget.
  n?: number;
  seed?: number;
  // Lets the API rewrite the prompt before generation. Default true — usually
  // improves results, can be turned off for exact-prompt experimentation.
  promptOptimizer?: boolean;
  bypassCache?: boolean;
}

export interface GeneratedImage {
  // Path on disk, relative to repo root, e.g. "data/images/<hash>.png".
  // Web app serves this via a static route or symlink.
  path: string;
  // SHA256(prompt + aspect + n + seed) — also the filename without ext.
  hash: string;
  // True if we read the file off disk; false if we hit the API.
  fromCache: boolean;
}

export interface BudgetState {
  date: string;
  count: number;
}

const BUDGET_FILE = "data/image-budget.json";
const IMAGES_DIR = "data/images";

// ── Public surface ──────────────────────────────────────────────────────────

export async function generateImage(
  req: ImageRequest,
  opts: { dailyBudget?: number } = {},
): Promise<GeneratedImage | null> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY is not set");
  }

  const aspect = req.aspectRatio ?? "1:1";
  const n = req.n ?? 1;
  const hash = hashRequest(req.subjectKey, req.prompt, aspect, n, req.seed);
  const imagesDir = resolve(repoRoot, IMAGES_DIR);
  const targetPath = join(imagesDir, `${hash}.png`);
  const relPath = `${IMAGES_DIR}/${hash}.png`;

  if (!req.bypassCache && existsSync(targetPath)) {
    return { path: relPath, hash, fromCache: true };
  }

  // Budget gate. Reads/writes are atomic enough for our single-process loop.
  const dailyBudget = opts.dailyBudget ?? 50;
  const budget = readBudget();
  const today = isoDate(new Date());
  if (budget.date !== today) {
    budget.date = today;
    budget.count = 0;
  }
  if (budget.count + n > dailyBudget) {
    console.error(
      `[image] daily budget reached (${budget.count}/${dailyBudget}); skipping "${req.subjectKey}"`,
    );
    return null;
  }

  mkdirSync(imagesDir, { recursive: true });

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      prompt: req.prompt.slice(0, 1500),
      aspect_ratio: aspect,
      response_format: "url",
      n,
      prompt_optimizer: req.promptOptimizer ?? true,
      ...(req.seed !== undefined ? { seed: req.seed } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MiniMax image API ${res.status}: ${body.slice(0, 400)}`);
  }

  const json = (await res.json()) as MinimaxResponse;
  if (json.base_resp && json.base_resp.status_code !== 0) {
    throw new Error(
      `MiniMax image API error ${json.base_resp.status_code}: ${json.base_resp.status_msg ?? ""}`,
    );
  }
  const url = json.data?.image_urls?.[0];
  if (!url) {
    throw new Error(
      `MiniMax image API returned no urls (success=${json.metadata?.success_count}, failed=${json.metadata?.failed_count})`,
    );
  }

  // The URL expires in 24h — download and persist immediately.
  const imgRes = await fetch(url);
  if (!imgRes.ok) {
    throw new Error(`download ${imgRes.status} fetching ${url}`);
  }
  const bytes = Buffer.from(await imgRes.arrayBuffer());
  await writeFile(targetPath, bytes);

  // Bump budget after a successful save.
  budget.count += n;
  writeBudget(budget);

  return { path: relPath, hash, fromCache: false };
}

// Build a prompt with a consistent style suffix. Callers compose the subject
// description; the suffix keeps every image in the chronicle's visual
// register so faces and places feel like one painter made them.
export function withStyle(subject: string, style: string): string {
  const trimmed = subject.trim().replace(/\.?$/, ".");
  return `${trimmed} ${style.trim()}`.trim();
}

// Read the budget without writing — useful for tooling and dashboards.
export function getBudgetState(dailyBudget = 50): {
  used: number;
  remaining: number;
  date: string;
} {
  const b = readBudget();
  const today = isoDate(new Date());
  const used = b.date === today ? b.count : 0;
  return { used, remaining: Math.max(0, dailyBudget - used), date: today };
}

// ── Internals ───────────────────────────────────────────────────────────────

interface MinimaxResponse {
  id?: string;
  data?: { image_urls?: string[] };
  metadata?: { failed_count?: string; success_count?: string };
  base_resp?: { status_code: number; status_msg?: string };
}

function hashRequest(
  subjectKey: string,
  prompt: string,
  aspect: string,
  n: number,
  seed: number | undefined,
): string {
  const h = createHash("sha256");
  h.update(subjectKey);
  h.update("\0");
  h.update(prompt);
  h.update("\0");
  h.update(aspect);
  h.update("\0");
  h.update(String(n));
  h.update("\0");
  h.update(seed === undefined ? "" : String(seed));
  return h.digest("hex").slice(0, 24);
}

function readBudget(): BudgetState {
  const path = resolve(repoRoot, BUDGET_FILE);
  if (!existsSync(path)) return { date: isoDate(new Date()), count: 0 };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<BudgetState>;
    return {
      date: typeof raw.date === "string" ? raw.date : isoDate(new Date()),
      count: typeof raw.count === "number" ? raw.count : 0,
    };
  } catch {
    return { date: isoDate(new Date()), count: 0 };
  }
}

function writeBudget(b: BudgetState): void {
  const path = resolve(repoRoot, BUDGET_FILE);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(b, null, 2));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
