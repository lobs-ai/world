import { readFileSync, existsSync, statSync } from "node:fs";

export type ParseResult =
  | { kind: "ok"; premise: string; fresh: boolean }
  | { kind: "empty"; fresh: boolean }
  | { kind: "error"; message: string };

export interface ParseOptions {
  /** File-existence test. Override in tests to avoid touching the disk. */
  isFile?: (path: string) => boolean;
  /** File-read function. Override in tests. */
  readFile?: (path: string) => string;
}

const defaultIsFile = (p: string): boolean => {
  try {
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
};
const defaultReadFile = (p: string): string => readFileSync(p, "utf8");

/**
 * Parse the genesis CLI's positional + flag arguments into a resolved premise.
 *
 * Accepts (in priority order):
 *   - `-f <path>` / `--file <path>`
 *   - `--premise <text>`
 *   - a single positional that is either literal text OR a path to a file
 *
 * `--fresh` is recognized regardless of position.
 */
export function parsePremiseArgs(argv: string[], opts: ParseOptions = {}): ParseResult {
  const isFile = opts.isFile ?? defaultIsFile;
  const readFile = opts.readFile ?? defaultReadFile;

  const fresh = argv.includes("--fresh");
  const filePath = flagValue(argv, "-f", "--file");
  const premiseFlag = flagValue(argv, "--premise");

  const positional = argv.filter((a, i) => {
    if (a.startsWith("-")) return false;
    const prev = argv[i - 1];
    return prev !== "-f" && prev !== "--file" && prev !== "--premise";
  });

  if (filePath !== null) {
    if (!isFile(filePath)) {
      return { kind: "error", message: `file not found: ${filePath}` };
    }
    return { kind: "ok", premise: readFile(filePath).trim(), fresh };
  }
  if (premiseFlag !== null) {
    return { kind: "ok", premise: premiseFlag, fresh };
  }
  if (positional.length === 1) {
    const arg = positional[0]!;
    const text = isFile(arg) ? readFile(arg).trim() : arg;
    return { kind: "ok", premise: text, fresh };
  }
  if (positional.length > 1) {
    return {
      kind: "error",
      message: `expected a single premise argument; got ${positional.length}`,
    };
  }
  return { kind: "empty", fresh };
}

function flagValue(args: string[], ...names: string[]): string | null {
  for (const name of names) {
    const idx = args.indexOf(name);
    if (idx >= 0) return args[idx + 1] ?? null;
  }
  return null;
}
