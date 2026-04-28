-- World schema. Single SQLite file. All TEXT/INTEGER/REAL — no JSON helpers.
-- Complex fields are JSON-encoded text.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS worlds (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  premise       TEXT NOT NULL,
  tone          TEXT NOT NULL,
  themes        TEXT NOT NULL,           -- JSON array
  era           TEXT NOT NULL,
  in_world_date TEXT NOT NULL,
  tick          INTEGER NOT NULL DEFAULT 0,
  deep_history  TEXT NOT NULL DEFAULT '{}',
  world_horizon TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
  id          TEXT NOT NULL,
  world_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,
  description TEXT NOT NULL,
  weather     TEXT NOT NULL,
  coordinates TEXT,                          -- JSON {x,y} over realm map (0..1); null for old worlds
  region      TEXT NOT NULL DEFAULT '',      -- a regional grouping label
  image_path  TEXT,
  PRIMARY KEY (world_id, id),
  FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS characters (
  id          TEXT NOT NULL,
  world_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  epithet     TEXT NOT NULL,
  age         INTEGER NOT NULL,
  where_id    TEXT NOT NULL,                -- location id
  weight      TEXT NOT NULL DEFAULT 'principal',
  faction_id  TEXT,
  portrait    TEXT NOT NULL,
  summary     TEXT NOT NULL,
  mood        TEXT NOT NULL,                -- JSON
  desires     TEXT NOT NULL,                -- JSON array
  traits      TEXT NOT NULL,                -- JSON object
  alive       INTEGER NOT NULL DEFAULT 1,
  secrets     TEXT NOT NULL DEFAULT '[]',    -- JSON array of strings
  image_path  TEXT,
  PRIMARY KEY (world_id, id),
  FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS relationships (
  world_id     TEXT NOT NULL,
  from_id      TEXT NOT NULL,
  to_id        TEXT NOT NULL,
  type_from_me TEXT NOT NULL,
  affection    REAL NOT NULL,
  trust        REAL NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (world_id, from_id, to_id),
  FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS plots (
  id                  TEXT NOT NULL,
  world_id            TEXT NOT NULL,
  title               TEXT NOT NULL,
  tier                TEXT NOT NULL DEFAULT 'subplot',
  state               TEXT NOT NULL,
  tension             REAL NOT NULL,
  arc                 TEXT NOT NULL,
  central             TEXT NOT NULL,                -- JSON array of character ids
  faction_ids         TEXT NOT NULL DEFAULT '[]',   -- JSON array of faction ids
  themes              TEXT NOT NULL,                -- JSON array
  hooks               TEXT NOT NULL,                -- JSON array
  beats               TEXT NOT NULL DEFAULT '[]',   -- JSON array of beats
  last_advanced_tick  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (world_id, id),
  FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS factions (
  id                  TEXT NOT NULL,
  world_id            TEXT NOT NULL,
  name                TEXT NOT NULL,
  banner              TEXT NOT NULL,
  summary             TEXT NOT NULL,
  themes              TEXT NOT NULL DEFAULT '[]',
  desires             TEXT NOT NULL DEFAULT '[]',   -- JSON
  tension             REAL NOT NULL DEFAULT 0,
  last_advanced_tick  INTEGER NOT NULL DEFAULT 0,
  seat_location_id    TEXT,
  PRIMARY KEY (world_id, id),
  FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prophecies (
  id                    TEXT NOT NULL,
  world_id              TEXT NOT NULL,
  text                  TEXT NOT NULL,
  source                TEXT NOT NULL,
  planted_tick          INTEGER NOT NULL,
  target_payoff_min     INTEGER NOT NULL,
  target_payoff_max     INTEGER NOT NULL,
  status                TEXT NOT NULL DEFAULT 'unfulfilled',
  echoes                INTEGER NOT NULL DEFAULT 0,
  related_plot_ids      TEXT NOT NULL DEFAULT '[]',
  related_character_ids TEXT NOT NULL DEFAULT '[]',
  hidden_meaning        TEXT,
  PRIMARY KEY (world_id, id),
  FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_prophecies_status
  ON prophecies(world_id, status);

CREATE TABLE IF NOT EXISTS memories (
  id            TEXT PRIMARY KEY,
  world_id      TEXT NOT NULL,
  character_id  TEXT NOT NULL,
  weight        REAL NOT NULL,
  text          TEXT NOT NULL,
  tick_learned  INTEGER NOT NULL,
  FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memories_character
  ON memories(world_id, character_id);

CREATE TABLE IF NOT EXISTS rumors (
  id           TEXT PRIMARY KEY,
  world_id     TEXT NOT NULL,
  location_id  TEXT NOT NULL,
  text         TEXT NOT NULL,
  truth        REAL NOT NULL,
  tick_planted INTEGER NOT NULL,
  FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rumors_location
  ON rumors(world_id, location_id);

CREATE TABLE IF NOT EXISTS chronicle_entries (
  id              TEXT PRIMARY KEY,
  world_id        TEXT NOT NULL,
  tick            INTEGER NOT NULL,
  in_world_date   TEXT NOT NULL,
  time_of_day     TEXT NOT NULL,
  weather         TEXT NOT NULL,
  title           TEXT NOT NULL,
  beat_type       TEXT NOT NULL DEFAULT 'rising',
  plot_ids        TEXT NOT NULL,          -- JSON array
  faction_ids     TEXT NOT NULL DEFAULT '[]',
  prophecy_ids    TEXT NOT NULL DEFAULT '[]',
  location_ids    TEXT NOT NULL,          -- JSON array
  character_ids   TEXT NOT NULL,          -- JSON array
  paragraphs      TEXT NOT NULL,          -- JSON array
  image_path      TEXT,
  created_at      TEXT NOT NULL,
  FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chronicle_world_tick
  ON chronicle_entries(world_id, tick DESC);

CREATE TABLE IF NOT EXISTS tick_log (
  world_id   TEXT NOT NULL,
  tick       INTEGER NOT NULL,
  ok         INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  notes      TEXT NOT NULL DEFAULT '',
  ran_at     TEXT NOT NULL,
  PRIMARY KEY (world_id, tick),
  FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
);
