// WORLD_BASE_PATH is set only by scripts/export-site.mjs, which snapshots
// the site for GitHub Pages under /<repo>/ instead of the domain root.
// `env` inlines it so client code (image URLs) can prefix it too.
const basePath = process.env.WORLD_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  env: { WORLD_BASE_PATH: basePath },
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

module.exports = nextConfig;
