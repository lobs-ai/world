# Genesis — Atmospherics (stage 3 of 3)

You are filling out the wide population of a world. You will be given
the world's name, tone, themes, deep history, factions, locations,
principals, secondaries, plots, and prophecies.

You produce **15–25 atmospheric characters** — the named-but-rare folk
who make a chronicle feel populous: an innkeep with a cellar key, a
marsh-witch who knows what was buried at the crossroads, a steward who
has been at the keep since the regent was a girl, a caravan-master from
beyond the realm, an abbot whose hands shake when the bell rings, a
midwife whose silence has been bought twice, a courier who has kept a
letter sealed for nineteen years.

Atmospheric characters are **real people**. The chronicle is a world
sim — the reader watches, but the characters themselves act, scheme,
swear, lie, and remember. Each atmospheric you write must be someone
whose appearance in any future scene would carry weight: a name said
once, an action taken, a secret leaked.

## Output

Return one fenced JSON block:

```json
{
  "characters": [
    {
      "id": "<lowercase-snake-or-kebab id>",
      "name": "Old Erra",
      "epithet": "of the Bell & Buckle, who pours short for liars",
      "age": 71,
      "where": "<an inn or crossroads location id>",
      "weight": "atmospheric",
      "factionId": null,
      "portrait": "A woman with a stained apron and one walnut hand.",
      "summary": "Has kept the inn since before the king was crowned. Forgets nothing said in her hearing.",
      "mood": { "dominant": "patient", "valence": 0.0, "arousal": 0.2 },
      "desires": [
        { "goal": "to be buried under the apple tree behind the inn, not in the chapel", "intensity": 0.7 }
      ],
      "traits": { "watchful": 0.95, "discreet": 0.8 },
      "secrets": [
        "The grey rider stopped here three nights running. She washed his cloak. There was no blood.",
        "She has the seal of the old chancellor in a pewter cup, given for safe-keeping forty winters past."
      ]
    }
  ],
  "relationships": []
}
```

## Constraints

- 15–25 characters, **all** with `weight: "atmospheric"`.
- Spread across many locations: every inn, every road-side place, every
  fortress, every notable village or ruin should have at least one
  atmospheric anchored to it.
- Each character's `where` is a valid location id from the frame.
- `factionId` is usually `null`. A few atmospherics may belong to a
  faction (a junior monk, a marsh-cult novice).
- 1–2 desires each. **At least one secret each, and the secret must be
  specific, surprising, and consequential.** A secret is a thing that,
  if spoken aloud, would change the room.
- 1–2 traits each.
- Voice: no modern idioms. Each character's `epithet` is in the
  register of the world ("of the Bell & Buckle, who pours short for
  liars"), not modern ("the bartender").

`relationships` may be empty in this stage, or may include a few
edges that bind atmospherics to principals/secondaries (the steward who
has been at the keep since the regent was a girl naturally has a
relationship to her).

## What atmospheric depth looks like

- **The innkeep** has not just a name. She remembers who slept in the
  third room when the storm broke five winters ago, and she knows
  whose cloak was washed without blood.
- **The marsh-witch** does not "know magic." She knows where the bell
  is buried, and she is the only one alive who heard it ring.
- **The steward** is not "Margreth's servant." He has poured short for
  her four times in forty years, and remembers each.
- **The midwife** does not "deliver babies." She delivered the regent's
  daughter eleven years ago, took silver to keep silent, and still has
  the silver in a tin under her bed.

Each atmospheric character must give the chronicle something only they
can give. Otherwise they are not earning their place.

## What "boring" looks like

- "The innkeep — friendly, runs the inn." Wrong.
- "The midwife — afraid of the regent." Wrong.
- "The blacksmith — strong, dependable." Wrong.

If you cannot name what only this character can give, do not write them.

Return only the fenced JSON.
