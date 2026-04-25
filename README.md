# world

A persistent, agent-driven medieval fantasy world that reads like an unfolding story.

You give it a premise. It builds a world — geography, characters, factions, plots — then runs forever. A director agent decides what happens next. Character agents act in scenes, each one seeing only what they know. A scribe renders the result as parchment-chronicle prose. The site is the chronicle: readers visit and watch the story continue.

## The shape of it

Three agents, three jobs, three contexts:

- **Director** — sees the whole world, picks what happens next, outputs a structured plan.
- **Character** — sees only what they've witnessed or been told, acts on desire, outputs typed state changes plus dialogue.
- **Scribe** — sees the scene's structured output, writes the prose.

State is structured; generation is constrained. LLMs never freely edit the world — they propose typed changes that pass through a validator before commit. Plots are first-class objects with projected arcs, so the world has somewhere to go. Knowledge is partitioned per character, because asymmetric belief is where drama lives.

Every tick produces one chronicle entry. The chronicle is the product.

## Stack

- Python 3.11+, FastAPI, SQLAlchemy 2.0 + Alembic, Pydantic v2
- Postgres in production, SQLite for local dev
- Anthropic SDK — Sonnet for character + scribe, Opus for director and weekly chapter
- Next.js (App Router) + Tailwind for the frontend
- APScheduler for the tick loop

## Status

Pre-implementation. The repo currently contains the design and the working contract; code lands next.

## Read next

- [`DESIGN.md`](./DESIGN.md) — architecture, state model, tick loop, evals.
- [`AGENTS.md`](./AGENTS.md) — operational contract for anyone (human or agent) writing code here. Read before opening a PR.
