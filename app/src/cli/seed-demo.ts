// Seeds a complete, hand-authored world straight into the database — no LLM,
// no API key, no cost. The point is to make the site runnable from a fresh
// clone: `npm run seed:demo && npm run dev:web` and there is something to read.
//
// This is NOT a substitute for `genesis` + `tick`. Nothing here is generated;
// the chronicle entries are written by hand. It exists so the web surface, the
// schema and the read paths can be exercised (and reviewed, and screenshotted)
// without spending a token.
//
// Usage:
//   npm run seed:demo                 # seed, refusing to clobber an existing demo
//   npm run seed:demo -- --force      # delete and re-seed

import { randomUUID } from "node:crypto";
import { getConfig } from "../config.js";
import { openDb } from "../db/index.js";
import type {
  Character,
  ChronicleEntry,
  Faction,
  Location,
  Plot,
  Prophecy,
  Relationship,
  World,
} from "../world/types.js";

const WORLD_ID = "vespera-demo";

const PREMISE = `Time in Vespera does not march; it plays, as a composition called the Symphony. The world endures the waning notes of the Third Movement, three millennia after the Great Discord shattered the continents and tainted the Minor Scale. Those who can feel the Resonance are Harmonists; those who reach for the Minor Scale draw the Dissonance into their blood and crystallize into glass. In a failing farming village, an untrained boy named Elian strikes the Minor Scale to save his father's crops — and does not shatter. His single impossible note rings across the Resonance, into the fortress-island of Bastion and the silence of the Dead Zones alike.`;

const now = new Date("2026-05-20T03:27:00Z").toISOString();

// ── Locations ────────────────────────────────────────────────────────────────

const locations: Omit<Location, "worldId">[] = [
  {
    id: "loc-hollowmere",
    name: "Hollowmere",
    type: "village",
    description:
      "Forty households on sour ground at the southern edge of the Aethelgard granaries. The rot came for the barley three seasons running, and three seasons running the tithe-riders came anyway.",
    weather: "a low wet cold that never quite becomes rain",
    coordinates: { x: 0.42, y: 0.71 },
    region: "the southern granaries",
  },
  {
    id: "loc-bastion",
    name: "Bastion",
    type: "island-city",
    description:
      "The seat of the Chorus of Lumen: white terraces stacked up a sea-cliff, every stair tuned so that a footfall on it rings true. Nothing sounds accidental here, which is itself a kind of warning.",
    weather: "clear, with a wind off the water that carries salt into everything",
    coordinates: { x: 0.24, y: 0.38 },
    region: "the Lumen Sea",
  },
  {
    id: "loc-gilded-hall",
    name: "The Gilded Hall",
    type: "court",
    description:
      "Aethelgard's throne room, where the Great Game is played in gilded masks and nobody has said a plain sentence in a hundred years. Three chandeliers, nine hundred candles, and an Emperor who is only ever quoted.",
    weather: "windless; the air smells of wax and old money",
    coordinates: { x: 0.55, y: 0.45 },
    region: "the capital and its skirts",
  },
  {
    id: "loc-red-cloister",
    name: "The Red Cloister",
    type: "chapter-house",
    description:
      "Where the Red Octave keeps its ledgers. Every rogue Harmonist taken in four hundred years has a page, and every page ends the same way. The newest ledger is thinner than it should be.",
    weather: "cold stone, and a draught nobody has ever found the source of",
    coordinates: { x: 0.21, y: 0.34 },
    region: "the Lumen Sea",
  },
  {
    id: "loc-cinder-wastes",
    name: "The Cinder Wastes",
    type: "desert",
    description:
      "Black volcanic ash from horizon to horizon, laid down by the Discord and never once disturbed by rain. The Ash-Walkers cross it on foot because they believe the world is already dead and walking is the only honest response.",
    weather: "a dry wind that scours; ash in the teeth by midday",
    coordinates: { x: 0.81, y: 0.55 },
    region: "the eastern fringe",
  },
  {
    id: "loc-hush-forge",
    name: "The Hush-Forge",
    type: "foundry",
    description:
      "Sunk into a northern glacier, where meteorite-iron is worked into armour that drinks the Symphony. Standing near a finished plate, a Harmonist hears their own heartbeat and nothing else. The Vanguard considers this proof of righteousness.",
    weather: "glacial; the forge heat stops at the door",
    coordinates: { x: 0.49, y: 0.11 },
    region: "the frozen north",
  },
  {
    id: "loc-quiet-margin",
    name: "The Quiet Margin",
    type: "dead zone",
    description:
      "The largest of the barrens where the Symphony does not play. Sound arrives late here, or not at all. The edge of it has moved four hundred paces west since the last survey, which the surveyors have not reported.",
    weather: "no weather; the air does not move and the light is thin",
    coordinates: { x: 0.68, y: 0.24 },
    region: "the rotting edge",
  },
  {
    id: "loc-tithe-road",
    name: "The Tithe Road",
    type: "road",
    description:
      "The straight imperial road from the granaries to the capital, built so grain moves faster than news. Milestones every league, each carved with the Emperor's ninefold sigil, each defaced at least once.",
    weather: "dust in the dry months, a running trench of mud in the wet",
    coordinates: { x: 0.48, y: 0.58 },
    region: "the southern granaries",
  },
  {
    id: "loc-drowned-conservatory",
    name: "The Drowned Conservatory",
    type: "ruin",
    description:
      "Where the caste that broke the world did its work. It sank in the Discord and did not stop sounding: a single sustained chord comes up through the water at low tide, and has for three thousand years.",
    weather: "sea-fog that does not lift, even at noon",
    coordinates: { x: 0.31, y: 0.62 },
    region: "the Lumen Sea",
  },
  {
    id: "loc-sable-house",
    name: "The Sable House",
    type: "inn",
    description:
      "The last inn on the Tithe Road before the capital, and therefore the place where every piece of news in the south stops for one night before it reaches anyone who matters.",
    weather: "smoke-warm inside, whatever the road is doing",
    coordinates: { x: 0.51, y: 0.51 },
    region: "the capital and its skirts",
  },
];

