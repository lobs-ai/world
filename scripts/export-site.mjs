#!/usr/bin/env node
// Snapshot the chronicle site as static files for GitHub Pages.
//
// Builds web/ with WORLD_BASE_PATH, runs the production server against
// data/world.db, crawls every page reachable from the landing page, and
// writes the HTML plus /_next/static assets and images to web/out/.
// Runs on the host, not in Docker: better-sqlite3 must match the active node.
//
// Usage:
//   node scripts/export-site.mjs                    # base path /world
//   WORLD_BASE_PATH=/other node scripts/export-site.mjs

import { spawn, execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(ROOT, "web");
const OUT = join(WEB, "out");
const BASE = process.env.WORLD_BASE_PATH ?? "/world";
const PORT = 3999;
const ORIGIN = `http://localhost:${PORT}`;
const env = { ...process.env, WORLD_BASE_PATH: BASE };

execFileSync("npm", ["run", "build", "--workspace=app"], { cwd: ROOT, env, stdio: "inherit" });
execFileSync("npm", ["run", "build", "--workspace=web"], { cwd: ROOT, env, stdio: "inherit" });

// cwd must be web/: the image route resolves data/ as ../data from it.
const server = spawn(join(ROOT, "node_modules/.bin/next"), ["start", "-p", String(PORT)], {
  cwd: WEB,
  env,
  stdio: "inherit",
});

try {
  await waitForServer(`${ORIGIN}${BASE}/`);
  rmSync(OUT, { recursive: true, force: true });
  const pages = await crawl();
  writePages(pages);
  // basePath only prefixes URLs; the files still live under _next/static.
  cpSync(join(WEB, ".next/static"), join(OUT, "_next/static"), { recursive: true });
  copyImages();
  // Without this, Jekyll drops the underscore-prefixed _next/ directory.
  writeFileSync(join(OUT, ".nojekyll"), "");
  console.log(`exported ${pages.size} pages to ${OUT}`);
} finally {
  server.kill();
}

async function waitForServer(url) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`server never answered at ${url}`);
}

// Breadth-first over every same-site href. Only rendered attributes are
// read: the RSC payload holds hrefs without the base path, which can't be
// told apart from base-prefixed ones when the base is /world.
async function crawl() {
  const linkRe = new RegExp(`href="${escapeRe(BASE)}(/[^"#]*)?["#]`, "g");
  const pages = new Map();
  const queue = ["/"];
  while (queue.length > 0) {
    const path = queue.shift();
    if (pages.has(path)) continue;
    const res = await fetch(`${ORIGIN}${BASE}${path}`);
    if (!res.ok) throw new Error(`${res.status} for ${BASE}${path}`);
    const html = await res.text();
    pages.set(path, html);
    for (const m of html.matchAll(linkRe)) {
      const link = (m[1] ?? "/").replaceAll("&amp;", "&");
      if (link.startsWith("/_next/") || link.startsWith("/api/")) continue;
      if (!pages.has(link)) queue.push(link);
    }
  }
  return pages;
}

// GitHub Pages ignores query strings, so /codex?kind=plot becomes
// /codex/kind/plot and every reference to it is rewritten to match.
function staticPath(path) {
  const [p, q] = path.split("?");
  return q ? `${p}/${q.replace(/[=&]/g, "/")}` : p;
}

function writePages(pages) {
  // Matching the unprefixed path rewrites both the base-prefixed href
  // attribute and the bare href in the RSC payload that Link hydrates from.
  const rewrites = [...pages.keys()]
    .filter((p) => p.includes("?"))
    .map((p) => [new RegExp(`${escapeRe(p)}(?=["\\\\])`, "g"), staticPath(p)]);
  const files = [...pages.keys()].map((p) => decodeURIComponent(staticPath(p)));
  for (const [path, raw] of pages) {
    let html = raw;
    for (const [re, to] of rewrites) html = html.replace(re, to);
    // Pages serves /a/b from a/b.html with no redirect. A page with child
    // pages needs a/b/index.html instead, since a/b/ is also a directory.
    const p = decodeURIComponent(staticPath(path));
    const hasChildren = p === "/" || files.some((f) => f.startsWith(`${p}/`));
    const file = hasChildren ? join(OUT, p, "index.html") : join(OUT, `${p}.html`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
  }
}

// Mirror the /api/img/<hash> route as plain files at the same URLs.
function copyImages() {
  const src = join(ROOT, "data/images");
  const dst = join(OUT, "api/img");
  mkdirSync(dst, { recursive: true });
  for (const f of readdirSync(src)) {
    if (f.endsWith(".png")) cpSync(join(src, f), join(dst, f.slice(0, -4)));
  }
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
