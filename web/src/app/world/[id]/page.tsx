import Link from "next/link";
import { notFound } from "next/navigation";
import type { ChronicleEntry, Paragraph } from "@world/app";
import { db } from "@/lib/db";
import { Fleuron } from "@/components/Primitives";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export default function ChroniclePage({ params }: { params: { id: string } }) {
  const world = db().getWorld(params.id);
  if (!world) notFound();
  const entries = db().listEntries(world.id, 30);

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav worldId={world.id} worldName={world.name} active="chronicle" />

      <section style={{ position: "relative", zIndex: 1, padding: "80px 64px 0", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ textAlign: "center" }}>
          <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.4em", marginBottom: 16 }}>
            ✦&nbsp;&nbsp;the chronicle of&nbsp;&nbsp;✦
          </div>
          <h1 className="display" style={{ fontStyle: "italic", fontSize: 92, lineHeight: 1, marginBottom: 28, paddingBottom: 6 }}>
            {world.name}
          </h1>
          <p style={{ fontSize: 19, fontStyle: "italic", color: "var(--ink-soft)", maxWidth: "52ch", marginInline: "auto" }}>
            {world.era}
          </p>
          <div style={{ marginTop: 28, display: "flex", gap: 24, justifyContent: "center", alignItems: "center" }}>
            <span className="mono" style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
              {entries[0] ? `last writ on ${entries[0].inWorldDate}` : "the chronicle is yet to begin"}
            </span>
          </div>
        </div>
        <Fleuron glyph="✦   ✦   ✦" />
      </section>

      <section style={{ position: "relative", zIndex: 1, padding: "0 64px 120px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ maxWidth: "62ch", marginInline: "auto", position: "relative" }}>
          {entries.length === 0 ? (
            <p style={{ textAlign: "center", fontStyle: "italic", color: "var(--ink-faint)", padding: "40px 0" }}>
              The first writ has not yet been set down. Run <span className="mono">npm run tick {world.id}</span> to make the chronicle move.
            </p>
          ) : (
            entries.map((e, i) => (
              <ChronicleArticle
                key={e.id}
                entry={e}
                worldId={world.id}
                showOpener={i === 0}
                idx={i}
              />
            ))
          )}

          <div style={{ textAlign: "center", marginTop: 60 }}>
            <span className="display-sc" style={{ color: "var(--ink-faint)", fontSize: 14, letterSpacing: "0.32em" }}>
              ❧ &nbsp; here ends the present writ &nbsp; ❧
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

function ChronicleArticle({
  entry,
  worldId,
  showOpener,
  idx,
}: {
  entry: ChronicleEntry;
  worldId: string;
  showOpener: boolean;
  idx: number;
}) {
  const characters = db().listCharacters(worldId);
  const locations = db().listLocations(worldId);
  const plots = db().listPlots(worldId);

  const charById = new Map(characters.map((c) => [c.id, c]));
  const locById = new Map(locations.map((l) => [l.id, l]));
  const plotById = new Map(plots.map((p) => [p.id, p]));

  const tagPlot = entry.plotIds[0] ? plotById.get(entry.plotIds[0]) : undefined;
  const tagPlaces = entry.locationIds.map((id) => locById.get(id)).filter(Boolean);

  return (
    <article style={{ marginBottom: 64, position: "relative" }}>
      <div
        className="marginalia"
        style={{
          position: "absolute",
          left: -210,
          top: 6,
          width: 190,
          textAlign: "right",
          color: "var(--ink-faint)",
          fontFamily: "var(--mono)",
          fontSize: 10.5,
          lineHeight: 1.6,
          letterSpacing: "0.04em",
        }}
      >
        <div className="display-sc" style={{ fontSize: 13, letterSpacing: "0.16em", color: "var(--ink-soft)", marginBottom: 6 }}>
          {entry.inWorldDate}
        </div>
        <div>{entry.timeOfDay}</div>
        <div style={{ fontStyle: "italic" }}>{entry.weather}</div>
      </div>

      <h2 className="display" style={{ fontStyle: "italic", fontSize: 36, marginBottom: 6, color: "var(--ink)" }}>
        {entry.title}
      </h2>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 22, flexWrap: "wrap" }}>
        {tagPlot && (
          <Link href={`/world/${worldId}/plot/${tagPlot.id}`} className="tag accent clickable" style={{ textDecoration: "none" }}>
            {tagPlot.title}
          </Link>
        )}
        {tagPlaces.slice(0, 2).map((p) =>
          p ? (
            <Link
              key={p.id}
              href={`/world/${worldId}/location/${p.id}`}
              className="tag clickable"
              style={{ textDecoration: "none" }}
            >
              {p.name}
            </Link>
          ) : null,
        )}
      </div>

      <div>
        {entry.paragraphs.map((p, i) => (
          <ParagraphView
            key={i}
            p={p}
            worldId={worldId}
            isFirst={i === 0 && showOpener && p.kind === "scene"}
            charLookupName={(id) => charById.get(id)?.name ?? id}
          />
        ))}
      </div>

      <Fleuron glyph={idx % 2 === 0 ? "✦" : "❦"} />
    </article>
  );
}

function ParagraphView({
  p,
  worldId,
  isFirst,
  charLookupName,
}: {
  p: Paragraph;
  worldId: string;
  isFirst: boolean;
  charLookupName: (id: string) => string;
}) {
  if (p.kind === "dialogue") {
    return (
      <p
        style={{
          fontStyle: "italic",
          paddingLeft: 24,
          borderLeft: "2px solid var(--ink-ghost)",
          marginLeft: 4,
          color: "var(--ink)",
        }}
        title={p.who ? charLookupName(p.who) : undefined}
      >
        {p.text}
      </p>
    );
  }
  return (
    <p className={isFirst ? "dropcap-illum" : undefined}>
      {p.text}
    </p>
  );
  // Note: inline character/place link tagging from prototype's {char:id|name}
  // syntax is not enforced here — the scribe writes plain prose. Tags above
  // give navigation; click into character/location/plot pages for context.
}