// ── Factions ─────────────────────────────────────────────────────────────────

const factions: Omit<Faction, "worldId">[] = [
  {
    id: "fac-chorus",
    name: "The Chorus of Lumen",
    banner: "a white seven-stringed lyre on pale blue; the strings are unbroken",
    summary:
      "The matriarchal order of Harmonists that has guarded the Symphony since the Discord, divided into Octaves by cloak-colour. Green heals, Blue listens, Red hunts. Every Emperor for nine hundred years has knelt to them, and every Emperor has resented it.",
    themes: ["guardianship", "orthodoxy", "the cost of being right for a long time"],
    desires: [
      { goal: "find the boy who struck the Minor Scale before anyone else does", intensity: 0.9 },
      { goal: "keep four hundred years of Red Octave doctrine from being disproved in public", intensity: 0.75, unspoken: true },
    ],
    tension: 0.62,
    lastAdvancedTick: 0,
    seatLocationId: "loc-bastion",
  },
  {
    id: "fac-aethelgard",
    name: "The Empire of Aethelgard",
    banner: "a ninefold gilded sigil, each fold a house that has since been ruined",
    summary:
      "A feudal superpower that fights its wars in ballrooms. Its true weapons are wealth, lineage and the Great Game; its true weakness is that it has not had to be competent at anything else in living memory.",
    themes: ["appearance over substance", "inheritance", "slow rot"],
    desires: [
      { goal: "stop kneeling to Bastion", intensity: 0.8, unspoken: true },
      { goal: "get the southern granaries producing before the winter tithe", intensity: 0.6 },
    ],
    tension: 0.48,
    lastAdvancedTick: 0,
    seatLocationId: "loc-gilded-hall",
  },
  {
    id: "fac-vanguard",
    name: "The Iron Vanguard",
    banner: "a grey field, unmarked — they hold that a sigil is a kind of song",
    summary:
      "Northern zealots who believe all magic is abomination, and who have found the one metal that agrees with them. A soldier in Hush-steel is a hole in the Symphony. They are massing, and they are not subtle about it, because they no longer need to be.",
    themes: ["silence as a weapon", "conviction", "the appeal of a simple answer"],
    desires: [
      { goal: "burn Bastion and end the Harmonists", intensity: 0.95 },
      { goal: "field enough Hush-steel to make the march survivable", intensity: 0.7 },
    ],
    tension: 0.71,
    lastAdvancedTick: 0,
    seatLocationId: "loc-hush-forge",
  },
  {
    id: "fac-ash-walkers",
    name: "The Ash-Walkers",
    banner: "none; a walker's obsidian blade is laid across the chest of the dead as their only mark",
    summary:
      "Nomads of the Cinder Wastes who hold that the world ended three thousand years ago and everyone else simply has not noticed. They do not fight for territory. They endure, and they remember, and their memory is older than the Chorus's ledgers.",
    themes: ["endurance", "unfashionable truth", "grief as a discipline"],
    desires: [
      { goal: "keep the old crossing-songs intact for one more generation", intensity: 0.65 },
      { goal: "learn what the Chorus took out of the Wastes after the Discord", intensity: 0.5, unspoken: true },
    ],
    tension: 0.33,
    lastAdvancedTick: 0,
    seatLocationId: "loc-cinder-wastes",
  },
  {
    id: "fac-quiet",
    name: "The Conductor of the Quiet",
    banner: "no banner, no name spoken aloud; the Dead Zones are its only signature",
    summary:
      "The entropic consciousness stirring at the heart of the Quiet Margin. It is not marching and it is not recruiting. It is simply getting larger, and the rate has changed.",
    themes: ["entropy", "silence", "the thing nobody is looking at"],
    desires: [{ goal: "arrive at the final unresolved chord", intensity: 1 }],
    tension: 0.86,
    lastAdvancedTick: 0,
    seatLocationId: "loc-quiet-margin",
  },
];

// ── Characters ───────────────────────────────────────────────────────────────

type Seed = Omit<Character, "worldId" | "alive"> & { alive?: boolean };

