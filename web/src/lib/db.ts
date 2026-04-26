import "server-only";
import { getConfig, openDb } from "@world/app";
import type { Db } from "@world/app";

let _db: Db | null = null;

export function db(): Db {
  if (_db) return _db;
  const cfg = getConfig();
  _db = openDb(cfg.dbPath);
  return _db;
}
