#!/usr/bin/env bash
# Tests for the parse_premise_args function in scripts/_lib.sh.
#
# Each `it` block runs the function with a controlled set of args, asserts
# on the resulting PREMISE / PREMISE_ERROR / return code, and reports
# pass/fail. The runner exits non-zero if any test fails.

set -uo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd -- "$HERE/../.." && pwd)"

# shellcheck disable=SC1091
source "$ROOT/scripts/_lib.sh"

# _lib.sh enables `set -e`; we want individual tests to be allowed to call
# functions that return non-zero (e.g. when verifying error paths).
set +e

# --- tiny test harness ----------------------------------------------------
TESTS_RUN=0
TESTS_FAILED=0
CURRENT_TEST=""

it() {
  CURRENT_TEST="$1"
  TESTS_RUN=$((TESTS_RUN + 1))
}

fail() {
  TESTS_FAILED=$((TESTS_FAILED + 1))
  printf "  ✗ %s\n     %s\n" "$CURRENT_TEST" "$1"
}

pass() { printf "  ✓ %s\n" "$CURRENT_TEST"; }

assert_eq() {
  local expected="$1" actual="$2" label="${3:-value}"
  if [[ "$expected" == "$actual" ]]; then return 0; fi
  fail "$label: expected [$expected], got [$actual]"
  return 1
}

assert_rc() {
  local expected="$1" actual="$2"
  if [[ "$expected" == "$actual" ]]; then return 0; fi
  fail "exit code: expected $expected, got $actual"
  return 1
}

# Always create a temp dir for file-based tests; clean up at exit.
TMPDIR_TEST="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_TEST"' EXIT
PREMISE_FILE="$TMPDIR_TEST/premise.txt"
printf "A premise from a file.\n" > "$PREMISE_FILE"

PREMISE_FILE_MULTILINE="$TMPDIR_TEST/multi.txt"
{ printf "Line one.\n"; printf "Line two.\n"; } > "$PREMISE_FILE_MULTILINE"

# --- tests ---------------------------------------------------------------

echo "parse_premise_args"

it "empty argv → empty premise, no error"
  parse_premise_args
  rc=$?
  assert_rc 0 "$rc" \
    && assert_eq "" "$PREMISE" "PREMISE" \
    && assert_eq "" "$PREMISE_ERROR" "PREMISE_ERROR" \
    && pass

it "single literal arg → returned verbatim"
  parse_premise_args "A literal premise."
  rc=$?
  assert_rc 0 "$rc" \
    && assert_eq "A literal premise." "$PREMISE" "PREMISE" \
    && pass

it "multiple positional args → joined with single spaces"
  parse_premise_args one two three
  rc=$?
  assert_rc 0 "$rc" \
    && assert_eq "one two three" "$PREMISE" "PREMISE" \
    && pass

it "-f <path> → file contents"
  parse_premise_args -f "$PREMISE_FILE"
  rc=$?
  assert_rc 0 "$rc" \
    && assert_eq "A premise from a file." "$PREMISE" "PREMISE" \
    && pass

it "--file <path> → file contents"
  parse_premise_args --file "$PREMISE_FILE"
  rc=$?
  assert_rc 0 "$rc" \
    && assert_eq "A premise from a file." "$PREMISE" "PREMISE" \
    && pass

it "bare path argument → auto-detected as file"
  parse_premise_args "$PREMISE_FILE"
  rc=$?
  assert_rc 0 "$rc" \
    && assert_eq "A premise from a file." "$PREMISE" "PREMISE" \
    && pass

it "multi-line file → preserves newline"
  parse_premise_args -f "$PREMISE_FILE_MULTILINE"
  rc=$?
  expected=$'Line one.\nLine two.'
  assert_rc 0 "$rc" \
    && assert_eq "$expected" "$PREMISE" "PREMISE" \
    && pass

it "-f without a value → error and rc=2"
  parse_premise_args -f
  rc=$?
  assert_rc 2 "$rc" \
    && assert_eq "-f requires a path argument" "$PREMISE_ERROR" "PREMISE_ERROR" \
    && pass

it "--file pointing at nonexistent path → error and rc=2"
  parse_premise_args --file /no/such/path/here-$$.txt
  rc=$?
  assert_rc 2 "$rc" \
    && pass_check=$([[ "$PREMISE_ERROR" == "file not found:"* ]] && echo y) \
    && assert_eq "y" "$pass_check" "error message prefix" \
    && pass

it "-- separator → everything after is literal text"
  parse_premise_args -- "$PREMISE_FILE"
  rc=$?
  # After --, the path-looking arg is treated as literal text rather than file.
  assert_rc 0 "$rc" \
    && assert_eq "$PREMISE_FILE" "$PREMISE" "PREMISE" \
    && pass

it "literal text that happens not to exist as a path"
  parse_premise_args "This is not a file path."
  rc=$?
  assert_rc 0 "$rc" \
    && assert_eq "This is not a file path." "$PREMISE" "PREMISE" \
    && pass

# --- is_world_id --------------------------------------------------------

echo
echo "is_world_id"

it "accepts a canonical UUID"
  is_world_id "b065dc81-0491-46fa-a1b2-4e1f4daa28de"
  rc=$?
  assert_rc 0 "$rc" && pass

it "rejects an empty string"
  is_world_id ""
  rc=$?
  assert_rc 1 "$rc" && pass

it "rejects a UUID with extra trailing text"
  is_world_id "b065dc81-0491-46fa-a1b2-4e1f4daa28de extra"
  rc=$?
  assert_rc 1 "$rc" && pass

it "rejects multi-line input"
  is_world_id $'b065dc81-0491-46fa-a1b2-4e1f4daa28de\nThe world is...'
  rc=$?
  assert_rc 1 "$rc" && pass

it "rejects free-form text"
  is_world_id "The world is currently enduring"
  rc=$?
  assert_rc 1 "$rc" && pass

# --- upsert_env ---------------------------------------------------------

echo
echo "upsert_env"

# Operate on a sandboxed .env so we don't touch the real one. _lib.sh's
# upsert_env writes to "$ROOT/.env"; we redirect ROOT for this block.
ORIG_ROOT="$ROOT"
SANDBOX_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_TEST" "$SANDBOX_ROOT"' EXIT
ROOT="$SANDBOX_ROOT"
printf 'EXISTING=old\n' > "$ROOT/.env"

it "replaces an existing key in place"
  upsert_env EXISTING new
  rc=$?
  got="$(grep '^EXISTING=' "$ROOT/.env")"
  assert_rc 0 "$rc" \
    && assert_eq "EXISTING=new" "$got" "rewritten line" \
    && pass

it "appends a new key when not present"
  upsert_env FRESH "value-1"
  rc=$?
  got="$(grep '^FRESH=' "$ROOT/.env")"
  assert_rc 0 "$rc" \
    && assert_eq "FRESH=value-1" "$got" "appended line" \
    && pass

it "refuses a multi-line value (defends against the .env-corruption bug)"
  upsert_env BAD $'line1\nline2'
  rc=$?
  has_bad="$(grep -c '^BAD=' "$ROOT/.env" || true)"
  assert_rc 2 "$rc" \
    && assert_eq "0" "$has_bad" "BAD must not be written" \
    && pass

ROOT="$ORIG_ROOT"

# --- summary -------------------------------------------------------------
echo
if (( TESTS_FAILED == 0 )); then
  printf "%d/%d passed\n" "$TESTS_RUN" "$TESTS_RUN"
  exit 0
else
  printf "%d/%d FAILED\n" "$TESTS_FAILED" "$TESTS_RUN"
  exit 1
fi
