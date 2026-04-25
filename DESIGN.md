# DESIGN.md

The architectural specification for the persistent medieval-fantasy story world. Read `AGENTS.md` first for working norms. This document is the *what* and *why*; that one is the *how to work*.

---

## 1. Product

A user submits a starting premise — a single sentence or a paragraph. The system generates a full medieval fantasy world from it: geography, characters with rich inner lives, factions, history, ongoing plots. Then a tick loop runs continuously. Every tick advances the story: characters act, plots develop, the world changes. Each tick produces a chronicle entry — prose, written in a parchment-chronicle voice — appended to the public website.

Readers visit the site and find a living story. They can browse the map, click a character, read their journal, see the relationships, follow a plot from setup to payoff. They can subscribe by RSS or email and receive a daily digest. Once a week, the system writes a "Chapter" — a retrospective that reads like a chapter of a novel.

The product is **the chronicle**. Everything else is infrastructure for making the chronicle good.

---

## 2. Core principles

These principles drove every design decision below. When in doubt, return to them.

### 2.1 State is structured. Generation is constrained.

LLMs cannot freely edit the world. They propose **typed state changes** in JSON. A validator checks each one (does this character exist? is this location reachable? is this item in their inventory?) before it commits. This is the firewall against incoherence.

The output of any LLM call is a Pydantic model. No free-form world manipulation.

### 2.2 Plots are first-class objects with projected arcs.

A simulation without a director produces aimless wandering. Every plot in the world has:
- a state (seeded → setup → rising → climax → falling → resolved)
- a sequence of beats already played
- a *projected arc* — where the director thinks it's going

The director steers plots toward their projected arcs while letting characters' actions modify those arcs. This is what makes the chronicle feel like a story instead of a log.

### 2.3 Three agent roles, never merged.

- **Director** — picks what happens next. Sees the whole world. Outputs a structured plan.
- **Character** — acts within a scene. Sees only what they know. Outputs proposed state changes + dialogue.
- **Scribe** — renders the scene as prose. Sees the scene's structured output. Outputs chronicle text.

This separation lets us iterate on prose quality (scribe) independently of simulation quality (characters) independently of narrative quality (director). Merging them would couple concerns we need decoupled.

### 2.4 Knowledge is partitioned per character.

Characters know what they've witnessed, been told, or deduced. Not what's true in the world. The asymmetry is the engine of drama. A character agent's prompt contains only that character's beliefs, not world truths.

### 2.5 Emotion and action are separable, then coupled.

Inner state (mood, desires, beliefs) drives outer state (what they do). Character agents are required to produce a `thought` field that reasons from inner state to action *before* producing the action. This is what makes characters feel alive.

### 2.6 Memory is bounded and weighted.

Characters can't carry every event in their context. A consolidation pass each cycle keeps high-importance memories raw, summarizes mid-tier ones, and drops low-tier ones into a backstory delta. This is how characters end up with the *right* set of things in their head.

---

## 3. State model

All state lives in Postgres (SQLite in dev). Schemas are SQLAlchemy 2.0 models; LLM I/O wrappers around them are Pydantic 2 models.

### 3.1 World

```
World
  id: uuid
  current_tick: int
  current_date: str            # in-world: "Day 47, Year of the Owl"
  seed_premise: text           # the user's starting input
  setting_bible: jsonb         # generated once at genesis; read-only
  pinned_themes: text[]        # ["betrayal", "hidden lineage", "creeping dread"]
  tone: enum                   # grimdark | romantic | folkloric | tragic | whimsical | mythic
  status: enum                 # genesis_pending | running | paused | sealed
  created_at: timestamp
```

