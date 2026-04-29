# Build context is the parent directory (lobs/) so we can include the
# sibling workspace ../agentic/packages/llm referenced by file:.. in
# world/app/package.json.

ARG NODE_IMAGE=node:20-bookworm-slim

# ── builder ────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS builder

# better-sqlite3 needs a C++ toolchain when no prebuilt binary matches.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

# Sibling package referenced via file:../../agentic/packages/llm. We need
# its package.json *and* its prebuilt dist/, plus its runtime deps. On the
# host these resolve via agentic/node_modules (a separate monorepo). In
# Docker we copy the package and install its deps locally so node module
# resolution finds them from /repo/agentic/packages/llm/node_modules.
COPY agentic/packages/llm/package.json /repo/agentic/packages/llm/package.json
COPY agentic/packages/llm/dist         /repo/agentic/packages/llm/dist
RUN --mount=type=cache,target=/root/.npm \
    cd /repo/agentic/packages/llm \
 && npm install --omit=dev --no-package-lock --silent --prefer-offline

# Workspace manifests first — better cache hits when only source changes.
COPY world/package.json     /repo/world/package.json
COPY world/package-lock.json /repo/world/package-lock.json
COPY world/app/package.json /repo/world/app/package.json
COPY world/web/package.json /repo/world/web/package.json

WORKDIR /repo/world
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --fetch-retries=5 --fetch-retry-mintimeout=10000

# Now bring in source and build both workspaces. Use absolute destination
# paths so relative-to-WORKDIR resolution can't bite us.
COPY world/app /repo/world/app
COPY world/web /repo/world/web
RUN npm run build --workspace=app \
 && npm run build --workspace=web

# ── runtime ────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime

ENV NODE_ENV=production
WORKDIR /repo/world

COPY --from=builder /repo/agentic/packages/llm   /repo/agentic/packages/llm
COPY --from=builder /repo/world/node_modules     /repo/world/node_modules
COPY --from=builder /repo/world/app              /repo/world/app
COPY --from=builder /repo/world/web              /repo/world/web
COPY --from=builder /repo/world/package.json     /repo/world/package.json
COPY --from=builder /repo/world/package-lock.json /repo/world/package-lock.json

EXPOSE 3000

# Default entry: the Next.js production server. Compose overrides `command`
# for the tick service.
CMD ["npm", "run", "--silent", "--workspace=web", "start"]
