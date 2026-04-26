#!/usr/bin/env bash
# Shared helpers for world scripts. Source this from each script.

set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

color_red()    { printf "\033[31m%s\033[0m" "$1"; }
color_green()  { printf "\033[32m%s\033[0m" "$1"; }
color_yellow() { printf "\033[33m%s\033[0m" "$1"; }
color_blue()   { printf "\033[34m%s\033[0m" "$1"; }
color_dim()    { printf "\033[2m%s\033[0m" "$1"; }

step() {
  printf "%s %s\n" "$(color_blue "→")" "$1"
}

err() {
  printf "%s %s\n" "$(color_red "✗")" "$1" >&2
}

ok() {
  printf "%s %s\n" "$(color_green "✓")" "$1"
}

# Load .env into the environment if present. We do not export by default —
# Node loads it itself via dotenv. But scripts that need MINIMAX_API_KEY
# pre-flight call this to fail fast before spawning Node.
load_env() {
  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi
}

require_minimax_key() {
  load_env
  if [[ -z "${MINIMAX_API_KEY:-}" ]]; then
    err "MINIMAX_API_KEY is not set."
    echo "  1. cp .env.example .env"
    echo "  2. add MINIMAX_API_KEY=… to .env"
    echo "  3. re-run this script"
    exit 2
  fi
}

require_node() {
  if ! command -v node >/dev/null 2>&1; then
    err "node not found. Install Node 20+."
    exit 2
  fi
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  if (( major < 20 )); then
    err "Node 20+ required. Found $(node -v)."
    exit 2
  fi
}

# Ensure the workspaces are installed. Idempotent: skips if node_modules
# exists *and* the @world/app symlink resolves.
ensure_install() {
  if [[ ! -d "$ROOT/node_modules" ]] || [[ ! -e "$ROOT/node_modules/@world/app" ]]; then
    step "installing dependencies (one-time)"
    npm install --silent
    ok "dependencies installed"
  fi
}

# Build the app workspace if dist/ is missing or stale relative to src/.
ensure_app_built() {
  if [[ ! -d "$ROOT/app/dist" ]]; then
    step "building app workspace"
    npm run build --workspace=app --silent
    ok "app built"
    return
  fi
  # Stale check: any .ts file newer than dist/index.js?
  local newest_src newest_dist
  newest_src="$(find "$ROOT/app/src" -name '*.ts' -type f -print0 | xargs -0 stat -f '%m' | sort -nr | head -1 || echo 0)"
  newest_dist="$(stat -f '%m' "$ROOT/app/dist/index.js" 2>/dev/null || echo 0)"
  if (( newest_src > newest_dist )); then
    step "rebuilding app workspace (sources changed)"
    npm run build --workspace=app --silent
    ok "app rebuilt"
  fi
}

# Print a compact list of worlds. Used by selectors when no id is given.
list_worlds_compact() {
  npm --silent run dump --workspace=app
}

# Resolve a world id from $1, or — if none given and exactly one world
# exists — auto-pick it. Otherwise prompt with a numbered list.
resolve_world_id() {
  local arg="${1:-}"
  if [[ -n "$arg" ]]; then
    echo "$arg"
    return
  fi
  local worlds
  worlds="$(list_worlds_compact 2>/dev/null || true)"
  if [[ -z "$worlds" ]]; then
    err "no worlds yet. Run: ./scripts/genesis \"<premise>\""
    exit 2
  fi
  local count
  count="$(echo "$worlds" | wc -l | tr -d ' ')"
  if [[ "$count" == "1" ]]; then
    echo "$worlds" | awk -F'\t' '{print $1}'
    return
  fi
  echo "Pick a world:" >&2
  local i=1
  while IFS=$'\t' read -r id name tick premise; do
    printf "  %d) %s  %s  %s  %s\n" "$i" "$(color_dim "$id")" "$name" "$tick" "$premise" >&2
    i=$((i+1))
  done <<< "$worlds"
  printf "> " >&2
  local choice
  read -r choice
  echo "$worlds" | sed -n "${choice}p" | awk -F'\t' '{print $1}'
}