The `setting_bible` is the world's constitution. It contains:
- geography overview
- magic system rules (or absence thereof)
- recent history (last ~50 in-world years)
- factions and their goals
- cosmology (what gods exist? what's true about death?)
- *constraints* — things that are categorically not true in this world

It's generated once during genesis. It's injected into every director and scribe prompt. It is never modified. If the world needs to change in some fundamental way, that's a plot, not a bible edit.

### 3.2 Character

```
Character
  id: uuid
  world_id: fk
  name: str
  age: int
  location_id: fk

  appearance: text
  backstory: text             # mutable: backstory deltas append here

  # Personality — set at creation, drifts very slowly
  traits: jsonb               # {brave: 0.7, vengeful: 0.2, devout: 0.9, ...}
  values: text[]              # ["family above all", "honor"]
  speech_style: text

  # Inner state — changes constantly
  mood: jsonb                 # {valence: -0.3, arousal: 0.6, dominant_emotion: "grief"}
  desires: Desire[]           # ordered by intensity
  beliefs: Belief[]
  memories: Memory[]

  # Outer state
  inventory: Item[]
  faction_id: fk?

  # Director metadata
  narrative_weight: float     # 0..1; 1.0 = main character right now
  last_focal_tick: int        # for fairness in focal selection
  current_arc: CharacterArc?
  alive: bool                 # dead characters stay queryable but never act
```

### 3.3 Inner-life records

```
Belief
  proposition: str            # "the king is dying"
  confidence: float           # 0..1
  source: str                 # "overheard at the Bell & Buckle inn"
  acquired_tick: int
  superseded_by: id?          # if a later belief replaced this one

Desire
  goal: str                   # "find my missing sister"
  intensity: float            # 0..1
  origin_tick: int
  deadline_tick: int?
  blocked_by: str?
  satisfied_at_tick: int?

Memory
  tick: int
  summary: str                # one sentence
  full_text: str?             # set if importance > 0.7; otherwise null
  emotional_valence: float    # -1..1, signed
  importance: float           # 0..1
  participants: character_id[]
  location_id: fk
  consolidated: bool          # true if dropped from raw memory into backstory
```

### 3.4 Relationship

```
Relationship
  id: uuid
  from_character_id: fk
  to_character_id: fk
  type: enum                  # family | lover | friend | enemy | rival | mentor | acquaintance | stranger
  affection: float            # -1..1
  trust: float                # -1..1
  shared_memory_ids: int[]
  last_interaction_tick: int
```

Relationships are **asymmetric**. A loves B; B is indifferent. Two rows, not one. This is non-negotiable — the asymmetry is where drama lives.

### 3.5 Location

```
Location
  id: uuid
  world_id: fk
  name: str
  type: enum                  # capital | town | village | forest | road | ruin | dungeon | wilderness
  parent_id: fk?              # nested geography
  coordinates: jsonb?         # for the map
  description: text
  notable_features: text[]
  ambient_state: jsonb        # {weather, time_of_day, mood}
  current_residents: character_id[]   # cached; source of truth is character.location_id
  rumors: Rumor[]
```

```
Rumor
  id: uuid
  location_id: fk
  text: str
  truth_value: float          # 0..1; some rumors are accurate, some distorted
  origin_tick: int
  source_event_id: id?        # often points to a real plot beat
```

Rumors are how knowledge leaks across the social graph. They're generated by the propagation step, not by character agents directly.

### 3.6 Plot

The most important table.

```
Plot
  id: uuid
  world_id: fk
  title: str                  # "The Missing Prince"
  state: enum                 # seeded | setup | rising | climax | falling | resolved | abandoned
  beats: PlotBeat[]
  projected_arc: text         # the director's current sketch of where this is going
  central_character_ids: character_id[]
  themes: text[]
  tension: float              # 0..1
  last_advanced_tick: int
  parent_plot_id: fk?
  depends_on: plot_id[]
  reader_visible_hooks: text[]    # foreshadowed publicly
  hidden_truths: text[]           # only the director knows; payoff later
```

```
PlotBeat
  id: uuid
  plot_id: fk
  tick: int
  type: enum                  # setup | complication | reversal | revelation | quiet | payoff | resolution
  director_intent: str        # the sketch from the director's plan
  scene_summary: str          # what actually happened
  prose: text                 # chronicle entry text
  state_change_ids: id[]
```

The `projected_arc` field is updated by the director periodically — it can change as characters' actions modify the trajectory, but at any moment the director knows roughly where it's going. This is what stops the world from drifting.

### 3.7 StateChange

The atomic unit of world mutation.

```
StateChange
  id: uuid
  tick: int
  type: enum                  # MOVE | KILL | LEARN | FORGET | FORM_RELATIONSHIP | UPDATE_RELATIONSHIP | ACQUIRE | LOSE | EMOTION_SHIFT | DESIRE_FORM | DESIRE_SATISFY | DESIRE_FAIL | RUMOR_SPAWN | LOCATION_AMBIENT_SHIFT | FACTION_SHIFT | ARC_PROGRESS
  payload: jsonb              # type-specific
  proposed_by: enum           # director | character | propagation | decay
  source_character_id: fk?
  visibility: enum            # witnessed | local_rumor | regional_news | hidden
  validated: bool
  applied: bool
  rejection_reason: str?
```

Every state change is logged whether or not it applied. Rejected changes are debugging gold. Don't delete them.

### 3.8 Chronicle

```
ChronicleEntry
  id: uuid
  world_id: fk
  tick: int
  in_world_date: str
  prose: text
  scene_ids: id[]
  beat_ids: id[]
  ambient_text: str?          # "a storm rolled into the northern provinces"
  reader_facing: bool         # almost always true; false for debug ticks
```

```
Chapter
  id: uuid
  world_id: fk
  start_tick: int
  end_tick: int
  title: str
  prose: text                 # the weekly retrospective
  generated_at: timestamp
```

---

## 4. Agent architecture

Three roles. One module each. Distinct prompts in `/app/prompts/`.

### 4.1 The Director

**Runs once per tick, before any other agent.**

Inputs (constructed by `agents/director_context.py`):
- the setting bible
- all active plots with state, tension, beats so far, projected arc
- character roster with narrative weight and last_focal_tick
- the last ~10 chronicle entries
- the pinned themes
- world tick count and any director notes from prior ticks

Output (Pydantic model `DirectorPlan`):

```python
class DirectorPlan(BaseModel):
    focal_plot_ids: list[UUID]              # 1-3
    intended_beats: list[IntendedBeat]      # one per focal plot
    ambient_events: list[str]               # short, world-flavor; not character-driven
    plot_state_updates: list[PlotStateUpdate]  # advance/regress/abandon
    new_plot_seeds: list[NewPlotSeed]       # spawn new plots
    narrative_notes: str                    # passed back to itself next tick
    
class IntendedBeat(BaseModel):
    plot_id: UUID
    beat_type: BeatType                     # complication | reversal | etc.
    sketch: str                             # 1-3 sentences for character agents
    focal_character_ids: list[UUID]         # 1-4
    location_id: UUID
```

The director's prompt encodes story craft as explicit rules. From `prompts/director.md`:

- **Pacing**: don't advance the same plot two ticks in a row unless in climax state.
- **Cadence**: every 5-7 ticks, introduce a complication or new character.
- **Resolution windows**: plots in setup state should reach climax within 15-25 ticks.
- **Weaving**: when two plots' characters share a location, consider weaving — make the scene serve both.
- **Quiet scenes**: if 3 of the last 5 ticks were high-tension, write a quiet one.
- **Foreshadow**: every focal beat should drop one hint about something coming.
- **Promise/payoff**: track unpaid promises (foreshadowed events not yet delivered) and prioritize their payoff.
- **Fairness**: characters with high narrative_weight who haven't been focal in 10+ ticks are promoted.

Use Opus for this agent. Director quality dominates everything downstream. Spending more here pays for itself.

### 4.2 The Character Agent

**Runs once per focal character per scene, in turn order.**

Inputs (constructed by `agents/character_context.py`):
- the character's full profile (traits, values, mood, desires, beliefs, recent memories)
- their relationships with other characters in the scene
- their knowledge of the relevant plot — only their `beliefs`, not the truth
- the scene context: location description, who's present, time of day, weather
- the director's intended beat sketch
- the scene so far this tick (other characters' actions and dialogue, in order)

Output (Pydantic model `CharacterAction`):

```python
class CharacterAction(BaseModel):
    thought: str                            # required; reasons from inner state to action
    action: str                             # what they do, externally observable
    dialogue: str?                          # what they say, if anything
    proposed_changes: list[StateChangeProposal]
    emotion_shift: EmotionShift?
    new_beliefs: list[BeliefProposal]
    new_desires: list[DesireProposal]
```

The `thought` field is required and is **never rendered to the reader**. It's only for grounding the action. The scribe doesn't see it. This is deliberate — we want the chain of reasoning to exist for coherence, but the chronicle should show, not tell.

Scenes are multi-round: characters act in turn, each seeing what came before in this scene. Cap rounds at 3 unless the director's beat type calls for a longer scene (e.g. a confrontation). Each character can also pass — silence is an action.

Use Sonnet. Volume matters; speed and cost matter.

### 4.3 The Scribe

**Runs once per scene, after all character agents have acted.**

Inputs:
- the scene's structured record: beat sketch, location, characters present, ordered actions and dialogue, emotion shifts, environmental ambient
- the world's tone setting
- the recent chronicle entries (for voice continuity)

Output (Pydantic model `ChronicleProse`):

```python
class ChronicleProse(BaseModel):
    prose: str                              # the chronicle entry
    title: str?                             # optional scene title
    reader_facing_hooks: list[str]          # foreshadowing the scribe makes explicit
```

The scribe never decides events. It renders. Its prompt enforces voice — by default a parchment-chronicle voice (present tense, restrained adjectives, elegant), but modulated by the world's tone (grimdark gets sparser; folkloric gets warmer; mythic gets grander).

Voice rules in `prompts/scribe.md`:
- Present tense.
- Show, don't tell. The character's `thought` is not for you; observe their action.
- Dialogue rendered cleanly, em-dashes for interruptions.
- One paragraph per beat unless the beat is itself multi-part.
- No modern idioms. No anachronisms.
- Adjectives are rationed. One per noun, usually.
- Prefer concrete to abstract.

Use Sonnet. The scribe is iterated heavily; cheap calls win.

---

## 5. The tick loop

Defined in `world/tick.py`. Order is sacred.

```
def tick(world_id):
    with transaction():
        world = load(world_id)
        
        # 1. DIRECT
        plan = director_agent(world)
        log_plan(plan)
        
        # 2. ACT
        scenes = []
        for beat in plan.intended_beats:
            scene = run_scene(world, beat)         # multi-round character agents
            scenes.append(scene)
        
        # 3. RENDER
        for scene in scenes:
            scene.prose = scribe_agent(scene, world)
        
        # 4. VALIDATE
        all_changes = collect_proposed_changes(scenes, plan)
        validated = validate_changes(all_changes, world)
        rejected = all_changes - validated
        log_rejections(rejected)
        
        # 5. COMMIT
        apply_changes(validated, world)
        
        # 6. PROPAGATE
        propagate_knowledge(validated, world)      # rumors, witness updates
        
        # 7. DECAY
        decay_memories(world)
        drift_emotions(world)
        drift_relationships(world)
        
        # 8. CHRONICLE
        entry = compose_chronicle_entry(scenes, plan.ambient_events, world)
        append_chronicle(entry)
        
        # 9. RECONSIDER
        update_plot_states(world, scenes, plan)
        prune_resolved_plots(world)
        
        world.current_tick += 1
        save(world)
```

The whole tick is one transaction. If anything fails, the tick is aborted and the world is unchanged. Partial ticks corrupt the world.

### 5.1 Scene execution

```
def run_scene(world, beat):
    location = load(beat.location_id)
    characters = load_in_order(beat.focal_character_ids)
    scene = Scene(beat=beat, location=location)
    
    for round_num in range(MAX_SCENE_ROUNDS):
        any_action = False
        for char in characters:
            ctx = build_character_context(char, scene, world)
            action = character_agent(char, ctx)
            scene.append(action)
            if action.action != "PASS":
                any_action = True
        if not any_action:
            break
    
    return scene
```

`MAX_SCENE_ROUNDS = 3` for most beats, 5 for confrontations.

### 5.2 Knowledge propagation

The hardest correctness problem in the system.

For each validated state change with visibility scope:

- **Witnessed**: characters in the scene get a new memory + new belief about the change. Confidence 1.0.
- **Local rumor**: spawn a Rumor record at the scene's location with truth_value 0.7-1.0. On future ticks, the propagation step moves rumors to adjacent locations with truth_value decay (0.9× per hop) and possible mutation (small chance to flip a fact).
- **Regional news**: same as local rumor but propagates faster and farther via traveler/messenger NPCs (modeled abstractly — we don't simulate every messenger, we just advance rumor reach by N locations per tick).
- **Hidden**: nothing propagates. The director knows.

When a character is in a location with relevant rumors, they have a chance to acquire them as low-confidence beliefs (proportional to rumor truth_value × character's curiosity trait). This is what makes "did you hear about the prince?" feel real.

### 5.3 Memory decay

Each tick, for each character, run consolidation:

```
for memory in character.memories:
    if memory.consolidated: continue
    age = current_tick - memory.tick
    
    if memory.importance > 0.7:
        continue  # never consolidate
    elif memory.importance > 0.3 and age < 30:
        continue  # keep raw a while
    else:
        consolidate(memory, character)   # summarize into backstory delta, mark consolidated
```

Importance scoring (set when memory is created, by an LLM call inside the character agent's emotional response):

```
importance = clamp(
    abs(emotional_valence) * 0.4
    + relationship_change_magnitude * 0.3
    + belief_change_magnitude * 0.2
    + desire_change_magnitude * 0.1,
    0, 1
)
```

### 5.4 Emotion drift

Each tick, every character's mood drifts toward their baseline (set by traits) at a rate of ~15% per tick unless reinforced by a same-direction event. Compounding events (3+ negative events within 5 ticks) push past normal drift into named states: grief, rage, despair, joy, infatuation. These named states have explicit durations (grief: 20-50 ticks scaled by importance) and modify action selection while active.

Named states are first-class:

```
EmotionalState
  character_id: fk
  type: enum                  # grief | rage | despair | joy | infatuation | dread | elation
  origin_tick: int
  intensity: float            # 0..1
  expected_duration: int
  trigger_memory_ids: int[]
  resolved: bool
```

While in grief, a character's actions are subdued; while in rage, more reckless; etc. Encoded in the character agent's prompt with a section about the character's current named state.

### 5.5 Plot state machine

After each tick, the director runs a short reconsider pass that updates plot states:

- A plot moves seeded → setup when its first beat plays.
- setup → rising when tension exceeds 0.4 or 3 beats have played.
- rising → climax when tension exceeds 0.8 or by director fiat.
- climax → falling after a payoff beat.
- falling → resolved after a resolution beat or 3+ falling beats.
- Any plot that hasn't advanced in 30 ticks is reviewed: revive (new beat planned) or abandoned (logged, retired).

Resolved plots stay queryable forever. They're part of world history.

---

## 6. World genesis

Triggered when a user submits a premise. A pipeline, not a single LLM call.

```
def genesis(premise: str) -> World:
    # 1. Tone & themes — classify the premise
    tone, themes = classify_tone(premise)
    
    # 2. Setting bible — expand into geography, history, magic, factions
    bible = generate_setting_bible(premise, tone)
    
    # 3. Locations — generate ~20-40 places
    locations = generate_locations(bible)
    
    # 4. Characters — generate ~25-40 people
    characters = generate_characters(bible, locations)
    
    # 5. Relationships — seed the social graph
    relationships = generate_relationships(characters)
    
    # 6. Plots — seed 3-5 active plots in seeded state
    plots = generate_plots(bible, characters, themes)
    
    # 7. Validate — internal consistency check
    validate_world(bible, locations, characters, relationships, plots)
    
    # 8. Persist
    return commit_world(...)
```

Each step is its own LLM call with a tight Pydantic schema. The validate step catches contradictions (a character's dead parent listed as a current character; a plot referencing a location that doesn't exist). On failure, regenerate the offending step up to 3 times before failing the whole genesis.

Budget: ~30-90s of wall time, ~$0.50-2 in LLM cost. This is a one-time cost per world. Worth it.

---

## 7. Frontend

Next.js, server-rendered. Aesthetic: parchment, serif, hand-drawn map, illuminated-manuscript drop caps. Steal from Inkle (80 Days, Sorcery!) and Disco Elysium menus.

### 7.1 Pages

- `/` — landing. Premise input. Browse public worlds.
- `/world/[id]` — the chronicle, reverse-chronological. Map at top.
- `/world/[id]/map` — interactive map. Click locations.
- `/world/[id]/character/[charid]` — character page: portrait, current state (mood, desires), relationships, their memories, all chronicle entries they appear in.
- `/world/[id]/plot/[plotid]` — plot page: the arc so far, central characters, foreshadowed hooks (visible ones only).
- `/world/[id]/location/[locid]` — location page: who's there, recent events, current rumors.
- `/world/[id]/chapter/[n]` — the weekly retrospective.
- `/world/[id]/feed.xml` — RSS.

### 7.2 Reader interventions (week 4 feature)

Once per day, a reader can submit one of:
- a prophecy (text, attributed to a generated seer)
- a rumor (text, seeded into a chosen location)
- a stranger (a brief description; may or may not become a character)

These are queued. The director sees them in its next tick's context with a note that they're reader-submitted. It can use them or ignore them. This makes readers participants without giving them direct control.

---

## 8. Operational design

### 8.1 Tick cadence

- Default: 1 tick per 15 minutes of real time.
- 1 in-world day = 4 ticks.
- 1 in-world week = ~7 hours of real time. Tunable per world.

Worlds in `paused` state don't tick. Worlds in `sealed` state are read-only forever (preserved as artifact).

### 8.2 Cost

- Director: Opus, ~3-6k tokens per tick. ~$0.10-0.20 per tick.
- Character: Sonnet, ~1-2k tokens per character per round. ~$0.01-0.03 per character-round. With 3 characters × 2 rounds × 2 scenes = 12 invocations. ~$0.15-0.40 per tick.
- Scribe: Sonnet, ~1-3k tokens per scene. ~$0.02-0.05 per scene. 2 scenes ≈ $0.05-0.10 per tick.
- Propagation/decay: small Sonnet calls, batched. ~$0.05 per tick.

Estimated total: ~$0.40-0.80 per tick. At 4 ticks/hour, ~$1.60-3.20 per hour per world. ~$40-75 per day per running world.

This is the dominant operational concern. Caps live in `world/budget.py`. Each world has a daily token budget; ticks degrade gracefully (skip optional steps, smaller scenes) when approaching the cap.

### 8.3 Failure modes and recovery

- **Malformed LLM output**: the Pydantic parse fails. Retry the call up to 2 times with the validation error appended to the prompt. If still failing, skip that agent's contribution and log loudly.
- **Validator rejects all proposed changes**: log, write a quiet ambient chronicle entry, advance tick. The world doesn't crash because one scene failed.
- **Budget exhausted**: pause the world, send an alert. Don't drop ticks silently.
- **Database transaction fails mid-tick**: the whole tick rolls back. The chronicle has no gap because nothing was written.

### 8.4 Observability

- Every LLM call is logged with prompt, response, latency, cost, tick number.
- Every state change is logged whether applied or rejected.
- Every tick has a structured `TickReport` summarizing what happened.
- A web admin view (auth-gated) shows recent ticks, failed validations, cost burn rate.

---

## 9. Evals

Three eval types, all in `/evals/`.

### 9.1 Coherence evals

Synthetic worlds + 50-tick runs + automated checks:
- No dead characters speak.
- No character is in two places.
- No item is held by two characters.
- No relationship is contradictory in fact (A is B's father; B's character record lists a different father).
- No plot resolves without going through climax.
- No belief is held without a source.

Run nightly on a fresh seeded world. Failures block deploy.

### 9.2 Narrative quality evals

A frozen seed world runs 50 ticks. The chronicle is graded by an LLM judge against a rubric:

- **Pacing** (1-5): does tension rise and fall, or stay flat?
- **Foreshadowing** (1-5): do beats reference prior beats?
- **Character consistency** (1-5): do characters act consistently with their traits and prior actions?
- **Prose quality** (1-5): voice, restraint, vividness.
- **Plot coherence** (1-5): do plots make sense across their full arc?
- **Surprise** (1-5): are there reversals that feel earned?

Scores tracked over time. Any prompt change must report the eval delta.

### 9.3 Regression evals

A frozen seed world + frozen prompts + temperature 0 + a fixed model snapshot = deterministic output. Diff the chronicle against the golden output. Flag any drift.

This is not a quality measure — it's a tripwire for unintentional behavior changes.

---

## 10. Roadmap

### Phase 1 (week 1)
- State model + migrations.
- Tick loop scaffold (no agents yet — stub each role with a deterministic mock).
- Validator framework + first 5 state change types.
- Hand-seeded dev world.
- Smoke test: 20 ticks run without raising.

### Phase 2 (week 2)
- Real director, character, scribe agents.
- Scene execution with multi-round character actions.
- Knowledge propagation, memory decay, emotion drift.
- Coherence evals running.
- Output visibly improving over the week as the director prompt is iterated.

### Phase 3 (week 3)
- World genesis pipeline.
- Frontend: chronicle, character, plot, location pages.
- Map.
- Public deploy of one world. Read it daily; iterate.

### Phase 4 (week 4)
- Weekly chapter generation.
- RSS + email digest.
- Reader interventions.
- Polish, launch, share.

---

## 11. Things deliberately not in scope

- User accounts, billing, multi-world dashboards. Single hosted world for now.
- Generated imagery (character portraits, scene illustrations). Maybe later. Don't bloat.
- Voice/audio. No.
- Combat mechanics, stats, inventory crafting. This isn't a game. Outcomes are narrative, not mechanical.
- Player-controlled characters. Readers are readers, not players.
- Multiple languages. English first.

---

## 12. Open questions

To be resolved during implementation; flagged for the human:

1. **Genesis re-rolls**: should users see and approve the generated world before it goes live, or trust the pipeline?
2. **Public world catalog**: do all worlds appear publicly, or only ones marked public by their creator?
3. **Reader intervention limits**: per-user-per-day, or first-come-first-served per world?
4. **Permadeath**: should main characters be allowed to die mid-arc, or do we protect them?
5. **Multi-world identity**: do characters or factions ever cross worlds (multiverse), or is each world hermetic?

Default to the simpler answer in each case unless the human says otherwise.

---

## 13. The success criterion

A reader visits the site, lands on a chronicle entry, and can't stop reading. They subscribe. A week later they're emotionally invested in a fictional character whose name they didn't know existed seven days ago.

Every architectural decision in this document either serves that or it doesn't. When a future change comes up that doesn't clearly serve it, push back.
