# AGENTS.md

Operational contract for any AI coding agent working on this repository. Read this first, then read `DESIGN.md`, then start.

---

## What this project is

A persistent, agent-driven medieval fantasy world that reads like an unfolding story. A user submits a starting premise; the system generates a world (geography, characters, factions, plots), then runs a tick loop forever — a director agent picks what happens next, character agents act in scenes, a scribe agent renders the result as prose. The public website is the chronicle: readers visit and watch the story continue.

The hard problem is **long-horizon narrative coherence across many agents with bounded compute**. Every design decision should be evaluated against that.

Read `DESIGN.md` for the full architecture. This file is about *how to work in the repo*, not *what to build*.

---

## Prime directives

These are non-negotiable. Violating them will silently break the project.

1. **State is structured. Generation is constrained.** LLMs never freely edit the world. They propose typed state changes via JSON that pass through a validator before commit. If you find yourself writing a prompt that says "describe what happens next and update the world," stop — that's the wrong shape. The right shape is: structured input → structured output → validated transition → prose rendering.

2. **Plots are first-class objects with projected arcs.** Anything that looks like "let the simulation emerge organically" without a plot scaffold above it is wrong. The director steers; characters act within the steer.

3. **Three agent roles, three distinct prompts, three distinct contexts.** Director, Character, Scribe. Do not merge them. Do not let one do another's job. The scribe never decides events; the director never writes prose; the character never sees the whole world.

4. **Every LLM call gets only the slice of state it needs.** Never pass the whole world. Never pass another character's private beliefs into a character agent. Knowledge partitioning is what makes the world coherent and what makes characters feel like individuals.

5. **The chronicle is the user-facing artifact.** Every tick must produce one chronicle entry, even if it's a quiet one. The chronicle is the spine. If a change you're making would skip ticks or produce empty entries, you're breaking the experience.

---

## Repo layout

```
/app
  /src
    /agents     Director, Character, Scribe — one module each
    /world      State types, schemas (zod), validators, applier
    /genesis    Premise → seeded world (one LLM call, transactional commit)
    /db         SQLite schema + repository (better-sqlite3)
    /prompts    All system prompts as .md files, version-controlled
    /llm        Wrapper around @agentic/llm
    /cli        genesis / tick / loop / dump entry points
    tick.ts     The tick loop — one entry per file
/web            Next.js frontend (server components reading from SQLite)
/design         Original prototype handoff (HTML/JSX, reference only)
/data           SQLite database file (gitignored)
DESIGN.md
AGENTS.md
README.md
```

Keep this layout. Don't create a `utils/` dump. If something doesn't fit, propose a new top-level module in your PR description and explain why.

---

## Tech stack — fixed choices

Don't relitigate these without an explicit ask from the human.

- **Node 20+ / TypeScript** end-to-end. The repo is an npm workspace with two
  packages: `app/` (the engine) and `web/` (the chronicle frontend).
- **`@agentic/llm`** (file: dependency on `~/other/lobs/agentic`) for all LLM
  calls. Provider is **Minimax** (`minimax/MiniMax-M2.7` by default; see
  `.env.example`). API key in `MINIMAX_API_KEY`.
- **Zod** for all LLM I/O schemas. Every LLM output is parsed against a Zod
  schema before any state change touches the database.
- **better-sqlite3** for storage. Single-file SQLite DB at `data/world.db`.
  No ORM. Hand-rolled prepared statements in `app/src/db/index.ts`.
- **Next.js (App Router) + plain CSS** for the frontend. Server components
  read directly from SQLite. No heavy client state.
- **Tick loop** is a plain Node process (`npm run tick:loop <worldId>`).
  No Celery, no cron daemon, not yet.

---

## How to make changes

### Before you write code

1. Read `DESIGN.md`. The relevant section, at minimum.
2. Look at the existing module you're touching. Match its patterns.
3. If the change is non-trivial (new agent, new state field, new tick step), write a short plan in your PR description first: what's changing, what could break, what evals will catch regressions.

### While writing

- **Type everything.** No `Any`, no untyped dicts crossing module boundaries. State and LLM I/O are Pydantic models; internal APIs are typed.
- **Validate at the boundary.** Every state change from an LLM goes through `world/validators.py` before it touches the database. Adding a new state change type means adding a validator for it. No exceptions.
- **Prompts are code.** Live in `/app/prompts/*.md`. Edit them like code: small commits, clear messages, no drive-by rewording. When you change a prompt, run the eval suite (see below).
- **Don't add knobs.** If you find yourself adding a config flag to toggle behavior, you probably have two implementations fighting. Pick one.
- **No silent fallbacks.** If an LLM returns malformed JSON, fail loudly and log the raw output. Don't paper over it with a default.

### Database changes

