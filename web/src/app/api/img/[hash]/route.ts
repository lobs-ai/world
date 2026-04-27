// Serves generated images from data/images/<hash>.png to the browser.
// Hashes are 24 hex chars (sha256 truncated). Anything else is rejected
// to keep this from acting as a directory traversal vector.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const HASH_RE = /^[a-f0-9]{12,64}$/;

// data/ lives at the repo root, two levels above the web workspace.
const repoRoot = resolve(process.cwd(), "..");

export async function GET(
  _req: Request,
  { params }: { params: { hash: string } },
) {
  if (!HASH_RE.test(params.hash)) {
    return new Response("not found", { status: 404 });
  }
  const path = resolve(repoRoot, "data", "images", `${params.hash}.png`);
  if (!path.startsWith(resolve(repoRoot, "data", "images") + "/")) {
    return new Response("forbidden", { status: 403 });
  }
  if (!existsSync(path)) {
    return new Response("not found", { status: 404 });
  }
  const bytes = readFileSync(path);
  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": "image/png",
      // Hashed filename → cache forever.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
