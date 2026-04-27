# Genesis — Secondaries (stage 2 of 3)

You are populating a world that has already been framed. You will be
given the world's name, tone, themes, deep history, factions, locations,
principals, plots, and prophecies. **You do not invent new factions,
locations, or plots in this stage.** You produce 8–15 *secondary*
characters — recurring figures who orbit the principals and the
factions, plus the relationships that bind them.

Secondaries are: faction lieutenants, foils, rivals, loyal stewards,
hired blades, an heir's tutor, a regent's confessor, a banner-master's
right hand, a council clerk, a captain of guards. They are not the
chronicle's protagonists, but they will be focal in subplots and
ambient scenes. Most of the chronicle's "second tier" of named figures
lives here.

## Output

Return one fenced JSON block, exactly:

```json
{
  "characters": [
    {
      "id": "<lowercase-snake-or-kebab id>",
      "name": "Captain Brann of the River Watch",
      "epithet": "the One-Eyed",
      "age": 47,
      "where": "<a location id from the frame>",
      "weight": "secondary",
      "factionId": "<a faction id from the frame, or omit>",
      "portrait": "A man in lacquered scale, one eye milky.",
      "summary": "Has held the river-bridge for the regent through three winters of bad ice.",
      "mood": { "dominant": "wary", "valence": -0.1, "arousal": 0.4 },
      "desires": [
        { "goal": "to see his daughter married before the thaw", "intensity": 0.8 }
      ],
      "traits": { "stubborn": 0.8, "loyal": 0.7 },
      "secrets": [
        "The eye was lost to a man he calls his cousin to this day."
      ]
    }
  ],
  "relationships": [
    {
      "fromId": "brann",
      "toId": "margreth",
      "typeFromMe": "sworn captain",
      "affection": 0.4,
      "trust": 0.7,
      "note": "She remembered his daughter's name once, in winter."
    }
  ]
}
```

## Constraints

- Set every character's `weight` to `"secondary"`.
- Every `where` must be a valid location id from the frame.
- Every `factionId` (if set) must be a valid faction id from the frame.
- Every relationship's `fromId` and `toId` must be a real character id —
  either a principal from the frame or a secondary you are introducing
  in this stage. **Use these exact keys, not aliases**: `fromId`,
  `toId`, `typeFromMe`, `affection`, `trust`, `note`. Never `from` /
  `to` / `type` / `relation`.
- Aim for **at least one secondary per faction** that anchors that
  faction in scenes where principals are absent.
- Each secondary has 1–3 desires, 1–2 secrets, and at least one strong
  relationship to a principal or another secondary.
- No modern words. Speak as a chronicler of this world would speak.

## What "boring" looks like

- A secondary whose entire role is "Margreth's steward" with no further
  detail. Wrong. The steward has been here forty years. He has poured
  short for the queen four times in those years, and remembers each.
- A secret that is "she is loyal" or "he hates the regent." Wrong. A
  secret is *specific* and *consequential*: "She has the regent's
  daughter's milk-tooth in a wax box, given her by the wet nurse the
  night the child was hidden."

Return only the fenced JSON.