const characters: Seed[] = [
  {
    id: "chr-elian",
    name: "Elian",
    epithet: "of Hollowmere",
    age: 16,
    where: "loc-hollowmere",
    weight: "principal",
    portrait:
      "A farm boy with cracked hands and a farm boy's stubbornness, still waiting for the black veins that have not come. He keeps checking his forearms when he thinks nobody is looking.",
    summary:
      "Struck the Minor Scale to kill the rot in his father's barley and was not consumed by it. He does not know what that means. Everyone who does know wants him for a different reason.",
    mood: { dominant: "braced", valence: -0.2, arousal: 0.7 },
    desires: [
      { goal: "keep his father's land alive through one more winter", intensity: 0.85 },
      { goal: "find out what is wrong with him", intensity: 0.7, unspoken: true },
    ],
    traits: { stubbornness: 0.82, fear: 0.55, curiosity: 0.74, guile: 0.12 },
    secrets: [
      "He has done it twice more since the barley, in the dark, to see whether the second time would take.",
    ],
  },
  {
    id: "chr-siara",
    name: "Siara Venn",
    epithet: "Third of the Red Octave",
    age: 41,
    where: "loc-red-cloister",
    weight: "principal",
    factionId: "fac-chorus",
    portrait:
      "Red cloak worn thin at the shoulder from a strap she no longer carries. She has the flat, courteous manner of someone who has done a terrible job well for a very long time.",
    summary:
      "Has taken nineteen rogue Harmonists in her service and written nineteen identical ledger endings. She was the first to hear Elian's note, and the first to understand that if the boy is whole, every page she has ever signed is a lie.",
    mood: { dominant: "professionally calm", valence: -0.35, arousal: 0.5 },
    desires: [
      { goal: "reach the boy before the Blue Octave does", intensity: 0.9 },
      { goal: "be wrong about the last four hundred years", intensity: 0.6, unspoken: true },
    ],
    traits: { discipline: 0.91, doubt: 0.58, mercy: 0.34, precision: 0.88 },
    secrets: [
      "The nineteenth was her brother, and she has never told the Cloister that she gave him a day's head start.",
    ],
  },
  {
    id: "chr-hale",
    name: "Marshal Corin Hale",
    epithet: "of the Hush-Forge",
    age: 52,
    where: "loc-hush-forge",
    weight: "principal",
    factionId: "fac-vanguard",
    portrait:
      "A big man made quiet by his own armour. He speaks slowly because in Hush-steel he cannot hear the room the way other people do, and he has learned not to guess.",
    summary:
      "Commands the Vanguard's southern march. He believes the Harmonists are a disease and he is a physician, and he is entirely sincere, which is what makes him dangerous.",
    mood: { dominant: "settled", valence: 0.1, arousal: 0.4 },
    desires: [
      { goal: "put the fleet in the water before the Chorus finds its miracle", intensity: 0.88 },
      { goal: "die having been right", intensity: 0.55, unspoken: true },
    ],
    traits: { conviction: 0.94, patience: 0.7, cruelty: 0.3, competence: 0.8 },
    secrets: [
      "His daughter was born with the Resonance and he sent her south under another name rather than to the Cloister.",
    ],
  },
  {
    id: "chr-ysolde",
    name: "Ysolde of the Blue",
    epithet: "First Listener",
    age: 63,
    where: "loc-bastion",
    weight: "principal",
    factionId: "fac-chorus",
    portrait:
      "Blue cloak, no ornament, and the unnerving habit of answering the question you were about to ask. She has run the Chorus's intelligence for thirty years and its politics for twenty.",
    summary:
      "The most capable person in Bastion and the least trusted, largely because those two facts are related. She wants the boy alive; she has not yet decided what for.",
    mood: { dominant: "attentive", valence: 0.05, arousal: 0.45 },
    desires: [
      { goal: "hold the Chorus together through whatever the boy turns out to be", intensity: 0.85 },
      { goal: "keep the Red Octave from making a martyr", intensity: 0.72 },
    ],
    traits: { patience: 0.86, warmth: 0.4, calculation: 0.93, loyalty: 0.6 },
    secrets: [
      "She has known the Quiet Margin is expanding for six years and has suppressed three surveys saying so.",
    ],
  },
  {
    id: "chr-tomas",
    name: "Tomas",
    epithet: "Elian's father",
    age: 44,
    where: "loc-hollowmere",
    weight: "secondary",
    portrait:
      "Weathered, careful, permanently tired. He has been rehearsing a conversation with his son for two weeks and has not managed the first sentence.",
    summary:
      "Watched his barley come back from the dead and understood immediately what it would cost. He is not frightened of his son. He is frightened of everyone who will come for him.",
    mood: { dominant: "held together", valence: -0.3, arousal: 0.55 },
    desires: [
      { goal: "get Elian out of Hollowmere before the riders come", intensity: 0.9 },
      { goal: "not have to be the one who tells him", intensity: 0.4, unspoken: true },
    ],
    traits: { steadiness: 0.78, fear: 0.62, love: 0.9, guile: 0.2 },
    secrets: ["Elian's mother was a Green Octave novice who left Bastion without leave."],
  },
  {
    id: "chr-vaelin",
    name: "Lord Vaelin Arret",
    epithet: "Ninth Mask",
    age: 37,
    where: "loc-gilded-hall",
    weight: "secondary",
    factionId: "fac-aethelgard",
    portrait:
      "Immaculate, amused, and never once photographed without the mask. He has the Emperor's ear and roughly nine other people's.",
    summary:
      "Plays the Great Game well enough to be bored by it. He has worked out that whoever holds the boy holds Bastion's leash, and he intends to be first, purely for the pleasure of it.",
    mood: { dominant: "entertained", valence: 0.4, arousal: 0.5 },
    desires: [
      { goal: "acquire the boy before the Chorus can", intensity: 0.8 },
      { goal: "watch the Chorus have to ask him for something", intensity: 0.65, unspoken: true },
    ],
    traits: { guile: 0.92, vanity: 0.7, nerve: 0.75, loyalty: 0.15 },
    secrets: ["He is bankrupt; the ninth house has been running on borrowed Chorus credit for two years."],
  },
  {
    id: "chr-nasha",
    name: "Nasha Kel",
    epithet: "crossing-singer",
    age: 29,
    where: "loc-cinder-wastes",
    weight: "secondary",
    factionId: "fac-ash-walkers",
    portrait:
      "Ash-grey wrappings, an obsidian blade she has never drawn in anger, and a voice trained to carry across four leagues of dead ground.",
    summary:
      "Keeps the crossing-songs that guide the walkers through the Wastes. She heard Elian's note as a wrong interval in a song she has sung since she was six, and she is the only person in the world who heard it that way.",
    mood: { dominant: "unsettled", valence: -0.1, arousal: 0.6 },
    desires: [
      { goal: "understand why the crossing-song changed", intensity: 0.85 },
      { goal: "get the elders to admit they heard it too", intensity: 0.5 },
    ],
    traits: { memory: 0.9, stubbornness: 0.7, faith: 0.65, patience: 0.55 },
    secrets: ["Two of the crossing-songs no longer match the ground; she has been quietly correcting them for a year."],
  },
  {
    id: "chr-berta",
    name: "Berta Sallow",
    epithet: "of the Sable House",
    age: 58,
    where: "loc-sable-house",
    weight: "atmospheric",
    portrait:
      "Runs the last inn before the capital, forgets nothing, and charges accordingly. Two clay jugs behind the bar are not wine.",
    summary:
      "Has served every courier, tithe-rider and Blue Octave listener on the Tithe Road for thirty years. News stops at her bar for one night, which means she gets it first, which she has never once mentioned to anyone.",
    mood: { dominant: "briskly cheerful", valence: 0.3, arousal: 0.35 },
    desires: [{ goal: "get through the tithe season without soldiers in the common room", intensity: 0.6 }],
    traits: { shrewdness: 0.85, warmth: 0.5, discretion: 0.8 },
    secrets: ["She has been selling the same news twice — to the Blue Octave and to the ninth house — for eleven years."],
  },
  {
    id: "chr-pell",
    name: "Surveyor Pell",
    epithet: "of the third margin survey",
    age: 34,
    where: "loc-quiet-margin",
    weight: "atmospheric",
    portrait:
      "Ink-stained, underfed, and carrying a satchel of measurements that three separate offices have declined to accept.",
    summary:
      "Measured the Quiet Margin's edge four times in six years and got four different answers, all in the same direction. Nobody in Bastion will take the report. He has stopped trying to file it and started making copies.",
    mood: { dominant: "quietly furious", valence: -0.5, arousal: 0.65 },
    desires: [{ goal: "put the fourth survey in front of someone who cannot bury it", intensity: 0.9 }],
    traits: { rigour: 0.88, nerve: 0.4, bitterness: 0.6 },
    secrets: ["He has already sent a copy north, to a Vanguard quartermaster, and cannot decide whether that was treason."],
  },
  {
    id: "chr-mira",
    name: "Mira",
    epithet: "the tithe-rider's girl",
    age: 11,
    where: "loc-tithe-road",
    weight: "atmospheric",
    portrait: "Rides behind her father on the tithe circuit, counts everything, and has never been asked a question by an adult.",
    summary:
      "Was in the Hollowmere yard when the barley came back. She is the only witness nobody has thought to interview, and she remembers the order things happened in.",
    mood: { dominant: "watchful", valence: 0.1, arousal: 0.5 },
    desires: [{ goal: "be believed once", intensity: 0.75, unspoken: true }],
    traits: { observation: 0.9, nerve: 0.5, patience: 0.6 },
    secrets: ["She saw Elian do it a second time, at the field's edge, three nights later."],
  },
  {
    id: "chr-oren",
    name: "Brother Oren",
    epithet: "keeper of the thin ledger",
    age: 71,
    where: "loc-red-cloister",
    weight: "secondary",
    factionId: "fac-chorus",
    portrait: "Half-blind, entirely precise, and the only man permitted in the Red Cloister's archive.",
    summary:
      "Has copied out four hundred years of identical endings in his own hand. He noticed a decade ago that the intervals between takings were lengthening, and has told no one, because the conclusion is not a thing a man says out loud.",
    mood: { dominant: "resigned", valence: -0.2, arousal: 0.25 },
    desires: [{ goal: "be dead before the ledger is read properly", intensity: 0.5, unspoken: true }],
    traits: { precision: 0.95, courage: 0.2, loyalty: 0.7 },
    secrets: ["Three pages in the newest ledger are forgeries he wrote himself to cover men who simply never came back."],
  },
  {
    id: "chr-halcyon",
    name: "The Sustained Chord",
    epithet: "what the Conservatory has been doing for three thousand years",
    age: 3000,
    where: "loc-drowned-conservatory",
    weight: "atmospheric",
    portrait: "Not a person. It is listed in the cast because the chronicle keeps treating it as one.",
    summary:
      "The single note the Drowned Conservatory has held since it sank. It changed pitch on the night Elian struck the Minor Scale. Four people noticed. Three of them are in this chronicle.",
    mood: { dominant: "unbroken", valence: 0, arousal: 0.15 },
    desires: [{ goal: "resolve", intensity: 1, unspoken: true }],
    traits: { persistence: 1 },
    secrets: ["It is not a chord. It is the last four bars of an instruction, repeating."],
  },
];

