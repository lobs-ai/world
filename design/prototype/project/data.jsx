// data.jsx — the kingdom of Aelmere. The king has been dying for forty years.

const WORLD = {
  name: "Aelmere",
  premise: "A kingdom where the king has been dying for forty years.",
  tone: "grimdark",
  themes: ["the long shadow of an unending vigil", "inheritance deferred", "small mercies told as lies"],
  inWorldDate: "The third evening after the Feast of Lanterns, in the forty-first year of King Oren's long sickness.",
  era: "The Year of the Owl, being the four-and-fortieth of King Oren the Patient, called also the Lingering.",
  ageOfWorld: "Day 168 since the chronicle began.",
};

// ─── Characters ──────────────────────────────────────────────
const CHARACTERS = {
  oren: {
    id: "oren",
    name: "King Oren",
    epithet: "the Patient, the Lingering",
    age: 71,
    where: "highkeep",
    portrait: "An old face on a pillow",
    summary: "Crowned at twenty-six. Stricken at thirty. Has not risen unaided in fourteen years and has not spoken plainly in three.",
    mood: { dominant: "fading", valence: -0.4, arousal: 0.05 },
    desires: [
      { goal: "to see the orchard he planted at his coronation", intensity: 0.8 },
      { goal: "to give one true command before the end", intensity: 0.6 },
    ],
    traits: { devout: 0.7, stubborn: 0.9, kind: 0.6 },
    relations: [],
    alive: true,
  },
  margreth: {
    id: "margreth",
    name: "Queen Regent Margreth",
    epithet: "the Steward, called by some the Widow-in-Waiting",
    age: 64,
    where: "highkeep",
    portrait: "A woman in dark wool, hands inked",
    summary: "Has signed every writ of the realm for thirty-eight years. Cannot remember the shape of a day in which she was not regent.",
    mood: { dominant: "iron weariness", valence: -0.2, arousal: 0.3 },
    desires: [
      { goal: "to keep the realm whole until her son is ready", intensity: 0.9 },
      { goal: "to hear her husband's voice once more", intensity: 0.7 },
      { goal: "(unspoken) to be released", intensity: 0.5 },
    ],
    traits: { shrewd: 0.9, devout: 0.4, vengeful: 0.3, weary: 0.95 },
  },
  caelin: {
    id: "caelin",
    name: "Prince Caelin",
    epithet: "the Heir, the Boy-Who-Aged",
    age: 44,
    where: "highkeep",
    portrait: "A man with the bearing of a boy",
    summary: "Was four when his father took to the bed. Older now than his father at coronation. Has been heir to a throne longer than most men have been alive.",
    mood: { dominant: "a slow rage that he mistakes for patience", valence: -0.5, arousal: 0.6 },
    desires: [
      { goal: "to be king while there is still something of him to be king", intensity: 0.95 },
      { goal: "to forgive his mother", intensity: 0.4 },
    ],
    traits: { proud: 0.7, learned: 0.8, brittle: 0.6 },
  },
  hesper: {
    id: "hesper",
    name: "Hesper of the Black Door",
    epithet: "First Healer, called the Liar-by-Mercy",
    age: 58,
    where: "highkeep",
    portrait: "A woman with stained fingers",
    summary: "Has told the court the king was 'gravely improved' for thirty-one consecutive winters. Knows precisely what is keeping him alive, and what would not.",
    mood: { dominant: "the calm of long complicity", valence: -0.1, arousal: 0.2 },
    desires: [
      { goal: "to stop telling the lie", intensity: 0.85 },
      { goal: "to die before the king does", intensity: 0.7 },
    ],
    traits: { cunning: 0.85, devout: 0.2, kind: 0.7, complicit: 1.0 },
  },
  vael: {
    id: "vael",
    name: "Lord Vael of the Marsh",
    epithet: "the Patient Wolf",
    age: 49,
    where: "marshhold",
    portrait: "A long man on a thin horse",
    summary: "Has been quietly preparing to be the next king for twenty years. Believes Caelin is unfit. Believes himself reasonable.",
    mood: { dominant: "a banked, cordial fury", valence: -0.3, arousal: 0.7 },
    desires: [
      { goal: "to be acclaimed before Caelin can be crowned", intensity: 0.95 },
    ],
    traits: { ambitious: 1.0, charming: 0.7, devout: 0.5 },
  },
  irela: {
    id: "irela",
    name: "Sister Irela",
    epithet: "Anchoress of the Owl",
    age: 33,
    where: "owlcot",
    portrait: "A young woman in grey",
    summary: "Has dreamt the king's death thrice this season. Is unsure whether the dreams are prophecy or longing.",
    mood: { dominant: "watchful dread", valence: -0.2, arousal: 0.55 },
    desires: [
      { goal: "to know whether her gift is from heaven", intensity: 0.8 },
    ],
    traits: { devout: 0.95, doubting: 0.6, kind: 0.85 },
  },
  fenwick: {
    id: "fenwick",
    name: "Fenwick the Younger",
    epithet: "Apprentice Healer",
    age: 22,
    where: "highkeep",
    portrait: "A boy with new spectacles",
    summary: "Was given Hesper's keys last winter. Has begun to ask questions she has spent a lifetime not answering.",
    mood: { dominant: "appalled curiosity", valence: 0.0, arousal: 0.6 },
    desires: [
      { goal: "to know what is in the third cabinet", intensity: 0.9 },
    ],
    traits: { curious: 0.9, devout: 0.5, brave: 0.5 },
  },
};

