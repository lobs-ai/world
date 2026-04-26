// SQLite-backed repository. The DB file is the source of truth; nothing
// caches reads beyond a single tick.

import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Character,
  ChronicleEntry,
  DeepHistory,
  Faction,
  Location,
  Memory,
  Plot,
  PlotBeat,
  Prophecy,
  Relationship,
  Rumor,
  World,
  WorldId,
} from "../world/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface Db {
  raw: Database.Database;
  insertWorld(w: World): void;
  getWorld(id: WorldId): World | null;
  bumpWorldTick(id: WorldId, newDate: string): number;
  listWorlds(): World[];

  insertLocation(l: Location): void;
  listLocations(worldId: WorldId): Location[];
  getLocation(worldId: WorldId, id: string): Location | null;

  insertCharacter(c: Character): void;
  updateCharacter(c: Character): void;
  listCharacters(worldId: WorldId): Character[];
  getCharacter(worldId: WorldId, id: string): Character | null;

  upsertRelationship(r: Relationship): void;
  listRelationshipsFrom(worldId: WorldId, fromId: string): Relationship[];
  listRelationshipsAll(worldId: WorldId): Relationship[];

  insertPlot(p: Plot): void;
  updatePlot(p: Plot): void;
  listPlots(worldId: WorldId): Plot[];
  getPlot(worldId: WorldId, id: string): Plot | null;
  appendBeat(worldId: WorldId, plotId: string, beat: PlotBeat): void;

  insertFaction(f: Faction): void;
  updateFaction(f: Faction): void;
  listFactions(worldId: WorldId): Faction[];
  getFaction(worldId: WorldId, id: string): Faction | null;

  insertProphecy(p: Prophecy): void;
  updateProphecy(p: Prophecy): void;
  listProphecies(worldId: WorldId): Prophecy[];
  getProphecy(worldId: WorldId, id: string): Prophecy | null;

  insertMemory(m: Memory): void;
  listMemories(worldId: WorldId, characterId: string): Memory[];
  decayMemories(worldId: WorldId, factor: number): void;

  insertRumor(r: Rumor): void;
  listRumors(worldId: WorldId, locationId: string): Rumor[];

  insertEntry(e: ChronicleEntry): void;
  listEntries(worldId: WorldId, limit?: number): ChronicleEntry[];

  logTick(
    worldId: WorldId,
    tick: number,
    ok: boolean,
    durationMs: number,
    notes: string,
  ): void;
}