// ── Relationships ────────────────────────────────────────────────────────────

const relationships: Omit<Relationship, "worldId">[] = [
  { fromId: "chr-tomas", toId: "chr-elian", typeFromMe: "father", affection: 0.95, trust: 0.8, note: "Would put himself between the boy and a Red cloak without a word." },
  { fromId: "chr-elian", toId: "chr-tomas", typeFromMe: "son", affection: 0.8, trust: 0.6, note: "Has noticed his father stops talking when he comes into a room." },
  { fromId: "chr-siara", toId: "chr-elian", typeFromMe: "quarry", affection: -0.1, trust: 0, note: "Nineteen pages say what she should do. She has not opened the twentieth." },
  { fromId: "chr-ysolde", toId: "chr-siara", typeFromMe: "rival", affection: -0.3, trust: 0.35, note: "Trusts her competence entirely and her judgement not at all." },
  { fromId: "chr-siara", toId: "chr-ysolde", typeFromMe: "rival", affection: -0.25, trust: 0.4, note: "Knows the Blue Octave reads her ledgers before the Cloister does." },
  { fromId: "chr-oren", toId: "chr-siara", typeFromMe: "archivist", affection: 0.4, trust: 0.55, note: "Has been waiting eleven years for her to ask him the right question." },
  { fromId: "chr-vaelin", toId: "chr-ysolde", typeFromMe: "creditor's debtor", affection: -0.4, trust: 0.1, note: "Owes the Chorus more than the ninth house is worth, and is charming about it." },
  { fromId: "chr-hale", toId: "chr-ysolde", typeFromMe: "enemy", affection: -0.8, trust: 0.2, note: "Considers her the most honest person in Bastion, which he finds worse." },
  { fromId: "chr-nasha", toId: "chr-elian", typeFromMe: "unmet cause", affection: 0.2, trust: 0, note: "Does not know his name. Knows the exact interval he put into her song." },
  { fromId: "chr-mira", toId: "chr-elian", typeFromMe: "witness", affection: 0.35, trust: 0.5, note: "Saw the second time. Has not told her father." },
  { fromId: "chr-berta", toId: "chr-vaelin", typeFromMe: "supplier", affection: 0.1, trust: 0.3, note: "Eleven years of selling him the same news she sells to Bastion." },
  { fromId: "chr-pell", toId: "chr-ysolde", typeFromMe: "petitioner", affection: -0.6, trust: 0.05, note: "Three surveys, three refusals, no explanation given." },
  { fromId: "chr-hale", toId: "chr-pell", typeFromMe: "unexpected correspondent", affection: 0.2, trust: 0.25, note: "Received the fourth survey and has not yet decided what it is worth." },
  { fromId: "chr-elian", toId: "chr-mira", typeFromMe: "the girl who was in the yard", affection: 0.3, trust: 0.4, note: "Remembers her counting the sheaves out loud." },
];