// ─── Locations ──────────────────────────────────────────────
const LOCATIONS = {
  highkeep: {
    id: "highkeep", name: "The Highkeep at Aelmere", type: "capital",
    description: "A pale stone keep set on a chalk bluff above the river Owl. Its highest tower has not had a candle lit in it for forty winters; the king's window faces only east.",
    weather: "low cloud; smell of woodsmoke and lye",
    residents: ["oren","margreth","caelin","hesper","fenwick"],
    rumors: [
      { text: "The king sat up unaided at the Feast of Lanterns and asked after the orchard.", truth: 0.65 },
      { text: "The Queen Regent has not slept in her own bed since last Saint Anwen's.", truth: 0.95 },
      { text: "There is a third cabinet in the Healer's room that has not been opened in eleven years.", truth: 0.85 },
    ],
  },
  marshhold: {
    id: "marshhold", name: "Marshhold", type: "town",
    description: "A wet, low town in the south. The lord's table has been set for seven extra guests every night for a decade; no one says why.",
    weather: "fog that smells faintly of iron",
    residents: ["vael"],
    rumors: [
      { text: "Lord Vael's banner-master rode north on the night of the Lanterns.", truth: 0.9 },
      { text: "The marsh is rising, slowly, by a finger's breadth a year.", truth: 0.7 },
    ],
  },
  owlcot: {
    id: "owlcot", name: "Owlcot Anchorage", type: "ruin",
    description: "Three stone cells built against the east face of a cliff. An owl has nested in the chapel rafters for as long as anyone living can remember.",
    weather: "wind from the sea",
    residents: ["irela"],
    rumors: [
      { text: "The Anchoress wakes screaming on the third night of every month.", truth: 0.6 },
    ],
  },
  orchard: {
    id: "orchard", name: "The King's Orchard", type: "wilderness",
    description: "Forty-one rows of pear trees planted at King Oren's coronation. They have borne fruit every year of his sickness and have not been pruned in seventeen.",
    weather: "still air; bees",
    residents: [],
    rumors: [],
  },
  bell: {
    id: "bell", name: "The Bell & Buckle", type: "village",
    description: "An inn on the road between the Highkeep and Marshhold. Travellers stop here and exchange the only news there is: that the king is no better, and no worse.",
    weather: "rain on slate",
    residents: [],
    rumors: [
      { text: "A grey rider was seen at the Bell & Buckle who would not give his name.", truth: 0.55 },
    ],
  },
};

