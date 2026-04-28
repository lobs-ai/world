import Link from "next/link";
import { notFound } from "next/navigation";
import type { Character, Location } from "@world/app";
import { db } from "@/lib/db";
import { Fleuron, Portrait, SectionHead } from "@/components/Primitives";
import { Nav } from "@/components/Nav";
import { imageUrlFromPath } from "@/components/ChronicleImage";

export const dynamic = "force-dynamic";

// How many recent entries count as "active" — markers at these locations
// get a pulse on the map so the reader can see where the camera has been.
const ACTIVE_WINDOW = 5;

export default function AtlasPage({ params }: { params: { id: string } }) {
  const world = db().getWorld(params.id);
  if (!world) notFound();
  const locations = db().listLocations(world.id);
  const characters = db().listCharacters(world.id);
  const recent = db().listEntries(world.id, ACTIVE_WINDOW);

  const placed = locations.filter((l) => l.coordinates);
  const unplaced = locations.filter((l) => !l.coordinates);

  // Active set: any location that hosted one of the last N entries.
  const activeIds = new Set(recent.flatMap((e) => e.locationIds));

  // Principal portraits at their current `where`. We cap to four per
  // location so a busy court doesn't stack into a brick of faces.
  const principalsAt = new Map<string, Character[]>();
  for (const c of characters) {
    if (c.weight !== "principal" || !c.alive) continue;
    const arr = principalsAt.get(c.where) ?? [];
    if (arr.length < 4) {
      arr.push(c);
      principalsAt.set(c.where, arr);
    }
  }

  // Group the gazetteer by region for readers; preserves regions when
  // present, falls back to a single "Other places" group for old worlds.
  const byRegion = new Map<string, Location[]>();
  for (const l of locations) {
    const key = l.region || "Other places";
    if (!byRegion.has(key)) byRegion.set(key, []);
    byRegion.get(key)!.push(l);
  }
  const regions = Array.from(byRegion.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  const realmUrl = imageUrlFromPath(world.realmImagePath);

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav worldId={world.id} worldName={world.name} active="atlas" />

      <div className="page" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.4em", marginBottom: 16 }}>
            ❧&nbsp;&nbsp;the atlas of {world.name}&nbsp;&nbsp;❧
          </div>
          <h1 className="display" style={{ fontSize: 72, fontStyle: "italic", lineHeight: 1, marginBottom: 12 }}>
            The realm, set down
          </h1>
          <p style={{ fontStyle: "italic", color: "var(--ink-soft)", maxWidth: "62ch", marginInline: "auto" }}>
            A cartographer&rsquo;s parchment of {world.name}. Markers stand for
            the places named in the chronicle; those that have lately been
            written are inked the deepest.
          </p>
        </div>

        {realmUrl ? (
          <div
            style={{
              maxWidth: 1200,
              marginInline: "auto",
              marginBottom: 56,
              position: "relative",
              border: "0.5px solid var(--rule)",
              background: "var(--paper-deep)",
              boxShadow: "0 12px 40px -28px rgba(40,20,5,0.55)",
            }}
          >
            <div style={{ position: "relative", aspectRatio: "16 / 9" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={realmUrl}
                alt={`Map of ${world.name}`}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
              {/* Marker overlay. Each marker is positioned absolutely by
                  its (x, y) over the map. Active locations get a slow
                  pulse and an accent ring. */}
              {placed.map((l) => {
                const isActive = activeIds.has(l.id);
                const here = principalsAt.get(l.id) ?? [];
                return (
                  <Marker
                    key={l.id}
                    location={l}
                    worldId={world.id}
                    isActive={isActive}
                    principals={here}
                  />
                );
              })}
              {/* Tiny corner cartouche with the world's date. Pure
                  texture; clamps to the image bottom. */}
              <div
                style={{
                  position: "absolute",
                  right: 14,
                  bottom: 12,
                  background: "rgba(245,238,222,0.85)",
                  border: "0.5px solid var(--rule)",
                  padding: "6px 12px",
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--ink-soft)",
                }}
              >
                {world.inWorldDate}
              </div>
            </div>

            {/* Map legend strip beneath the parchment. */}
            <div
              style={{
                display: "flex",
                gap: 24,
                padding: "10px 18px",
                borderTop: "0.5px solid var(--rule)",
                fontFamily: "var(--mono)",
                fontSize: 10.5,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--ink-faint)",
                background: "var(--paper)",
              }}
            >
              <LegendDot tone="rest">named in the chronicle</LegendDot>
              <LegendDot tone="active">lately written</LegendDot>
              <LegendDot tone="figure">a principal stands here</LegendDot>
              <span style={{ marginLeft: "auto" }}>
                {placed.length} of {locations.length} placed
              </span>
            </div>
          </div>
        ) : (
          <p style={{ textAlign: "center", fontStyle: "italic", color: "var(--ink-soft)", marginBottom: 40 }}>
            The cartographer&rsquo;s parchment is being inked. For now, the
            gazetteer.
          </p>
        )}

        {unplaced.length > 0 && realmUrl && (
          <p style={{ textAlign: "center", color: "var(--ink-faint)", fontStyle: "italic", fontSize: 14, marginTop: -28, marginBottom: 36 }}>
            {unplaced.length} place{unplaced.length === 1 ? "" : "s"} not yet on
            the parchment — see the gazetteer.
          </p>
        )}

        <Fleuron glyph="✦   ❦   ✦" />

        {/* Gazetteer — full index of every location, grouped by region. */}
        {regions.map(([region, places]) => (
          <section key={region} style={{ marginTop: 40 }}>
            <SectionHead kicker="region of the realm">{region}</SectionHead>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 18,
              }}
            >
              {places.map((l) => {
                const url = imageUrlFromPath(l.imagePath);
                return (
                  <Link
                    key={l.id}
                    href={`/world/${world.id}/location/${l.id}`}
                    className="card clickable"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      padding: 0,
                      overflow: "hidden",
                    }}
                  >
                    {url && (
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "16 / 9",
                          background: "var(--paper-deep)",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={l.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      </div>
                    )}
                    <div style={{ padding: 16 }}>
                      <div className="display-sc" style={{ fontSize: 11, letterSpacing: "0.32em", color: "var(--ink-faint)", marginBottom: 6 }}>
                        {l.type}
                        {activeIds.has(l.id) && (
                          <span style={{ color: "var(--accent-deep)", marginLeft: 10 }}>· lately written</span>
                        )}
                      </div>
                      <div className="display" style={{ fontSize: 22, fontStyle: "italic", marginBottom: 6 }}>
                        {l.name}
                      </div>
                      <p style={{ fontStyle: "italic", color: "var(--ink-soft)", margin: 0, fontSize: 14 }}>
                        {l.description.length > 220
                          ? l.description.slice(0, 220).replace(/\s+\S*$/, "") + "…"
                          : l.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// One marker on the parchment. Hover reveals a card with the place
// description and any principal who stands there now. The whole marker
// is a link to the location page.
function Marker({
  location,
  worldId,
  isActive,
  principals,
}: {
  location: Location;
  worldId: string;
  isActive: boolean;
  principals: Character[];
}) {
  if (!location.coordinates) return null;
  const { x, y } = location.coordinates;
  return (
    <Link
      href={`/world/${worldId}/location/${location.id}`}
      className="map-marker"
      style={{
        position: "absolute",
        left: `${(x * 100).toFixed(2)}%`,
        top: `${(y * 100).toFixed(2)}%`,
        transform: "translate(-50%, -50%)",
        textDecoration: "none",
        color: "inherit",
      }}
      title={`${location.name} — a ${location.type} of the realm`}
    >
      <span
        className={`marker-dot${isActive ? " is-active" : ""}`}
        aria-hidden
      />
      <span
        className="marker-label display-sc"
        style={{
          position: "absolute",
          left: "50%",
          top: "calc(100% + 6px)",
          transform: "translateX(-50%)",
          whiteSpace: "nowrap",
          fontSize: 10,
          letterSpacing: "0.2em",
          color: isActive ? "var(--accent-deep)" : "var(--ink)",
          textShadow: "0 0 6px rgba(245,238,222,0.95), 0 0 6px rgba(245,238,222,0.95)",
          pointerEvents: "none",
        }}
      >
        {location.name}
      </span>
      {principals.length > 0 && (
        <span
          className="marker-figures"
          style={{
            position: "absolute",
            left: "calc(100% + 6px)",
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            gap: 2,
            pointerEvents: "none",
          }}
          aria-hidden
        >
          {principals.map((p) => {
            const purl = imageUrlFromPath(p.imagePath);
            return purl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={purl}
                alt=""
                title={p.name}
                style={{
                  width: 18,
                  height: 22,
                  objectFit: "cover",
                  border: "0.5px solid var(--ink-soft)",
                  background: "var(--paper)",
                  display: "block",
                }}
              />
            ) : (
              <span key={p.id} style={{ display: "block" }}>
                <Portrait name={p.name} w={18} h={22} />
              </span>
            );
          })}
        </span>
      )}
    </Link>
  );
}

function LegendDot({
  tone,
  children,
}: {
  tone: "rest" | "active" | "figure";
  children: React.ReactNode;
}) {
  const color =
    tone === "active"
      ? "var(--accent-deep)"
      : tone === "figure"
        ? "var(--ink-soft)"
        : "var(--ink-faint)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          border: "0.5px solid var(--ink)",
          display: "inline-block",
        }}
      />
      {children}
    </span>
  );
}
