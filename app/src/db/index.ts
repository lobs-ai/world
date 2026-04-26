// SQLite-backed repository. The DB file is the source of truth; nothing
// caches reads beyond a single tick.

import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Character,
  ChronicleEntry,
  Location,
  Memory,
  Plot,
  PlotBeat,
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

export function openDb(path: string): Db {
  const raw = new Database(path);
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");
  const schema = readFileSync(resolve(__dirname, "schema.sql"), "utf8");
  raw.exec(schema);

  const j = (v: unknown): string => JSON.stringify(v ?? null);
  const p = <T,>(s: string | null | undefined): T => JSON.parse(s ?? "null") as T;

  // ── worlds ─────────────────────────────────────────────────────────────
  const stmtInsertWorld = raw.prepare(`
    INSERT INTO worlds (id, name, premise, tone, themes, era, in_world_date, tick, created_at, updated_at)
    VALUES (@id, @name, @premise, @tone, @themes, @era, @inWorldDate, @tick, @createdAt, @updatedAt)
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
    INSERT INTO characters (id, world_id, name, epithet, age, where_id, portrait, summary, mood, desires, traits, alive)
    VALUES (@id, @worldId, @name, @epithet, @age, @whereId, @portrait, @summary, @mood, @desires, @traits, @alive)
  `);
  const stmtUpdateCharacter = raw.prepare(`
    UPDATE characters SET
      name=@name, epithet=@epithet, age=@age, where_id=@whereId,
      portrait=@portrait, summary=@summary, mood=@mood, desires=@desires,
      traits=@traits, alive=@alive
    WHERE world_id=@worldId AND id=@id
  `);
  const stmtListCharacters = raw.prepare(
    `SELECT * FROM characters WHERE world_id = ? ORDER BY name`,
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
    INSERT INTO plots (id, world_id, title, state, tension, arc, central, themes, hooks, beats)
    VALUES (@id, @worldId, @title, @state, @tension, @arc, @central, @themes, @hooks, @beats)
  `);
  const stmtUpdatePlot = raw.prepare(`
    UPDATE plots SET
      title=@title, state=@state, tension=@tension, arc=@arc,
      central=@central, themes=@themes, hooks=@hooks, beats=@beats
    WHERE world_id=@worldId AND id=@id
  `);
  const stmtListPlots = raw.prepare(
    `SELECT * FROM plots WHERE world_id = ? ORDER BY tension DESC`,
  );
  const stmtGetPlot = raw.prepare(
    `SELECT * FROM plots WHERE world_id = ? AND id = ?`,
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
    INSERT INTO chronicle_entries (id, world_id, tick, in_world_date, time_of_day, weather, title, plot_ids, location_ids, character_ids, paragraphs, created_at)
    VALUES (@id, @worldId, @tick, @inWorldDate, @timeOfDay, @weather, @title, @plotIds, @locationIds, @characterIds, @paragraphs, @createdAt)
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
    tick: number; created_at: string; updated_at: string;
  };
  const mapWorld = (r: WorldRow): World => ({
    id: r.id, name: r.name, premise: r.premise, tone: r.tone,
    themes: p<string[]>(r.themes), era: r.era, inWorldDate: r.in_world_date,
    tick: r.tick, createdAt: r.created_at, updatedAt: r.updated_at,
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
    age: number; where_id: string; portrait: string; summary: string;
    mood: string; desires: string; traits: string; alive: number;
  };
  const mapCharacter = (r: CharRow): Character => ({
    id: r.id, worldId: r.world_id, name: r.name, epithet: r.epithet,
    age: r.age, where: r.where_id, portrait: r.portrait, summary: r.summary,
    mood: p(r.mood), desires: p(r.desires), traits: p(r.traits),
    alive: r.alive === 1,
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
    id: string; world_id: string; title: string; state: Plot["state"];
    tension: number; arc: string; central: string; themes: string;
    hooks: string; beats: string;
  };
  const mapPlot = (r: PlotRow): Plot => ({
    id: r.id, worldId: r.world_id, title: r.title, state: r.state,
    tension: r.tension, arc: r.arc, central: p(r.central),
    themes: p(r.themes), hooks: p(r.hooks), beats: p(r.beats),
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
    plot_ids: string; location_ids: string; character_ids: string;
    paragraphs: string; created_at: string;
  };
  const mapEntry = (r: EntryRow): ChronicleEntry => ({
    id: r.id, worldId: r.world_id, tick: r.tick,
    inWorldDate: r.in_world_date, timeOfDay: r.time_of_day,
    weather: r.weather, title: r.title,
    plotIds: p(r.plot_ids), locationIds: p(r.location_ids),
    characterIds: p(r.character_ids), paragraphs: p(r.paragraphs),
    createdAt: r.created_at,
  });

  return {
    raw,
    insertWorld(w) {
      stmtInsertWorld.run({ ...w, themes: j(w.themes) });
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
        ...c, whereId: c.where, alive: c.alive ? 1 : 0,
        mood: j(c.mood), desires: j(c.desires), traits: j(c.traits),
      });
    },
    updateCharacter(c) {
      stmtUpdateCharacter.run({
        ...c, whereId: c.where, alive: c.alive ? 1 : 0,
        mood: j(c.mood), desires: j(c.desires), traits: j(c.traits),
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
        ...pl, central: j(pl.central), themes: j(pl.themes),
        hooks: j(pl.hooks), beats: j(pl.beats),
      });
    },
    updatePlot(pl) {
      stmtUpdatePlot.run({
        ...pl, central: j(pl.central), themes: j(pl.themes),
        hooks: j(pl.hooks), beats: j(pl.beats),
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