- Always via Alembic migration. Never edit a model and hope.
- New columns: nullable + default first, backfill, then non-nullable in a second migration.
- Don't drop columns in the same release that stops using them. Two-phase.

### Adding a new agent role

Don't, unless the human has explicitly asked. The three-agent design is load-bearing. If you think you need a fourth, write a proposal in the PR description and stop.

### Adding a new state change type

This is the most common kind of change. The recipe:

1. Define the type in `app/src/world/types.ts` and add it to the `StateChange` union.
2. Add a Zod variant to the discriminated union in `app/src/world/schemas.ts`.
3. Add a validator branch in `app/src/world/validators.ts`.
4. Add an applier branch in `app/src/world/apply.ts`.
5. Update `app/src/prompts/character.md` to teach the agent when to propose it.

Skipping any of these will produce subtle world incoherence weeks later.

---

## The tick loop is sacred

The order of operations in `app/src/tick.ts` is:

```
direct → act → render → validate → commit → propagate → decay → chronicle
```

Don't reorder these. Don't merge steps. Don't let a later step write data that an earlier step depends on. The loop is a pipeline; treat it as one.

If a tick fails partway through, the entire tick rolls back. Partial ticks corrupt the world. The applier branch in `tick.ts` wraps the commit phase in a single SQLite transaction.

---

## Working with prompts

Prompts live in `app/src/prompts/`:

- `director.md` — narrative selection. The single most important file in the repo. Iterate carefully.
- `character.md` — desire-driven action with required `thought` field.
- `scribe.md` — voice and prose style.
- `genesis.md` — one-off prompt for world creation.

Rules:

- **Never edit a prompt without running the eval suite afterward.** Document the eval delta in your commit message.
- **Comment the *why* of each section** in the prompt with HTML comments `<!-- ... -->` so future-you understands what's load-bearing.
- **No "be a good storyteller" instructions.** Encode story craft as explicit rules: pacing, foreshadowing cadence, when to write quiet scenes. Vague instructions produce vague output.
- **The director prompt enforces taste.** If output quality drops, the fix is almost always in the director prompt, not the character prompts.

---

## Evals

Narrative quality is the product. We measure it.

The eval suite in `/evals/` contains:

- **Coherence evals**: synthetic worlds + 50 ticks, then automated checks (does anyone contradict themselves? does the geography stay consistent? do dead characters speak?).
- **Narrative quality evals**: snapshots of generated chronicles graded by an LLM judge against a rubric (rising tension, foreshadowing, character consistency, prose quality).
- **Regression evals**: a frozen seed world that runs deterministically given fixed prompts and a fixed model. Output diffs flag when a prompt change breaks something.

Run `make evals` before any PR that touches `/app/prompts/` or `/app/agents/`. Include the eval delta in the PR description. A regression in narrative quality is as serious as a regression in correctness.

---

## What "done" looks like

A change is done when:

- `npm run typecheck` passes for both `app/` and `web/`.
- A local dev world can run several ticks without raising or producing an
  invalid state (`npm run tick <worldId>` repeatedly, then `npm run dump <worldId>`).
- The change is reflected in `DESIGN.md` if it's architectural.
- The PR description explains the *why*, not just the *what*.

Don't merge "it compiles."

---

## Things that look reasonable but are wrong

A list of mistakes I expect you to almost make. Don't.

- **"Let the LLM decide what state changes happen."** No — it *proposes*; the validator *decides*.
- **"Pass the full chronicle into every prompt for context."** No — pass the last N entries scoped to relevance. Context windows are not the answer to narrative coherence; structured plot state is.
- **"Cache the generated prose."** Fine, but don't cache *agent decisions* — they depend on state that changes every tick.
- **"Use one big LLM call per tick instead of three."** No — separation of concerns is what makes prose quality independently iterable.
- **"Add a 'tone' parameter to every prompt."** No — tone lives in the world's setting bible, injected once.
- **"Make the director's plan free-form text and parse it later."** No — the director outputs strict JSON. Free-form plans drift.
- **"Skip the validator for trusted prompts."** No. There are no trusted prompts.

---

## Communication norms

- If you're uncertain about a design choice, **ask before implementing**, not after.
- If you find a bug in `DESIGN.md` while implementing, **fix the doc in the same PR** as the code.
- If you discover a new mistake worth warning future agents about, **add it to the "Things that look reasonable but are wrong" list above**.
- If a human asks for something that contradicts a prime directive, **flag the contradiction explicitly** before complying. The directives exist because violating them silently breaks the project.

---

## First task for a fresh agent

If you're a new agent dropped into this repo with no other context: read `DESIGN.md` end-to-end, then run `make smoke` against the seeded dev world and read the chronicle it produces. That's the product. Everything in the codebase serves making that chronicle better.
