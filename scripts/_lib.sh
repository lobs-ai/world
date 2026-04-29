#!/usr/bin/env bash
# Shared helpers for world scripts. Source this from each script.
#
# As of the dockerization, all heavy lifting (npm install, build, runtime)
# happens inside the world:latest image via docker compose. The scripts in
# this directory are thin wrappers around `docker compose ...` commands.

set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

color_red()    { printf "\033[31m%s\033[0m" "$1"; }
color_green()  { printf "\033[32m%s\033[0m" "$1"; }
color_yellow() { printf "\033[33m%s\033[0m" "$1"; }
color_blue()   { printf "\033[34m%s\033[0m" "$1"; }
color_dim()    { printf "\033[2m%s\033[0m" "$1"; }

step() { printf "%s %s\n" "$(color_blue "→")" "$1"; }
err()  { printf "%s %s\n" "$(color_red "✗")" "$1" >&2; }
ok()   { printf "%s %s\n" "$(color_green "✓")" "$1"; }

# Compose command. We run from world/ so the docker-compose.yml is found
# automatically. Project name pinned so containers/volumes are predictable.
COMPOSE=(docker compose --project-name world)

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    err "docker not found. Install Docker Desktop (https://docker.com)."
    exit 2
  fi
  if ! docker compose version >/dev/null 2>&1; then
    err "docker compose plugin not found. Update Docker Desktop."
    exit 2
  fi
  if ! docker info >/dev/null 2>&1; then
    err "docker daemon is not running. Start Docker Desktop."
    exit 2
  fi
}

# Make sure .env exists with a MINIMAX_API_KEY. Compose reads .env directly,
# so we only need to verify it's populated.
require_minimax_key() {
  if [[ ! -f "$ROOT/.env" ]]; then
    step "creating .env from .env.example"
    cp "$ROOT/.env.example" "$ROOT/.env"
    ok ".env created"
  fi
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  if [[ -z "${MINIMAX_API_KEY:-}" ]]; then
    err "MINIMAX_API_KEY is empty in .env."
    echo "  add MINIMAX_API_KEY=<your-key> to .env, then re-run."
    exit 2
  fi
}

# Build the image if it doesn't exist locally. Re-uses Docker's layer cache
# on subsequent calls; first build pulls node:20-bookworm-slim and installs
# all deps so it's slow once.
ensure_image_built() {
  if ! docker image inspect world:latest >/dev/null 2>&1; then
    step "building world:latest image (one-time, a few minutes)"
    "${COMPOSE[@]}" build
    ok "image built"
  fi
}

# Force a rebuild — used by ./scripts/setup after dependency changes.
rebuild_image() {
  step "rebuilding world:latest image"
  "${COMPOSE[@]}" build
  ok "image built"
}

# Run a one-shot command in a fresh container against the world:latest
# image. Mounts ./data so the SQLite db persists. Inherits .env.
# Usage: run_app_oneshot npm run --silent --workspace=app genesis -- "<premise>"
run_app_oneshot() {
  ensure_image_built
  "${COMPOSE[@]}" run --rm --no-deps \
    -e WORLD_DB=/repo/world/data/world.db \
    web "$@"
}

# Print compact list of worlds: tab-separated id, name, tick, premise.
list_worlds_compact() {
  run_app_oneshot npm --silent run dump --workspace=app 2>/dev/null
}

# Resolve a world id from $1, or auto-pick if exactly one exists,
# otherwise prompt with a numbered list.
resolve_world_id() {
  local arg="${1:-}"
  if [[ -n "$arg" ]]; then
    if ! is_world_id "$arg"; then
      err "not a valid world id: $arg"
      exit 2
    fi
    echo "$arg"
    return
  fi
  local worlds
  worlds="$(list_worlds_compact 2>/dev/null || true)"
  if [[ -z "$worlds" ]]; then
    err "no worlds yet. Run: ./scripts/genesis \"<premise>\""
    exit 2
  fi
  # The dump CLI emits one world per line (premise is collapsed). Filter
  # to lines that begin with a UUID to be defensive against any stray
  # output (warnings, log lines, etc.).
  local valid_lines
  valid_lines="$(echo "$worlds" \
    | grep -E '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b' || true)"
  if [[ -z "$valid_lines" ]]; then
    err "no worlds yet. Run: ./scripts/genesis \"<premise>\""
    exit 2
  fi
  local count
  count="$(echo "$valid_lines" | wc -l | tr -d ' ')"
  if [[ "$count" == "1" ]]; then
    echo "$valid_lines" | awk -F'\t' '{print $1}'
    return
  fi
  echo "Pick a world:" >&2
  local i=1
  while IFS=$'\t' read -r id name tick premise; do
    printf "  %d) %s  %s  %s  %s\n" "$i" "$(color_dim "$id")" "$name" "$tick" "$premise" >&2
    i=$((i+1))
  done <<< "$valid_lines"
  printf "> " >&2
  local choice
  read -r choice
  if ! [[ "$choice" =~ ^[0-9]+$ ]] || (( choice < 1 || choice > count )); then
    err "invalid choice: $choice"
    exit 2
  fi
  local picked
  picked="$(echo "$valid_lines" | sed -n "${choice}p" | awk -F'\t' '{print $1}')"
  if ! is_world_id "$picked"; then
    err "internal: picked id is not a UUID — refusing to continue"
    exit 2
  fi
  echo "$picked"
}

# Resolve the user's premise from CLI args. Supports:
#   parse_premise_args -f path/to/file
#   parse_premise_args --file path/to/file
#   parse_premise_args path/to/file               # bare path, auto-detected
#   parse_premise_args "literal premise text"
#   parse_premise_args                             # nothing → PREMISE empty
#
# Result is written to the PREMISE global. Returns:
#   0  on success (PREMISE set or empty)
#   2  on error (e.g. -f without a path, or path not found)
# A reason string is written to PREMISE_ERROR on error.
parse_premise_args() {
  PREMISE=""
  PREMISE_ERROR=""
  local file="" premise="" saw_double_dash=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -f|--file)
        if [[ $# -lt 2 ]]; then
          PREMISE_ERROR="$1 requires a path argument"
          return 2
        fi
        file="$2"
        shift 2
        ;;
      --)
        saw_double_dash=1
        shift
        premise="${premise:+$premise }$*"
        break
        ;;
      *)
        premise="${premise:+$premise }$1"
        shift
        ;;
    esac
  done

  # A bare positional that points at a real file is treated as -f, unless
  # the user explicitly disabled file detection with `--`.
  if (( ! saw_double_dash )) && [[ -z "$file" && -n "$premise" && -f "$premise" ]]; then
    file="$premise"
    premise=""
  fi

  if [[ -n "$file" ]]; then
    if [[ ! -f "$file" ]]; then
      PREMISE_ERROR="file not found: $file"
      return 2
    fi
    premise="$(cat "$file")"
  fi
  PREMISE="$premise"
  return 0
}

# Persist a key/value pair into .env, replacing the line if it exists.
# Refuses values that contain newlines so a buggy caller can't corrupt the
# file (one previous bug here baked a multi-line value into .env, which
# Docker's env-file parser then rejected on every subsequent run).
upsert_env() {
  local key="$1" value="$2"
  if [[ "$value" == *$'\n'* ]]; then
    err "upsert_env refuses multi-line value for $key"
    return 2
  fi
  if grep -q "^${key}=" "$ROOT/.env"; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ROOT/.env" && rm -f "$ROOT/.env.bak"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$ROOT/.env"
  fi
}

# True iff the string looks like a UUIDv4 (8-4-4-4-12 hex).
is_world_id() {
  [[ "$1" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]
}
