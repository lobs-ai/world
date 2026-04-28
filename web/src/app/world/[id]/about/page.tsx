import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Fleuron, SectionHead } from "@/components/Primitives";
import { Nav } from "@/components/Nav";
import { imageUrlFromPath } from "@/components/ChronicleImage";

export const dynamic = "force-dynamic";

export default function AboutWorldPage({ params }: { params: { id: string } }) {
  const world = db().getWorld(params.id);
  if (!world) notFound();
  const factions = db().listFactions(world.id);
  const prophecies = db().listProphecies(world.id);
  const locations = db().listLocations(world.id);
  const dh = world.deepHistory;

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav worldId={world.id} worldName={world.name} active="world" />

      <div className="page" style={{ position: "relative", zIndex: 1 }}>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.4em", marginBottom: 16 }}>
            ❧ &nbsp; the world of {world.name} &nbsp; ❧
          </div>
          <h1 className="display" style={{ fontSize: 88, fontStyle: "italic", lineHeight: 0.98, marginBottom: 22 }}>
            {world.name}
          </h1>
          <p style={{ fontSize: 22, fontStyle: "italic", color: "var(--ink-soft)", maxWidth: "52ch", marginInline: "auto", lineHeight: 1.5 }}>
            {world.premise}
          </p>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink-faint)", marginTop: 22 }}>
            {[world.tone, ...world.themes.slice(0, 3)].filter(Boolean).join(" · ")}
          </div>
        </div>

        {world.realmImagePath && (
          <div style={{ maxWidth: 900, marginInline: "auto", marginBottom: 32, marginTop: 24 }}>
            {(() => {
              const url = imageUrlFromPath(world.realmImagePath);
              return url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={`Map of ${world.name}`}
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    objectFit: "cover",
                    border: "0.5px solid var(--rule)",
                    background: "var(--paper-deep)",
                    display: "block",
                  }}
                />
              ) : null;
            })()}
          </div>
        )}

        <Fleuron glyph="✦   ❦   ✦" />

        {/* ── Era + present moment ──────────────────────────────────── */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginTop: 24, marginBottom: 64 }}>
          <div style={{ borderLeft: "2px solid var(--accent)", paddingLeft: 22 }}>
            <div className="display-sc" style={{ fontSize: 12, letterSpacing: "0.28em", color: "var(--ink-faint)", marginBottom: 6 }}>
              the age in which it is set
            </div>
            <p style={{ fontSize: 19, fontStyle: "italic", color: "var(--ink)", margin: 0, lineHeight: 1.4 }}>
              {world.era}
            </p>
          </div>
          <div style={{ borderLeft: "2px solid var(--ink-ghost)", paddingLeft: 22 }}>
            <div className="display-sc" style={{ fontSize: 12, letterSpacing: "0.28em", color: "var(--ink-faint)", marginBottom: 6 }}>
              the present moment
            </div>
            <p style={{ fontSize: 19, fontStyle: "italic", color: "var(--ink)", margin: 0, lineHeight: 1.4 }}>
              {world.inWorldDate}
            </p>
          </div>
        </section>

        {/* ── Cosmology ────────────────────────────────────────────── */}
        {dh.cosmology && (
          <section style={{ marginBottom: 64 }}>
            <SectionHead kicker="the order of things">Cosmology</SectionHead>
            <p style={{ fontSize: 19, lineHeight: 1.65, color: "var(--ink)", maxWidth: "62ch", fontStyle: "italic" }}>
              {dh.cosmology}
            </p>
          </section>
        )}

        {/* ── Deep history: ancients, oaths, fallen orders, lost places ── */}
        {dh.ancients.length > 0 && (
          <section style={{ marginBottom: 64 }}>
            <SectionHead kicker="figures of the deep past">The Ancients</SectionHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
              {dh.ancients.map((a, i) => (
                <div
                  key={i}
                  style={{
                    padding: "16px 20px",
                    border: "0.5px solid var(--rule)",
                    background: "var(--paper-deep)",
                  }}
                >
                  <div className="display-sc" style={{ fontSize: 11, letterSpacing: "0.28em", color: "var(--ink-faint)", marginBottom: 4 }}>
                    {a.era}
                  </div>
                  <div className="display" style={{ fontSize: 22, fontStyle: "italic", marginBottom: 4 }}>
                    {a.name}
                  </div>
                  {a.epithet && (
                    <div style={{ fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic", marginBottom: 8 }}>
                      {a.epithet}
                    </div>
                  )}
                  <p style={{ fontSize: 15, color: "var(--ink-soft)", fontStyle: "italic", margin: 0, lineHeight: 1.5 }}>
                    {a.one_line}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {dh.brokenOaths.length > 0 && (
          <DeepEvents
            kicker="bonds the world has broken"
            heading="Broken Oaths"
            events={dh.brokenOaths}
          />
        )}
        {dh.fallenOrders.length > 0 && (
          <DeepEvents
            kicker="ranks that no longer hold the field"
            heading="Fallen Orders"
            events={dh.fallenOrders}
          />
        )}
        {dh.lostPlaces.length > 0 && (
          <DeepEvents
            kicker="cities and shrines beneath time"
            heading="Lost Places"
            events={dh.lostPlaces}
          />
        )}

        {/* ── Banners and prophecies (cross-links) ──────────────────── */}
        {factions.length > 0 && (
          <section style={{ marginBottom: 64 }}>
            <SectionHead kicker="banners now in the field">Powers of the realm</SectionHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
              {factions.map((f) => (
                <Link
                  key={f.id}
                  href={`/world/${world.id}/faction/${f.id}`}
                  className="card clickable"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="display" style={{ fontSize: 22, fontStyle: "italic", marginBottom: 4 }}>
                    {f.name}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-soft)", fontStyle: "italic", marginBottom: 8 }}>
                    {f.banner}
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: "var(--ink-soft)" }}>{f.summary}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {prophecies.length > 0 && (
          <section style={{ marginBottom: 64 }}>
            <SectionHead kicker="things foretold, not yet paid">Foretellings</SectionHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {prophecies.map((p) => (
                <Link
                  key={p.id}
                  href={`/world/${world.id}/prophecy/${p.id}`}
                  style={{ textDecoration: "none", color: "inherit", padding: "16px 0", borderTop: "0.5px solid var(--rule)" }}
                >
                  <p style={{ fontSize: 19, fontStyle: "italic", margin: 0, color: "var(--ink)" }}>
                    “{p.text}”
                  </p>
                  <div style={{ fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic", marginTop: 6 }}>
                    — {p.source}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Footer cross-links ─────────────────────────────────────── */}
        <Fleuron glyph="✦" />
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 12, fontStyle: "italic", color: "var(--ink-soft)" }}>
          <Link href={`/world/${world.id}/map`} className="inline-link">
            Walk the realm ({locations.length} places)
          </Link>
          <span style={{ color: "var(--ink-ghost)" }}>·</span>
          <Link href={`/world/${world.id}/cast`} className="inline-link">
            Meet the cast
          </Link>
          <span style={{ color: "var(--ink-ghost)" }}>·</span>
          <Link href={`/world/${world.id}/threads`} className="inline-link">
            Follow the threads
          </Link>
        </div>
      </div>
    </div>
  );
}

function DeepEvents({
  kicker,
  heading,
  events,
}: {
  kicker: string;
  heading: string;
  events: { title: string; era: string; one_line: string }[];
}) {
  return (
    <section style={{ marginBottom: 64 }}>
      <SectionHead kicker={kicker}>{heading}</SectionHead>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {events.map((e, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 24, padding: "14px 0", borderTop: "0.5px solid var(--rule)" }}>
            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-faint)", paddingTop: 4 }}>
              {e.era}
            </div>
            <div>
              <div className="display" style={{ fontSize: 22, fontStyle: "italic", marginBottom: 4 }}>
                {e.title}
              </div>
              <p style={{ fontSize: 16, color: "var(--ink-soft)", fontStyle: "italic", margin: 0, maxWidth: "60ch", lineHeight: 1.5 }}>
                {e.one_line}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