// ─── Plots ──────────────────────────────────────────────
const PLOTS = {
  succession: {
    id: "succession",
    title: "The Long Succession",
    state: "rising",
    tension: 0.78,
    arc: "Caelin will demand a regency review at the next council. Margreth will refuse. Vael's banner-master is already on the road.",
    central: ["caelin","margreth","vael"],
    themes: ["inheritance deferred","a son becoming his father's age"],
    hooks: [
      "A grey rider was seen at the Bell & Buckle.",
      "Caelin asked his tutor, this season, the date of his own birth.",
      "The Queen Regent has begun signing some writs only with her name.",
    ],
    beats: [
      { tick: 102, type: "setup",        title: "A son counts the years",        when: "the autumn of the fortieth year",        sketch: "Caelin asks his tutor for the date of his own birth and is given it." },
      { tick: 118, type: "complication", title: "The Patient Wolf writes south", when: "the eve of Saint Anwen's",                sketch: "Lord Vael's banner-master rides from Marshhold under cover of mist." },
      { tick: 141, type: "rising",       title: "A writ unsigned",               when: "the second week after the harvest",       sketch: "Margreth signs a tax-writ with her own name only and does not invoke the king's seal." },
      { tick: 161, type: "rising",       title: "The orchard, asked after",      when: "the Feast of Lanterns",                   sketch: "The king, against all expectation, asks after the orchard. Caelin hears." },
      { tick: 168, type: "rising",       title: "A council called",              when: "the third evening after the Lanterns",    sketch: "Caelin sends to all the houses for a council to be held within the month.", current: true },
    ],
  },
  cabinet: {
    id: "cabinet",
    title: "The Third Cabinet",
    state: "setup",
    tension: 0.42,
    arc: "Fenwick will open the third cabinet. What he finds will explain why the king has not died, and will leave him unable to keep the lie.",
    central: ["hesper","fenwick"],
    themes: ["small mercies told as lies","inheritance of a secret"],
    hooks: [
      "There is a third cabinet in the Healer's room.",
      "The keys to the inner stores were given over last winter.",
    ],
    beats: [
      { tick: 88,  type: "setup",        title: "Keys, given over", when: "midwinter", sketch: "Hesper gives the apprentice her keys, all but one." },
      { tick: 134, type: "setup",        title: "A question, asked",when: "early spring", sketch: "Fenwick asks Hesper what is in the cabinet she keeps. She answers him with a story about a horse." },
      { tick: 165, type: "complication", title: "The story, doubted",when: "the Feast of Lanterns", sketch: "Fenwick finds a ledger that contradicts the story.", current: true },
    ],
  },
  dreams: {
    id: "dreams",
    title: "The Anchoress's Dreams",
    state: "setup",
    tension: 0.31,
    arc: "Irela will come to the Highkeep. She will be received either as a saint or as a fraud, depending on whether the king dies that week.",
    central: ["irela","margreth"],
    themes: ["prophecy as longing"],
    hooks: ["The Anchoress wakes screaming on the third night of every month."],
    beats: [
      { tick: 144, type: "setup", title: "The first dream", when: "high summer", sketch: "Irela dreams the king's death and wakes in tears, then in confusion." },
      { tick: 159, type: "setup", title: "The third dream", when: "the eve of the Lanterns", sketch: "Irela dreams the same death again, and writes to the Highkeep.", current: true },
    ],
  },
};

