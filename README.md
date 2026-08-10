# world

A persistent, agent-driven medieval fantasy world that reads like an unfolding story.

You give it a premise. It builds a world — geography, characters, factions, plots — then runs. A director agent decides what happens next. Character agents act in scenes, each one seeing only what they know. A scribe renders the result as parchment-chronicle prose. The site is the chronicle: readers visit and watch the story continue.

## The shape of it

Three agents, three jobs, three contexts:

- **Director** — sees the whole world, picks what happens next, outputs a structured plan.
- **Character** — sees only what they've witnessed or been told, acts on desire, outputs typed state changes plus dialogue.
- **Scribe** — sees the scene's structured output, writes the prose.

State is structured; generation is constrained. LLMs never freely edit the world — they propose typed changes that pass through a validator before commit. Plots are first-class objects with projected arcs, so the world has somewhere to go. Knowledge is partitioned per character, because asymmetric belief is where drama lives.

Every tick produces one chronicle entry. The chronicle is the product.

## Stack

- Node 20+ / TypeScript, npm workspaces (`app/` engine, `web/` frontend)
- `@agentic/llm` (Minimax provider) for all LLM calls
- Zod for schema-validated LLM I/O
- `better-sqlite3` for storage (single-file SQLite at `data/world.db`)
- Next.js (App Router) for the manuscript-aesthetic frontend, server-rendered

## Quickstart

`app` depends on `@agentic/llm` by relative path, so
[`agentic`](https://github.com/lobs-ai/agentic) must be checked out **beside**
this repo and its `llm` package built once:

```bash
git clone https://github.com/lobs-ai/agentic.git   # sibling of world/
(cd agentic/packages/llm && npm install && npx tsc)
```

Then:

```bash
# 1. install — workspaces hoist to repo root
npm install

# 2. configure
cp .env.example .env            # then put MINIMAX_API_KEY=… in there

# 3. seed a world
npm run genesis "A kingdom where the king has been dying for forty years."

# (prints the world id; copy it)

# 4. run a tick
npm run tick <worldId>

# 5. or run the loop (every 15 minutes by default; override WORLD_TICK_INTERVAL_SECONDS)
npm run dev:tick <worldId>

# 6. read the chronicle
npm run dev:web                 # then open http://localhost:3000
```

A few helpful side commands:

```bash
npm run dump                    # list all worlds
npm run dump <worldId>          # dump the chronicle as markdown to stdout
```

### Running without an API key

`seed:demo` writes a complete hand-authored world (Vespera — the premise in
[`examples/`](./examples/vespera.txt)) straight into the database: locations,
factions, cast, plots, prophecies and four chronicle entries. Nothing is
generated and no model is called, so the whole web surface can be run, reviewed
and screenshotted for free.

```bash
npm run seed:demo               # --force to replace an existing demo world
npm run dev:web                 # http://localhost:3000/world/vespera-demo
```

It is a fixture, not a substitute for `genesis` + `tick`.

## Status

The engine and frontend are wired end-to-end. Genesis seeds a world, the tick
loop produces chronicle entries, and the Next.js site reads from the same
SQLite file. The map screen is a placeholder gazetteer (the painted-map
treatment from the prototype handoff is not yet ported).

## Read next

- [`DESIGN.md`](./DESIGN.md) — architecture, state model, tick loop, evals.
- [`AGENTS.md`](./AGENTS.md) — operational contract for anyone (human or agent) writing code here. Read before opening a PR.
- [`design/`](./design/) — the original prototype handoff (HTML/JSX). Reference for the visual system.

## License

MIT — see [LICENSE](./LICENSE).