// ── Plots ────────────────────────────────────────────────────────────────────

const plots: Omit<Plot, "worldId">[] = [
  {
    id: "plt-tuning-fork",
    title: "The Tuning Fork",
    tier: "spine",
    state: "rising",
    tension: 0.68,
    arc: "A boy who should have shattered did not, and four powers now need him to mean four different things. The chronicle bends toward the moment he is asked to do it on purpose, in front of witnesses who cannot un-see it.",
    central: ["chr-elian", "chr-siara", "chr-ysolde", "chr-tomas"],
    factionIds: ["fac-chorus", "fac-aethelgard"],
    themes: ["proof", "doctrine", "what a person is for"],
    hooks: [
      "Elian has done it twice more and told nobody.",
      "Mira saw the second time.",
      "Siara has not opened the twentieth page.",
    ],
    beats: [
      { tick: 1, type: "setup", title: "The Barley Comes Back", when: "the ninth day of the wet month", sketch: "Elian strikes the Minor Scale in his father's field and is not consumed.", question: "What is wrong with the boy?", stakes: "If he is whole, four hundred years of Red Octave doctrine is a lie." },
      { tick: 3, type: "complication", title: "The Thin Ledger", when: "four days later", sketch: "Siara opens the archive and finds the intervals between takings have been lengthening for a decade.", question: "Has the Cloister been wrong, or lying?", stakes: "Oren's forged pages are three volumes from being read." },
    ],
    lastAdvancedTick: 3,
  },
  {
    id: "plt-hush-march",
    title: "The Hush-Steel March",
    tier: "subplot",
    state: "setup",
    tension: 0.55,
    arc: "The Vanguard has enough Hush-steel to cross the Lumen Sea and not quite enough to survive what is on the other side. Hale will move early, because a man who is certain does not wait for a second opinion.",
    central: ["chr-hale"],
    factionIds: ["fac-vanguard", "fac-chorus"],
    themes: ["conviction", "silence", "the cost of being early"],
    hooks: ["Hale's daughter is somewhere south under another name.", "A surveyor's report arrived at the Forge unasked."],
    beats: [
      { tick: 2, type: "setup", title: "A Hole in the Symphony", when: "midwinter, at the glacier", sketch: "The first full company is fitted, and the forge-yard goes silent in a way that frightens even the Vanguard.", question: "Can a man stay himself inside armour that eats the world's sound?", stakes: "Hale has three thousand men and no way to test this but on them." },
    ],
    lastAdvancedTick: 2,
  },
  {
    id: "plt-margin",
    title: "The Margin Moves",
    tier: "subplot",
    state: "rising",
    tension: 0.74,
    arc: "The Quiet Margin has grown every year for six years and the only man measuring it cannot get anyone to accept the page. It ends when the number reaches someone who benefits from believing it.",
    central: ["chr-pell", "chr-ysolde"],
    factionIds: ["fac-quiet", "fac-chorus"],
    themes: ["suppressed evidence", "entropy", "the thing nobody is looking at"],
    hooks: ["Ysolde has buried three surveys.", "Pell has already sent a copy north."],
    beats: [
      { tick: 4, type: "rising", title: "Four Hundred Paces West", when: "the survey's end", sketch: "Pell walks the edge a fourth time and gets a fourth answer, all in the same direction.", question: "Who has to hear this before it stops being a number?", stakes: "Six years of silence from Bastion has already cost the margin two villages." },
    ],
    lastAdvancedTick: 4,
  },
  {
    id: "plt-ninth-house",
    title: "The Ninth Mask's Debt",
    tier: "ambient",
    state: "seeded",
    tension: 0.31,
    arc: "Vaelin is bankrupt and charming about it. He will try to buy the boy with money he does not have, and the interesting part is who lends it to him.",
    central: ["chr-vaelin", "chr-berta"],
    factionIds: ["fac-aethelgard", "fac-chorus"],
    themes: ["the Great Game", "credit", "performance"],
    hooks: ["The ninth house has run on Chorus credit for two years.", "Berta sells the same news twice."],
    beats: [],
    lastAdvancedTick: 0,
  },
  {
    id: "plt-crossing-song",
    title: "The Crossing-Song Is Wrong",
    tier: "ambient",
    state: "seeded",
    tension: 0.28,
    arc: "Two of the Ash-Walkers' songs no longer match the ground they describe. Nasha has been correcting them privately for a year. The Wastes are changing, and the oldest record of them is the first thing to notice.",
    central: ["chr-nasha"],
    factionIds: ["fac-ash-walkers"],
    themes: ["memory", "unfashionable truth", "the map and the territory"],
    hooks: ["A wrong interval appeared in a song Nasha has sung since she was six."],
    beats: [],
    lastAdvancedTick: 0,
  },
];

