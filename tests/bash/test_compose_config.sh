#!/usr/bin/env bash
# Smoke test: verify docker-compose.yml parses, defines the expected
# services, and bind-mounts ./data into both. Doesn't require building
# the image — just `docker compose config`.

set -uo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd -- "$HERE/../.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "skip: docker not installed"
  exit 0
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "skip: docker compose plugin missing"
  exit 0
fi

PASSED=0
FAILED=0

check() {
  local label="$1" cond_rc="$2"
  if (( cond_rc == 0 )); then
    printf "  ✓ %s\n" "$label"
    PASSED=$((PASSED + 1))
  else
    printf "  ✗ %s\n" "$label"
    FAILED=$((FAILED + 1))
  fi
}

echo "docker-compose.yml"

# Use a stub MINIMAX_API_KEY so the env_file: .env doesn't fail on a fresh
# checkout. We render to a temp file and grep that.
config="$(MINIMAX_API_KEY=stub docker compose --project-name world-test config 2>/dev/null)"
rc=$?
check "compose config parses cleanly" "$rc"

echo "$config" | grep -qE '^\s*web:\s*$'
check "defines web service" $?

echo "$config" | grep -qE '^\s*tick:\s*$'
check "defines tick service" $?

echo "$config" | grep -qE 'target:[[:space:]]*3000'
check "web service exposes port 3000" $?

# Both services should bind ./data → /repo/world/data so the SQLite db is
# shared between the web reader and the tick writer. Compose v2 renders
# `target: /repo/world/data` once per service.
data_mounts=$(echo "$config" | grep -cE 'target:[[:space:]]*/repo/world/data' || true)
[[ "$data_mounts" -ge 2 ]]
check "both services bind-mount ./data into /repo/world/data" $?

echo
if (( FAILED == 0 )); then
  printf "%d/%d passed\n" "$PASSED" "$PASSED"
  exit 0
else
  printf "%d/%d FAILED\n" "$FAILED" "$((PASSED + FAILED))"
  exit 1
fi