// SQLite ALTER TABLE has no IF NOT EXISTS, so we look up table_info.
function ensureColumn(
  raw: Database.Database,
  table: string,
  column: string,
  ddl: string,
): void {
  const rows = raw
    .prepare(`PRAGMA table_info(${table})`)
    .all() as { name: string }[];
  if (!rows.some((r) => r.name === column)) {
    raw.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

function migrate(raw: Database.Database): void {
  // additive migrations for DBs created before the spine/factions/prophecies
  // expansion. New columns get safe defaults so existing rows stay valid.
  ensureColumn(raw, "worlds", "deep_history", "deep_history TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(raw, "characters", "weight", "weight TEXT NOT NULL DEFAULT 'principal'");
  ensureColumn(raw, "characters", "faction_id", "faction_id TEXT");
  ensureColumn(raw, "characters", "secrets", "secrets TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(raw, "plots", "tier", "tier TEXT NOT NULL DEFAULT 'subplot'");
  ensureColumn(raw, "plots", "faction_ids", "faction_ids TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(raw, "plots", "last_advanced_tick", "last_advanced_tick INTEGER NOT NULL DEFAULT 0");
  ensureColumn(raw, "chronicle_entries", "beat_type", "beat_type TEXT NOT NULL DEFAULT 'rising'");
  ensureColumn(raw, "chronicle_entries", "faction_ids", "faction_ids TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(raw, "chronicle_entries", "prophecy_ids", "prophecy_ids TEXT NOT NULL DEFAULT '[]'");
}

const EMPTY_DEEP_HISTORY: DeepHistory = {
  ancients: [],
  brokenOaths: [],
  fallenOrders: [],
  lostPlaces: [],
  cosmology: "",
};

export function openDb(path: string): Db {
  const raw = new Database(path);
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");
  const schema = readFileSync(resolve(__dirname, "schema.sql"), "utf8");
  raw.exec(schema);
  migrate(raw);

  const j = (v: unknown): string => JSON.stringify(v ?? null);
  const p = <T,>(s: string | null | undefined): T => JSON.parse(s ?? "null") as T;
  const pOr = <T,>(s: string | null | undefined, fallback: T): T => {
    if (!s) return fallback;
    try {
      const v = JSON.parse(s) as T | null;
      return v ?? fallback;
    } catch {
      return fallback;
    }
  };

  // ── worlds ─────────────────────────────────────────────────────────────
  const stmtInsertWorld = raw.prepare(`
    INSERT INTO worlds (id, name, premise, tone, themes, era, in_world_date, tick, deep_history, created_at, updated_at)
    VALUES (@id, @name, @premise, @tone, @themes, @era, @inWorldDate, @tick, @deepHistory, @createdAt, @updatedAt)
  `);

  const stmtGetWorld = raw.prepare(`SELECT * FROM worlds WHERE id = ?`);
  const stmtListWorlds = raw.prepare(
    `SELECT * FROM worlds ORDER BY created_at DESC`,
  );
  const stmtBumpTick = raw.prepare(
    `UPDATE worlds SET tick = tick + 1, in_world_date = ?, updated_at = ? WHERE id = ?`,
  );

  // ── locations ──────────────────────────────────────────────────────────
  const stmtInsertLocation = raw.prepare(`
    INSERT INTO locations (id, world_id, name, type, description, weather)
    VALUES (@id, @worldId, @name, @type, @description, @weather)
  `);
  const stmtListLocations = raw.prepare(
    `SELECT * FROM locations WHERE world_id = ? ORDER BY name`,
  );
  const stmtGetLocation = raw.prepare(
    `SELECT * FROM locations WHERE world_id = ? AND id = ?`,
  );

  // ── characters ─────────────────────────────────────────────────────────
  const stmtInsertCharacter = raw.prepare(`
    INSERT INTO characters (id, world_id, name, epithet, age, where_id, weight, faction_id, portrait, summary, mood, desires, traits, alive, secrets)
    VALUES (@id, @worldId, @name, @epithet, @age, @whereId, @weight, @factionId, @portrait, @summary, @mood, @desires, @traits, @alive, @secrets)
  `);
  const stmtUpdateCharacter = raw.prepare(`
    UPDATE characters SET
      name=@name, epithet=@epithet, age=@age, where_id=@whereId,
      weight=@weight, faction_id=@factionId,
      portrait=@portrait, summary=@summary, mood=@mood, desires=@desires,
      traits=@traits, alive=@alive, secrets=@secrets
    WHERE world_id=@worldId AND id=@id
  `);
  const stmtListCharacters = raw.prepare(
    `SELECT * FROM characters WHERE world_id = ? ORDER BY
       CASE weight WHEN 'principal' THEN 0 WHEN 'secondary' THEN 1 ELSE 2 END,
       name`,
  );
  const stmtGetCharacter = raw.prepare(
    `SELECT * FROM characters WHERE world_id = ? AND id = ?`,
  );

  // ── relationships ──────────────────────────────────────────────────────
  const stmtUpsertRel = raw.prepare(`
    INSERT INTO relationships (world_id, from_id, to_id, type_from_me, affection, trust, note)
    VALUES (@worldId, @fromId, @toId, @typeFromMe, @affection, @trust, @note)
    ON CONFLICT(world_id, from_id, to_id)
    DO UPDATE SET
      type_from_me = excluded.type_from_me,
      affection    = excluded.affection,
      trust        = excluded.trust,
      note         = excluded.note
  `);
  const stmtListRelFrom = raw.prepare(
    `SELECT * FROM relationships WHERE world_id = ? AND from_id = ?`,
  );
  const stmtListRelAll = raw.prepare(
    `SELECT * FROM relationships WHERE world_id = ?`,
  );

  // ── plots ──────────────────────────────────────────────────────────────
  const stmtInsertPlot = raw.prepare(`
    INSERT INTO plots (id, world_id, title, tier, state, tension, arc, central, faction_ids, themes, hooks, beats, last_advanced_tick)
    VALUES (@id, @worldId, @title, @tier, @state, @tension, @arc, @central, @factionIds, @themes, @hooks, @beats, @lastAdvancedTick)
  `);
  const stmtUpdatePlot = raw.prepare(`
    UPDATE plots SET
      title=@title, tier=@tier, state=@state, tension=@tension, arc=@arc,
      central=@central, faction_ids=@factionIds,
      themes=@themes, hooks=@hooks, beats=@beats,
      last_advanced_tick=@lastAdvancedTick
    WHERE world_id=@worldId AND id=@id
  `);
  const stmtListPlots = raw.prepare(
    `SELECT * FROM plots WHERE world_id = ? ORDER BY
       CASE tier WHEN 'spine' THEN 0 WHEN 'subplot' THEN 1 ELSE 2 END,
       tension DESC`,
  );
  const stmtGetPlot = raw.prepare(
    `SELECT * FROM plots WHERE world_id = ? AND id = ?`,
  );

  // ── factions ───────────────────────────────────────────────────────────
  const stmtInsertFaction = raw.prepare(`
    INSERT INTO factions (id, world_id, name, banner, summary, themes, desires, tension, last_advanced_tick, seat_location_id)
    VALUES (@id, @worldId, @name, @banner, @summary, @themes, @desires, @tension, @lastAdvancedTick, @seatLocationId)
  `);
  const stmtUpdateFaction = raw.prepare(`
    UPDATE factions SET
      name=@name, banner=@banner, summary=@summary,
      themes=@themes, desires=@desires, tension=@tension,
      last_advanced_tick=@lastAdvancedTick, seat_location_id=@seatLocationId
    WHERE world_id=@worldId AND id=@id
  `);
  const stmtListFactions = raw.prepare(
    `SELECT * FROM factions WHERE world_id = ? ORDER BY tension DESC, name`,
  );
  const stmtGetFaction = raw.prepare(
    `SELECT * FROM factions WHERE world_id = ? AND id = ?`,
  );

  // ── prophecies ─────────────────────────────────────────────────────────
  const stmtInsertProphecy = raw.prepare(`
    INSERT INTO prophecies (id, world_id, text, source, planted_tick, target_payoff_min, target_payoff_max, status, echoes, related_plot_ids, related_character_ids, hidden_meaning)
    VALUES (@id, @worldId, @text, @source, @plantedTick, @targetPayoffMin, @targetPayoffMax, @status, @echoes, @relatedPlotIds, @relatedCharacterIds, @hiddenMeaning)
  `);
  const stmtUpdateProphecy = raw.prepare(`
    UPDATE prophecies SET
      text=@text, source=@source, planted_tick=@plantedTick,
      target_payoff_min=@targetPayoffMin, target_payoff_max=@targetPayoffMax,
      status=@status, echoes=@echoes,
      related_plot_ids=@relatedPlotIds, related_character_ids=@relatedCharacterIds,
      hidden_meaning=@hiddenMeaning
    WHERE world_id=@worldId AND id=@id
  `);
  const stmtListProphecies = raw.prepare(
    `SELECT * FROM prophecies WHERE world_id = ? ORDER BY
       CASE status WHEN 'unfulfilled' THEN 0 WHEN 'echoing' THEN 1 WHEN 'half_fulfilled' THEN 2 ELSE 3 END,
       planted_tick DESC`,
  );
  const stmtGetProphecy = raw.prepare(
    `SELECT * FROM prophecies WHERE world_id = ? AND id = ?`,
  );

  // ── memories ───────────────────────────────────────────────────────────
  const stmtInsertMemory = raw.prepare(`
    INSERT INTO memories (id, world_id, character_id, weight, text, tick_learned)
    VALUES (@id, @worldId, @characterId, @weight, @text, @tickLearned)
  `);
  const stmtListMemories = raw.prepare(
    `SELECT * FROM memories WHERE world_id = ? AND character_id = ? ORDER BY weight DESC`,
  );
  const stmtDecayMem = raw.prepare(
    `UPDATE memories SET weight = weight * ? WHERE world_id = ? AND weight > 0.05`,
  );

  // ── rumors ─────────────────────────────────────────────────────────────
  const stmtInsertRumor = raw.prepare(`
    INSERT INTO rumors (id, world_id, location_id, text, truth, tick_planted)
    VALUES (@id, @worldId, @locationId, @text, @truth, @tickPlanted)
  `);
  const stmtListRumors = raw.prepare(
    `SELECT * FROM rumors WHERE world_id = ? AND location_id = ? ORDER BY tick_planted DESC LIMIT 6`,
  );

  // ── chronicle ──────────────────────────────────────────────────────────
  const stmtInsertEntry = raw.prepare(`
    INSERT INTO chronicle_entries (id, world_id, tick, in_world_date, time_of_day, weather, title, beat_type, plot_ids, faction_ids, prophecy_ids, location_ids, character_ids, paragraphs, created_at)
    VALUES (@id, @worldId, @tick, @inWorldDate, @timeOfDay, @weather, @title, @beatType, @plotIds, @factionIds, @prophecyIds, @locationIds, @characterIds, @paragraphs, @createdAt)
  `);
  const stmtListEntries = raw.prepare(
    `SELECT * FROM chronicle_entries WHERE world_id = ? ORDER BY tick DESC LIMIT ?`,
  );

  const stmtLogTick = raw.prepare(`
    INSERT OR REPLACE INTO tick_log (world_id, tick, ok, duration_ms, notes, ran_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // ── row mappers ────────────────────────────────────────────────────────
  type WorldRow = {
    id: string; name: string; premise: string; tone: string;
    themes: string; era: string; in_world_date: string;
    tick: number; deep_history: string;
    created_at: string; updated_at: string;
  };
  const mapWorld = (r: WorldRow): World => ({
    id: r.id, name: r.name, premise: r.premise, tone: r.tone,
    themes: pOr<string[]>(r.themes, []), era: r.era, inWorldDate: r.in_world_date,
    tick: r.tick,
    deepHistory: pOr<DeepHistory>(r.deep_history, EMPTY_DEEP_HISTORY),
    createdAt: r.created_at, updatedAt: r.updated_at,
  });

  type LocRow = {
    id: string; world_id: string; name: string; type: Location["type"];
    description: string; weather: string;
  };
  const mapLocation = (r: LocRow): Location => ({
    id: r.id, worldId: r.world_id, name: r.name, type: r.type,
    description: r.description, weather: r.weather,
  });

  type CharRow = {
    id: string; world_id: string; name: string; epithet: string;
    age: number; where_id: string; weight: Character["weight"];
    faction_id: string | null;
    portrait: string; summary: string;
    mood: string; desires: string; traits: string; alive: number;
    secrets: string;
  };
  const mapCharacter = (r: CharRow): Character => ({
    id: r.id, worldId: r.world_id, name: r.name, epithet: r.epithet,
    age: r.age, where: r.where_id, weight: r.weight ?? "principal",
    factionId: r.faction_id ?? undefined,
    portrait: r.portrait, summary: r.summary,
    mood: p(r.mood), desires: p(r.desires), traits: p(r.traits),
    alive: r.alive === 1,
    secrets: pOr<string[]>(r.secrets, []),
  });

  type RelRow = {
    world_id: string; from_id: string; to_id: string; type_from_me: string;
    affection: number; trust: number; note: string;
  };
  const mapRel = (r: RelRow): Relationship => ({
    worldId: r.world_id, fromId: r.from_id, toId: r.to_id,
    typeFromMe: r.type_from_me, affection: r.affection, trust: r.trust, note: r.note,
  });

  type PlotRow = {
    id: string; world_id: string; title: string; tier: Plot["tier"];
    state: Plot["state"]; tension: number; arc: string;
    central: string; faction_ids: string;
    themes: string; hooks: string; beats: string;
    last_advanced_tick: number;
  };
  const mapPlot = (r: PlotRow): Plot => ({
    id: r.id, worldId: r.world_id, title: r.title,
    tier: r.tier ?? "subplot",
    state: r.state, tension: r.tension, arc: r.arc,
    central: pOr<string[]>(r.central, []),
    factionIds: pOr<string[]>(r.faction_ids, []),
    themes: pOr<string[]>(r.themes, []),
    hooks: pOr<string[]>(r.hooks, []),
    beats: pOr<PlotBeat[]>(r.beats, []),
    lastAdvancedTick: r.last_advanced_tick ?? 0,
  });

  type FactionRow = {
    id: string; world_id: string; name: string; banner: string;
    summary: string; themes: string; desires: string;
    tension: number; last_advanced_tick: number;
    seat_location_id: string | null;
  };
  const mapFaction = (r: FactionRow): Faction => ({
    id: r.id, worldId: r.world_id, name: r.name, banner: r.banner,
    summary: r.summary,
    themes: pOr<string[]>(r.themes, []),
    desires: pOr<Faction["desires"]>(r.desires, []),
    tension: r.tension, lastAdvancedTick: r.last_advanced_tick,
    seatLocationId: r.seat_location_id ?? undefined,
  });

  type ProphecyRow = {
    id: string; world_id: string; text: string; source: string;
    planted_tick: number; target_payoff_min: number; target_payoff_max: number;
    status: Prophecy["status"]; echoes: number;
    related_plot_ids: string; related_character_ids: string;
    hidden_meaning: string | null;
  };
  const mapProphecy = (r: ProphecyRow): Prophecy => ({
    id: r.id, worldId: r.world_id, text: r.text, source: r.source,
    plantedTick: r.planted_tick,
    targetPayoffMin: r.target_payoff_min, targetPayoffMax: r.target_payoff_max,
    status: r.status, echoes: r.echoes,
    relatedPlotIds: pOr<string[]>(r.related_plot_ids, []),
    relatedCharacterIds: pOr<string[]>(r.related_character_ids, []),
    hiddenMeaning: r.hidden_meaning ?? undefined,
  });

  type MemRow = {
    id: string; world_id: string; character_id: string;
    weight: number; text: string; tick_learned: number;
  };
  const mapMem = (r: MemRow): Memory => ({
    id: r.id, worldId: r.world_id, characterId: r.character_id,
    weight: r.weight, text: r.text, tickLearned: r.tick_learned,
  });

  type RumorRow = {
    id: string; world_id: string; location_id: string;
    text: string; truth: number; tick_planted: number;
  };
  const mapRumor = (r: RumorRow): Rumor => ({
    id: r.id, worldId: r.world_id, locationId: r.location_id,
    text: r.text, truth: r.truth, tickPlanted: r.tick_planted,
  });

  type EntryRow = {
    id: string; world_id: string; tick: number; in_world_date: string;
    time_of_day: string; weather: string; title: string;
    beat_type: ChronicleEntry["beatType"];
    plot_ids: string; faction_ids: string; prophecy_ids: string;
    location_ids: string; character_ids: string;
    paragraphs: string; created_at: string;
  };
  const mapEntry = (r: EntryRow): ChronicleEntry => ({
    id: r.id, worldId: r.world_id, tick: r.tick,
    inWorldDate: r.in_world_date, timeOfDay: r.time_of_day,
    weather: r.weather, title: r.title,
    beatType: r.beat_type ?? "rising",
    plotIds: pOr<string[]>(r.plot_ids, []),
    factionIds: pOr<string[]>(r.faction_ids, []),
    prophecyIds: pOr<string[]>(r.prophecy_ids, []),
    locationIds: pOr<string[]>(r.location_ids, []),
    characterIds: pOr<string[]>(r.character_ids, []),
    paragraphs: pOr<ChronicleEntry["paragraphs"]>(r.paragraphs, []),
    createdAt: r.created_at,
  });

  return {
    raw,
    insertWorld(w) {
      stmtInsertWorld.run({
        ...w,
        themes: j(w.themes),
        deepHistory: j(w.deepHistory),
      });
    },
    getWorld(id) {
      const r = stmtGetWorld.get(id) as WorldRow | undefined;
      return r ? mapWorld(r) : null;
    },
    listWorlds() {
      return (stmtListWorlds.all() as WorldRow[]).map(mapWorld);
    },
    bumpWorldTick(id, newDate) {
      stmtBumpTick.run(newDate, new Date().toISOString(), id);
      const r = stmtGetWorld.get(id) as WorldRow;
      return r.tick;
    },
    insertLocation(l) {
      stmtInsertLocation.run(l);
    },
    listLocations(worldId) {
      return (stmtListLocations.all(worldId) as LocRow[]).map(mapLocation);
    },
    getLocation(worldId, id) {
      const r = stmtGetLocation.get(worldId, id) as LocRow | undefined;
      return r ? mapLocation(r) : null;
    },
    insertCharacter(c) {
      stmtInsertCharacter.run({
        ...c,
        whereId: c.where, alive: c.alive ? 1 : 0,
        factionId: c.factionId ?? null,
        mood: j(c.mood), desires: j(c.desires), traits: j(c.traits),
        secrets: j(c.secrets ?? []),
      });
    },
    updateCharacter(c) {
      stmtUpdateCharacter.run({
        ...c,
        whereId: c.where, alive: c.alive ? 1 : 0,
        factionId: c.factionId ?? null,
        mood: j(c.mood), desires: j(c.desires), traits: j(c.traits),
        secrets: j(c.secrets ?? []),
      });
    },
    listCharacters(worldId) {
      return (stmtListCharacters.all(worldId) as CharRow[]).map(mapCharacter);
    },
    getCharacter(worldId, id) {
      const r = stmtGetCharacter.get(worldId, id) as CharRow | undefined;
      return r ? mapCharacter(r) : null;
    },
    upsertRelationship(r) {
      stmtUpsertRel.run(r);
    },
    listRelationshipsFrom(worldId, fromId) {
      return (stmtListRelFrom.all(worldId, fromId) as RelRow[]).map(mapRel);
    },
    listRelationshipsAll(worldId) {
      return (stmtListRelAll.all(worldId) as RelRow[]).map(mapRel);
    },
    insertPlot(pl) {
      stmtInsertPlot.run({
        ...pl,
        central: j(pl.central),
        factionIds: j(pl.factionIds),
        themes: j(pl.themes),
        hooks: j(pl.hooks),
        beats: j(pl.beats),
      });
    },
    updatePlot(pl) {
      stmtUpdatePlot.run({
        ...pl,
        central: j(pl.central),
        factionIds: j(pl.factionIds),
        themes: j(pl.themes),
        hooks: j(pl.hooks),
        beats: j(pl.beats),
      });
    },
    listPlots(worldId) {
      return (stmtListPlots.all(worldId) as PlotRow[]).map(mapPlot);
    },
    getPlot(worldId, id) {
      const r = stmtGetPlot.get(worldId, id) as PlotRow | undefined;
      return r ? mapPlot(r) : null;
    },
    appendBeat(worldId, plotId, beat) {
      const pl = this.getPlot(worldId, plotId);
      if (!pl) throw new Error(`plot ${plotId} not found`);
      pl.beats = [...pl.beats, beat];
      this.updatePlot(pl);
    },
    insertFaction(f) {
      stmtInsertFaction.run({
        ...f,
        seatLocationId: f.seatLocationId ?? null,
        themes: j(f.themes), desires: j(f.desires),
      });
    },
    updateFaction(f) {
      stmtUpdateFaction.run({
        ...f,
        seatLocationId: f.seatLocationId ?? null,
        themes: j(f.themes), desires: j(f.desires),
      });
    },
    listFactions(worldId) {
      return (stmtListFactions.all(worldId) as FactionRow[]).map(mapFaction);
    },
    getFaction(worldId, id) {
      const r = stmtGetFaction.get(worldId, id) as FactionRow | undefined;
      return r ? mapFaction(r) : null;
    },
    insertProphecy(pr) {
      stmtInsertProphecy.run({
        ...pr,
        hiddenMeaning: pr.hiddenMeaning ?? null,
        relatedPlotIds: j(pr.relatedPlotIds),
        relatedCharacterIds: j(pr.relatedCharacterIds),
      });
    },
    updateProphecy(pr) {
      stmtUpdateProphecy.run({
        ...pr,
        hiddenMeaning: pr.hiddenMeaning ?? null,
        relatedPlotIds: j(pr.relatedPlotIds),
        relatedCharacterIds: j(pr.relatedCharacterIds),
      });
    },
    listProphecies(worldId) {
      return (stmtListProphecies.all(worldId) as ProphecyRow[]).map(mapProphecy);
    },
    getProphecy(worldId, id) {
      const r = stmtGetProphecy.get(worldId, id) as ProphecyRow | undefined;
      return r ? mapProphecy(r) : null;
    },
    insertMemory(m) {
      stmtInsertMemory.run(m);
    },
    listMemories(worldId, characterId) {
      return (stmtListMemories.all(worldId, characterId) as MemRow[]).map(mapMem);
    },
    decayMemories(worldId, factor) {
      stmtDecayMem.run(factor, worldId);
    },
    insertRumor(r) {
      stmtInsertRumor.run(r);
    },
    listRumors(worldId, locationId) {
      return (stmtListRumors.all(worldId, locationId) as RumorRow[]).map(mapRumor);
    },
    insertEntry(e) {
      stmtInsertEntry.run({
        ...e,
        plotIds: j(e.plotIds),
        factionIds: j(e.factionIds),
        prophecyIds: j(e.prophecyIds),
        locationIds: j(e.locationIds),
        characterIds: j(e.characterIds),
        paragraphs: j(e.paragraphs),
      });
    },
    listEntries(worldId, limit = 50) {
      return (stmtListEntries.all(worldId, limit) as EntryRow[]).map(mapEntry);
    },
    logTick(worldId, tick, ok, durationMs, notes) {
      stmtLogTick.run(worldId, tick, ok ? 1 : 0, durationMs, notes, new Date().toISOString());
    },
  };
}