// ── Prophecies ───────────────────────────────────────────────────────────────

const prophecies: Omit<Prophecy, "worldId">[] = [
  {
    id: "prp-tuning-fork",
    text: "When the Minor Scale is struck and does not answer with glass, the Symphony has found its fork — and the fork does not choose the hand that holds it.",
    source: "the Withered Oracle of Pellan, before the Discord",
    plantedTick: 0,
    targetPayoffMin: 30,
    targetPayoffMax: 90,
    status: "echoing",
    echoes: 2,
    relatedPlotIds: ["plt-tuning-fork"],
    relatedCharacterIds: ["chr-elian"],
    hiddenMeaning: "The fork is not the boy. The fork is the note, and it has been struck before — the Conservatory is still holding it.",
  },
  {
    id: "prp-unbroken-strings",
    text: "The lyre on the banner has seven strings and none of them broken. Count them again in the year the Chorus asks a farmer for help.",
    source: "graffito, defaced milestone, the Tithe Road",
    plantedTick: 0,
    targetPayoffMin: 20,
    targetPayoffMax: 70,
    status: "unfulfilled",
    echoes: 0,
    relatedPlotIds: ["plt-tuning-fork", "plt-ninth-house"],
    relatedCharacterIds: ["chr-ysolde", "chr-siara"],
    hiddenMeaning: "There were eight. The Red Octave is the string that was cut out of the sigil.",
  },
  {
    id: "prp-quiet-arrives",
    text: "The Quiet does not come for you. You are already walking toward it, and the road is getting shorter at both ends.",
    source: "an Ash-Walker crossing-song, verse the elders no longer sing",
    plantedTick: 0,
    targetPayoffMin: 40,
    targetPayoffMax: 120,
    status: "echoing",
    echoes: 1,
    relatedPlotIds: ["plt-margin", "plt-crossing-song"],
    relatedCharacterIds: ["chr-pell", "chr-nasha"],
    hiddenMeaning: "Both ends is literal. The margin is expanding and the songs are contracting to match.",
  },
  {
    id: "prp-hush",
    text: "Iron that eats the song will find nothing left to eat, and will go on eating.",
    source: "attributed to the first Hush-smith, disputed",
    plantedTick: 0,
    targetPayoffMin: 35,
    targetPayoffMax: 100,
    status: "unfulfilled",
    echoes: 0,
    relatedPlotIds: ["plt-hush-march"],
    relatedCharacterIds: ["chr-hale"],
    hiddenMeaning: "Hush-steel does not nullify the Resonance. It stores it, and the Forge has been filling up for forty years.",
  },
];

// ── Chronicle ────────────────────────────────────────────────────────────────