// ─── Chronicle entries ──────────────────────────────────────
// Most recent first. Each entry is one tick.
const CHRONICLE = [
  {
    id: "e168",
    inWorldDate: "The third evening after the Feast of Lanterns",
    timeOfDay: "at the hour of vespers",
    weather: "low cloud, river fog",
    title: "A Council Called",
    plotIds: ["succession"],
    locationIds: ["highkeep"],
    characterIds: ["caelin","margreth"],
    paragraphs: [
      { kind: "scene", text: "In the long gallery at the {place:highkeep|Highkeep}, where the lamps had been trimmed twice and still smoked, {char:caelin|the Prince} set down the cup he had not drunk from. Forty winters of pear-blossom on the painted ceiling looked down on him; he was older now, by some accounting, than the man who had ordered them painted." },
      { kind: "scene", text: "{char:margreth|His mother} did not look up from her writing. She had been signing the year's last harvest-writs since before the bells, and her hand was steady, as it had been steady through the reigns of three popes and the deaths of seven of her sisters." },
      { kind: "dialogue", who: "caelin", text: "“It will be a council, madam. Within the month.”" },
      { kind: "scene", text: "Her quill did not stop. The room was very quiet for the time it takes a candle to gutter and right itself." },
      { kind: "dialogue", who: "margreth", text: "“It will be no council, my heart, while your father lives.”" },
      { kind: "scene", text: "He had not been called my heart in nineteen years. He took it like a struck blow and did not speak of it. Outside, on the road south, a {thread:succession|grey rider} was already past the {place:bell|Bell & Buckle} and would not stop again until {place:marshhold|Marshhold}." },
    ],
  },
  {
    id: "e167",
    inWorldDate: "The second evening after the Feast of Lanterns",
    timeOfDay: "after compline",
    weather: "still air, smoke",
    title: "A Story About a Horse",
    plotIds: ["cabinet"],
    locationIds: ["highkeep"],
    characterIds: ["hesper","fenwick"],
    paragraphs: [
      { kind: "scene", text: "{char:fenwick|The apprentice} had read the ledger four times, and the fourth time he had laid his hand flat upon the page as if to keep it from leaving. {char:hesper|The First Healer} watched him from the doorway and did not come in." },
      { kind: "dialogue", who: "fenwick", text: "“You said the cabinet held the green draughts. The book says otherwise.”" },
      { kind: "dialogue", who: "hesper", text: "“The book is older than I am. There was a horse — ”" },
      { kind: "dialogue", who: "fenwick", text: "“No, mistress. There was no horse.”" },
      { kind: "scene", text: "She closed the door behind herself with great care. There were two questions she might answer truthfully tonight, and one she had spent thirty-one winters not asking. She chose the smallest of the three, and for the first time in his apprenticeship, the boy did not believe her at all." },
    ],
  },
  {
    id: "e166",
    inWorldDate: "The morning after the Feast of Lanterns",
    timeOfDay: "the hour of prime",
    weather: "low sun, dew",
    title: "The Orchard, Asked After",
    plotIds: ["succession"],
    locationIds: ["highkeep","orchard"],
    characterIds: ["oren","margreth","caelin"],
    paragraphs: [
      { kind: "scene", text: "The {char:oren|king} woke speaking. The word was {place:orchard|orchard}, said clearly, said twice, and afterwards he closed his eyes again as if the labour had been considerable. {char:margreth|The Queen Regent} stood at the window with her face away from the bed and counted, as she had taught herself to count, to twelve." },
      { kind: "scene", text: "{char:caelin|The prince} was in the antechamber and heard the word through the door. He did not enter. He had been told as a boy that the orchard was his father's particular love; he had not seen it himself in eleven years." },
      { kind: "scene", text: "Outside, in the rows that no one had pruned, the bees were already at the late blossom." },
    ],
  },
  {
    id: "e165",
    inWorldDate: "The eve of the Lanterns",
    timeOfDay: "after dark",
    weather: "wind off the sea",
    title: "The Third Dream",
    plotIds: ["dreams"],
    locationIds: ["owlcot"],
    characterIds: ["irela"],
    paragraphs: [
      { kind: "scene", text: "{char:irela|The anchoress} dreamt, for the third time that season, the same death. She woke in the cold and lit no candle, and sat at her writing-desk in the dark until her hand had stopped shaking enough to write." },
      { kind: "dialogue", who: "irela", text: "“To Her Grace the Queen Regent, from the cell at {place:owlcot|Owlcot}: I have seen a thing thrice now, and the third time is the time it must be told.”" },
      { kind: "scene", text: "The owl in the rafters did not stir. It had heard her wake before." },
    ],
  },
  {
    id: "e164",
    inWorldDate: "The Feast of Lanterns",
    timeOfDay: "evening",
    weather: "lantern-light, river mist",
    title: "An Unsigned Writ",
    plotIds: ["succession"],
    locationIds: ["highkeep"],
    characterIds: ["margreth"],
    paragraphs: [
      { kind: "scene", text: "There was a writ for the harvest-tithes of the western shires that wanted the king's seal. {char:margreth|The Queen Regent} signed it, instead, with her name only, and watched the wax cool without the king's mark beneath it." },
      { kind: "scene", text: "It was a very small thing. She had signed in his place every day for thirty-eight years. But her name alone, on a tax-writ, was a thing the realm had not seen, and she sent it south by the next courier without looking at it again." },
    ],
  },
  {
    id: "e163",
    inWorldDate: "Eve of the Lanterns",
    timeOfDay: "near midnight",
    weather: "fog",
    title: "A Banner-Master Rides",
    plotIds: ["succession"],
    locationIds: ["marshhold","bell"],
    characterIds: ["vael"],
    paragraphs: [
      { kind: "scene", text: "{char:vael|Lord Vael} stood at his window and watched his {thread:succession|banner-master} cross the causeway with two riders behind him. He did not lift his hand in farewell; the man knew the road." },
      { kind: "scene", text: "By the bells of the {place:bell|Bell & Buckle}, the riders had passed without stopping, and a maid there said afterwards that the lead rider had eyes of a colour she could not name." },
    ],
  },
];

// quiet ambient lines — one-liners surfacing between entries
const AMBIENT = [
  "A storm settled over the western shires and did not move for two days.",
  "The river Owl was found, that morning, to have changed its bed by a finger's breadth.",
  "An owl was heard inside the keep itself, which had not been heard in living memory.",
  "The bees did not leave the orchard that night.",
];

// expose
window.WORLD = WORLD;
window.CHARACTERS = CHARACTERS;
window.LOCATIONS = LOCATIONS;
window.PLOTS = PLOTS;
window.CHRONICLE = CHRONICLE;
window.AMBIENT = AMBIENT;
