import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const cache = new Map<string, string>();

export function loadPrompt(name: string): string {
  const hit = cache.get(name);
  if (hit) return hit;
  const path = resolve(__dirname, `${name}.md`);
  const text = readFileSync(path, "utf8");
  cache.set(name, text);
  return text;
}