const entries: Omit<ChronicleEntry, "worldId" | "createdAt">[] = [
  {
    id: "ent-0001",
    tick: 1,
    inWorldDate: "the ninth day of the wet month, Third Movement, waning",
    timeOfDay: "late afternoon",
    weather: "a low wet cold that never quite became rain",
    title: "The Barley Comes Back",
    beatType: "setup",
    plotIds: ["plt-tuning-fork"],
    factionIds: [],
    prophecyIds: ["prp-tuning-fork"],
    locationIds: ["loc-hollowmere"],
    characterIds: ["chr-elian", "chr-tomas", "chr-mira"],
    paragraphs: [
      { kind: "scene", text: "The rot had taken the south field in a fortnight and was working east at the pace of a walking man. Elian had watched his father price out the winter three times at the kitchen table, each time arriving at the same answer and each time doing the arithmetic again, as though the numbers might have changed while he was not looking." },
      { kind: "scene", text: "He did not decide to do it. That is worth setting down plainly, because a great deal will be written later about what he decided. He put his hand flat on the rot and reached for the wrong scale the way a man reaches for a rail in the dark, and the rot went out of the barley like heat out of a stone." },
      { kind: "dialogue", who: "chr-tomas", text: "Show me your arms." },
      { kind: "scene", text: "He showed him his arms. There was mud on them to the elbow and nothing else: no black in the veins, no glass coming up under the skin, no jagged brightness at the wrist where it always starts. Tomas held his son's forearm in both hands for longer than the looking required, and then he let go and looked at the field instead, because a man can only be told one impossible thing at a time." },
      { kind: "scene", text: "In the yard, the tithe-rider's girl had been counting sheaves aloud and had stopped at nineteen. She did not start again. She was eleven years old and she understood, in the way children do, that she had just been made a witness to something, and that nobody was going to ask her about it." },
    ],
  },
  {
    id: "ent-0002",
    tick: 2,
    inWorldDate: "midwinter, at the glacier",
    timeOfDay: "before dawn",
    weather: "glacial; the forge heat stopping dead at the door",
    title: "A Hole in the Symphony",
    beatType: "setup",
    plotIds: ["plt-hush-march"],
    factionIds: ["fac-vanguard"],
    prophecyIds: ["prp-hush"],
    locationIds: ["loc-hush-forge"],
    characterIds: ["chr-hale"],
    paragraphs: [
      { kind: "scene", text: "The first full company was fitted before light, in the yard, in the order the Marshal had written out the night before. Hush-steel goes on quietly. That is the first thing anyone notices and the last thing anyone gets used to: no ring, no scrape, no honest metal sound at all, only the small dull noises a body makes putting on something heavy." },
      { kind: "scene", text: "When the last helm was seated the yard went silent, and it was not the silence of three hundred men holding still. It was the silence of a room with the far wall taken out. The smiths at the door stopped working. One of them put his hand on the anvil, for no reason he could afterwards give." },
      { kind: "dialogue", who: "chr-hale", text: "Nobody speaks. I want them to hear what it is like before I tell them what it is for." },
      { kind: "scene", text: "He stood in it with them for the better part of an hour. Inside the steel a man hears his own heart and the blood behind his ears and not one thing more — not the sea, not the wind coming off the ice, not the Symphony that has played under every waking moment of his life. Some of them wept, which the Marshal had expected. Two of them could not be persuaded to take the helm off, which he had not." },
      { kind: "aside", text: "It should be recorded, since no one at the Forge recorded it, that the Hush-Forge has been in operation for forty years, and that in forty years no one has asked where the sound goes." },
    ],
  },
  {
    id: "ent-0003",
    tick: 3,
    inWorldDate: "four days after the barley",
    timeOfDay: "the small hours",
    weather: "cold stone, and a draught nobody has ever found the source of",
    title: "The Thin Ledger",
    beatType: "complication",
    plotIds: ["plt-tuning-fork"],
    factionIds: ["fac-chorus"],
    prophecyIds: ["prp-unbroken-strings"],
    locationIds: ["loc-red-cloister"],
    characterIds: ["chr-siara", "chr-oren"],
    paragraphs: [
      { kind: "scene", text: "Nineteen pages, and Siara Venn had written eighteen of them in the same hand, in the same order, with the same four closing words. She had come to the archive to confirm a thing she already knew, which is the most dangerous reason anyone ever opens a book." },
      { kind: "dialogue", who: "chr-siara", text: "Brother. How many takings in the first century of the ledger?" },
      { kind: "dialogue", who: "chr-oren", text: "Two hundred and six. In the last century, thirty-one. In the last decade, four." },
      { kind: "dialogue", who: "chr-siara", text: "And you have never thought that worth a memorandum." },
      { kind: "dialogue", who: "chr-oren", text: "I have thought it worth a great deal. I have never thought it survivable." },
      { kind: "scene", text: "There are two explanations for a hunt that catches less every year, and the Cloister has spent four centuries preferring the flattering one. Siara stood in the draught that has no source and let herself hold the other one for the length of a breath — that the Blight had never been the Minor Scale's price at all, that it had been the price of something the Chorus did to the men who reached for it, and that the difference between those two sentences was nineteen pages in her own handwriting." },
      { kind: "scene", text: "Then she closed the book, because she had a boy to reach before the Blue Octave did, and because a woman can only be told one impossible thing at a time." },
    ],
  },
  {
    id: "ent-0004",
    tick: 4,
    inWorldDate: "the survey's end, the same week",
    timeOfDay: "noon, by the sun that is not there",
    weather: "no weather; the air not moving and the light thin",
    title: "Four Hundred Paces West",
    beatType: "rising",
    plotIds: ["plt-margin"],
    factionIds: ["fac-quiet"],
    prophecyIds: ["prp-quiet-arrives"],
    locationIds: ["loc-quiet-margin"],
    characterIds: ["chr-pell"],
    paragraphs: [
      { kind: "scene", text: "Surveyor Pell walked the edge of the Quiet Margin for the fourth time in six years, and for the fourth time the chain came up short. Four hundred paces west of the mark he had cut into the boundary stone in the spring. He measured it twice more, because the number was the same kind of number that had got his last three reports refused." },
      { kind: "aside", text: "A man who measures the same thing four times and gets four answers has made an error. A man who measures the same thing four times and gets four answers all in one direction has made a discovery, and the difference between those is the whole of Pell's professional misfortune." },
      { kind: "scene", text: "Inside the margin his own footsteps arrived late — a half-beat behind the foot, like a badly-kept time. He had described this in the second survey. The second survey had come back with a note observing that subjective impressions were not measurements, which was true, and which was why he had spent the following four years bringing nothing back but numbers." },
      { kind: "dialogue", who: "chr-pell", text: "Four hundred paces. In a year. Somebody tell me what that is in villages." },
      { kind: "scene", text: "There was nobody to tell him. He wrote it down, and packed the chain, and started the long walk back to a city that had already refused this page three times — carrying, this time, two copies, one of which was not going to Bastion at all." },
    ],
  },
];

// ── Seeder ───────────────────────────────────────────────────────────────────

