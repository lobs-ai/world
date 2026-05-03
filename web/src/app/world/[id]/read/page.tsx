import { notFound } from "next/navigation";
import type { Character, Location, Plot } from "@world/app";
import { db } from "@/lib/db";
import { Nav } from "@/components/Nav";
import { ReadBook } from "./ReadBook";

export const dynamic = "force-dynamic";

export default function ReadPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { p?: string };
}) {
  const world = db().getWorld(params.id);
  if (!world) notFound();

  // Pull every entry, then reverse to chronological order (oldest first).
  // listEntries is newest-first; we want a reader that opens at the
  // beginning of the story.
  const entries = db().listEntries(world.id, 1000).slice().reverse();

  const characters = db().listCharacters(world.id);
  const locations = db().listLocations(world.id);
  const plots = db().listPlots(world.id);

  const charMap: Record<string, Pick<Character, "id" | "name" | "epithet">> = {};
  for (const c of characters) charMap[c.id] = { id: c.id, name: c.name, epithet: c.epithet };
  const locMap: Record<string, Pick<Location, "id" | "name">> = {};
  for (const l of locations) locMap[l.id] = { id: l.id, name: l.name };
  const plotMap: Record<string, Pick<Plot, "id" | "title">> = {};
  for (const p of plots) plotMap[p.id] = { id: p.id, title: p.title };

  const initialPage = Math.max(
    0,
    Math.min(entries.length - 1, parseInt(searchParams?.p ?? "", 10) || 0),
  );

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav worldId={world.id} worldName={world.name} active="read" />
      <ReadBook
        worldId={world.id}
        worldName={world.name}
        entries={entries}
        characters={charMap}
        locations={locMap}
        plots={plotMap}
        initialPage={initialPage}
      />
    </div>
  );
}
