// Stage cache for genesis. Each LLM stage costs 30–150s; we don't want a
// stage-3 failure to throw away a successful stage-1 frame. The cache writes
// each stage's parsed output to disk under data/genesis-cache/<runId>/. A
// retry with the same premise resumes from the last completed stage.
//
// Run id is a hash of the (trimmed) premise so the same premise consistently
// hits the same slot. The cache is cleared on full success — leftover dirs
// are evidence of a prior failure.

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

export function runIdFor(premise: string): string {
  return createHash("sha256").update(premise.trim()).digest("hex").slice(0, 12);
}

function cacheRoot(): string {
  return resolve(repoRoot, "data", "genesis-cache");
}

function dirFor(runId: string): string {
  return join(cacheRoot(), runId);
}

export interface StageCache {
  readonly runId: string;
  readonly dir: string;
  has(stage: string): boolean;
  read<T>(stage: string): T | null;
  write<T>(stage: string, value: T): void;
  clear(): void;
}

export function openStageCache(runId: string): StageCache {
  const base = dirFor(runId);
  return {
    runId,
    dir: base,
    has(stage) {
      return existsSync(join(base, `${stage}.json`));
    },
    read<T>(stage: string): T | null {
      const path = join(base, `${stage}.json`);
      if (!existsSync(path)) return null;
      return JSON.parse(readFileSync(path, "utf8")) as T;
    },
    write(stage, value) {
      mkdirSync(base, { recursive: true });
      writeFileSync(
        join(base, `${stage}.json`),
        JSON.stringify(value, null, 2),
      );
    },
    clear() {
      if (existsSync(base)) rmSync(base, { recursive: true, force: true });
    },
  };
}