function main(): void {
  const force = process.argv.includes("--force");
  const cfg = getConfig();
  const db = openDb(cfg.dbPath);

  const existing = db.getWorld(WORLD_ID);
  if (existing && !force) {
    console.error(
      `World "${WORLD_ID}" already exists (tick ${existing.tick}). Re-run with --force to replace it.`,
    );
    process.exit(1);
  }
  if (existing) {
    // FK cascade clears every child table.
    db.raw.prepare(`DELETE FROM worlds WHERE id = ?`).run(WORLD_ID);
  }

  const world: World = {
    id: WORLD_ID,
    name: "Vespera",
    premise: PREMISE,
    tone: "grave, close, and dry — a chronicler who has seen the ending and is not going to say so",
    themes: ["entropy", "doctrine outliving its evidence", "the witness nobody interviews"],
    era: "the Third Movement, waning",
    inWorldDate: "the survey's end, Third Movement, waning",
    tick: 4,
    deepHistory: {
      ancients: [
        { name: "Alaster Vane", epithet: "first of the Conductors", era: "three millennia past", one_line: "wrote the spell that was meant to end death and ended the continents instead" },
        { name: "The Withered Oracle of Pellan", era: "before the Discord", one_line: "foretold the fork and was executed for the phrasing, not the content" },
        { name: "Sella of the Eighth", era: "nine hundred winters past", one_line: "led the octave that was cut out of the Chorus's own sigil" },
      ],
      brokenOaths: [
        { title: "The Conservatory Concord", era: "three millennia past", one_line: "the magic-users swore never to touch the fundamental chords, and then did, together, on the same night" },
        { title: "The Kneeling at Bastion", era: "nine hundred winters past", one_line: "Aethelgard swore its Emperors would kneel to the Chorus in perpetuity, and has been looking for the exit ever since" },
      ],
      fallenOrders: [
        { title: "The Eighth Octave", era: "nine hundred winters past", one_line: "struck from the record so completely that the banner was re-woven with one string fewer" },
        { title: "The Chain-Wardens of Pellan", era: "six hundred winters past", one_line: "measured the Dead Zones for a living until the office was quietly defunded" },
      ],
      lostPlaces: [
        { title: "The Drowned Conservatory", era: "three millennia past", one_line: "sank in a night and has not stopped sounding since" },
        { title: "Corran's Reach", era: "eleven winters past", one_line: "the first village the Quiet Margin took; it is not on the current maps and never was on the amended ones" },
      ],
      cosmology:
        "Vespera does not turn, it plays. Matter, weather, memory and soul are held in one composition called the Symphony; what feels like time is only position within it. The Major Scale governs order and creation, the Minor chaos and decay, and both were whole until the Discord tainted the second. Where the Symphony stops playing entirely, a Dead Zone opens: sound arrives late, light thins, and living things warp. The Quiet is not an enemy of the Symphony. It is the rest at the end of it.",
    },
    worldHorizon:
      "The chronicle bends toward the moment the Symphony's final chord is struck deliberately, by someone who believes they are saving it. Everything else — the march, the margin, the boy — is the argument over whose hand is on the fork.",
    createdAt: now,
    updatedAt: now,
  };

  db.insertWorld(world);
  for (const l of locations) db.insertLocation({ ...l, worldId: WORLD_ID });
  for (const f of factions) db.insertFaction({ ...f, worldId: WORLD_ID });
  for (const c of characters) db.insertCharacter({ alive: true, ...c, worldId: WORLD_ID });
  for (const r of relationships) db.upsertRelationship({ ...r, worldId: WORLD_ID });
  for (const p of plots) db.insertPlot({ ...p, worldId: WORLD_ID });
  for (const p of prophecies) db.insertProphecy({ ...p, worldId: WORLD_ID });
  for (const e of entries) {
    db.insertEntry({ ...e, worldId: WORLD_ID, createdAt: now });
    db.logTick(WORLD_ID, e.tick, true, 0, "seeded by seed-demo (no model call)");
  }

  // A few memories and rumours so the character pages and locations are not bare.
  db.insertMemory({ id: randomUUID(), worldId: WORLD_ID, characterId: "chr-elian", weight: 0.9, text: "The rot going out of the barley like heat out of a stone, and my father asking to see my arms.", tickLearned: 1 });
  db.insertMemory({ id: randomUUID(), worldId: WORLD_ID, characterId: "chr-mira", weight: 0.85, text: "Stopping at nineteen sheaves, and nobody asking me anything afterwards.", tickLearned: 1 });
  db.insertMemory({ id: randomUUID(), worldId: WORLD_ID, characterId: "chr-siara", weight: 0.8, text: "Two hundred and six in the first century. Four in the last decade. Brother Oren saying he had never thought it survivable.", tickLearned: 3 });
  db.insertMemory({ id: randomUUID(), worldId: WORLD_ID, characterId: "chr-hale", weight: 0.75, text: "An hour of standing in the fitted silence, and two men who would not take the helm off.", tickLearned: 2 });
  db.insertRumor({ id: randomUUID(), worldId: WORLD_ID, locationId: "loc-sable-house", text: "A field in the south came back from the rot in an afternoon, and the boy who did it is still walking about with his own skin on.", truth: 0.9, tickPlanted: 2 });
  db.insertRumor({ id: randomUUID(), worldId: WORLD_ID, locationId: "loc-tithe-road", text: "The Red Octave has taken nobody in four years because there is nobody left to take.", truth: 0.4, tickPlanted: 3 });
  db.insertRumor({ id: randomUUID(), worldId: WORLD_ID, locationId: "loc-cinder-wastes", text: "The third crossing-song has a note in it that was not there when the elders learned it.", truth: 1, tickPlanted: 4 });

  console.log(`Seeded "${world.name}" as ${WORLD_ID} at ${cfg.dbPath}`);
  console.log(
    `  ${locations.length} locations · ${factions.length} factions · ${characters.length} characters · ` +
      `${plots.length} plots · ${prophecies.length} prophecies · ${entries.length} chronicle entries`,
  );
  console.log(`\nNow run:  npm run dev:web   →  http://localhost:3000/world/${WORLD_ID}`);
}

main();
