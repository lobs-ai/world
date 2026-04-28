import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { mainStory } from "@/lib/story";
import { Fleuron, Portrait, SectionHead } from "@/components/Primitives";
import { Nav } from "@/components/Nav";
import { ChronicleImage, imageUrlFromPath } from "@/components/ChronicleImage";

export const dynamic = "force-dynamic";

const BEAT_LABEL: Record<string, string> = {
  setup: "Setup",
  complication: "Complication",
  rising: "Rising",
  climax: "Climax",
  falling: "Falling",
  resolution: "Resolution",
  world_report: "From the realm",
  private: "Quiet hour",
};

export default function StoryPage({ params }: { params: { id: string } }) {
  const world = db().getWorld(params.id);
  if (!world) notFound();
  const { spine, protagonist, cocast } = mainStory(world);

  if (!protagonist) {
    return (
      <div className="paper" style={{ minHeight: "100vh" }}>
        <Nav worldId={world.id} worldName={world.name} active="story" />
        <div className="page" style={{ position: "relative", zIndex: 1 }}>
          <p style={{ textAlign: "center", fontStyle: "italic", color: "var(--ink-faint)", padding: "80px 0" }}>
            The story has not yet found its first figure.
          </p>
        </div>
      </div>
    );
  }

  const place = db().getLocation(world.id, protagonist.where);
  const allies = db()
    .listRelationshipsFrom(world.id, protagonist.id)
    .filter((r) => r.affection >= 0.2 || r.trust >= 0.4);
  const antagonists = db()
    .listRelationshipsFrom(world.id, protagonist.id)
    .filter((r) => r.affection <= -0.2 || r.trust <= -0.3);
  const prophecies = db()
    .listProphecies(world.id)
    .filter(
      (p) =>
        p.relatedCharacterIds.includes(protagonist.id) ||
        (spine && p.relatedPlotIds.includes(spine.id)),
    );
  const recentEntries = db()
    .listEntries(world.id, 30)
    .filter((e) => e.characterIds.includes(protagonist.id))
    .slice(0, 3);

  const portraitUrl = imageUrlFromPath(protagonist.imagePath);

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav worldId={world.id} worldName={world.name} active="story" />

      <div className="page" style={{ position: "relative", zIndex: 1 }}>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 56, alignItems: "start", marginBottom: 64 }}>
          {portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={portraitUrl}
              alt={protagonist.name}
              style={{
                width: 260,
                height: 320,
                objectFit: "cover",
                border: "0.5px solid rgba(0,0,0,0.18)",
                background: "var(--paper-deep)",
                display: "block",
              }}
            />
          ) : (
            <Portrait name={protagonist.name} w={260} h={320} />
          )}
          <div>
            <div className="display-sc" style={{ fontSize: 13, color: "var(--accent-deep)", letterSpacing: "0.32em", marginBottom: 12 }}>
              ❧ &nbsp; the heart of {world.name} &nbsp; ❧
            </div>
            <h1 className="display" style={{ fontSize: 76, fontStyle: "italic", lineHeight: 1, marginBottom: 8 }}>
              <Link href={`/world/${world.id}/character/${protagonist.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                {protagonist.name}
              </Link>
            </h1>
            <div className="display" style={{ fontSize: 22, fontStyle: "italic", color: "var(--ink-soft)", marginBottom: 18 }}>
              {protagonist.epithet}
            </div>
            <p style={{ fontSize: 19, color: "var(--ink)", maxWidth: "56ch", lineHeight: 1.6 }}>
              {protagonist.summary}
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              {place && (
                <Link href={`/world/${world.id}/location/${place.id}`} className="tag clickable" style={{ textDecoration: "none" }}>
                  presently at {place.name}
                </Link>
              )}
              {protagonist.factionId && (
                <Link href={`/world/${world.id}/faction/${protagonist.factionId}`} className="tag clickable" style={{ textDecoration: "none" }}>
                  of {db().getFaction(world.id, protagonist.factionId)?.name ?? "—"}
                </Link>
              )}
            </div>
          </div>
        </div>

        <Fleuron glyph="✦   ❦   ✦" />

        {/* ── The spine arc ───────────────────────────────────────────── */}
        {spine && (
          <section style={{ marginBottom: 80 }}>
            <SectionHead kicker="the through-line">The story unfolding</SectionHead>
            <Link
              href={`/world/${world.id}/plot/${spine.id}`}
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
              <h2 className="display" style={{ fontSize: 44, fontStyle: "italic", lineHeight: 1.1, marginBottom: 14 }}>
                {spine.title}
              </h2>
              <p style={{ fontSize: 18, color: "var(--ink-soft)", maxWidth: "62ch", lineHeight: 1.6, fontStyle: "italic" }}>
                {spine.arc}
              </p>
            </Link>

            {spine.beats.length > 0 && (
              <div style={{ marginTop: 44 }}>
                <div className="display-sc" style={{ fontSize: 12, letterSpacing: "0.28em", color: "var(--ink-faint)", marginBottom: 16 }}>
                  the beats so far
                </div>
                <ol style={{ listStyle: "none", margin: 0, padding: 0, position: "relative" }}>
                  <span style={{ position: "absolute", left: 7, top: 8, bottom: 8, width: 1, background: "var(--rule)", opacity: 0.5 }} />
                  {spine.beats.map((b, i) => {
                    const isLast = i === spine.beats.length - 1;
                    return (
                      <li key={i} style={{ position: "relative", paddingLeft: 36, paddingBottom: 26 }}>
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 8,
                            width: 15,
                            height: 15,
                            border: `1px solid ${isLast ? "var(--accent-deep)" : "var(--ink-soft)"}`,
                            background: isLast ? "var(--accent)" : "var(--paper)",
                            borderRadius: "50%",
                          }}
                        />
                        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 4 }}>
                          {b.when} · {BEAT_LABEL[b.type] ?? b.type}
                        </div>
                        <div className="display" style={{ fontSize: 22, fontStyle: "italic", marginBottom: 4 }}>
                          {b.title}
                        </div>
                        <p style={{ fontSize: 15, color: "var(--ink-soft)", margin: 0, fontStyle: "italic", maxWidth: "56ch" }}>
                          {b.sketch}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </section>
        )}

        {/* ── Two-column: figures around them, recent entries ─────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 64 }}>
          <div>
            {cocast.length > 0 && (
              <>
                <SectionHead kicker="braided into the spine">Other figures of the story</SectionHead>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {cocast.map((c) => {
                    const url = imageUrlFromPath(c.imagePath);
                    return (
                      <Link
                        key={c.id}
                        href={`/world/${world.id}/character/${c.id}`}
                        className="row-link"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "60px 1fr",
                          gap: 14,
                          alignItems: "center",
                          padding: "10px 0",
                          borderTop: "0.5px solid var(--rule)",
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        {url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={url}
                            alt={c.name}
                            style={{ width: 60, height: 75, objectFit: "cover", border: "0.5px solid rgba(0,0,0,0.16)", background: "var(--paper-deep)" }}
                          />
                        ) : (
                          <Portrait name={c.name} w={60} h={75} />
                        )}
                        <div>
                          <div className="display" style={{ fontSize: 22, fontStyle: "italic" }}>{c.name}</div>
                          <div style={{ fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic", marginTop: 2 }}>
                            {c.epithet}
                          </div>
                          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "4px 0 0 0", maxWidth: "44ch" }}>
                            {c.summary}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}

            {(allies.length > 0 || antagonists.length > 0) && (
              <>
                <SectionHead kicker="how they hold the others">Allies and antagonists</SectionHead>
                <RelationGroup label="Allies" relations={allies.slice(0, 4)} worldId={world.id} />
                <RelationGroup label="Antagonists" relations={antagonists.slice(0, 4)} worldId={world.id} />
              </>
            )}
          </div>

          <div>
            <SectionHead kicker="entries in which they walk">Recently written</SectionHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {recentEntries.length === 0 && (
                <p style={{ fontStyle: "italic", color: "var(--ink-faint)" }}>
                  Not yet named in any writ.
                </p>
              )}
              {recentEntries.map((e) => (
                <Link
                  key={e.id}
                  href={`/world/${world.id}#${e.id}`}
                  style={{ textDecoration: "none", color: "inherit", paddingBottom: 12, borderBottom: "0.5px dotted var(--rule)" }}
                >
                  <div className="display" style={{ fontSize: 18, fontStyle: "italic", marginBottom: 2 }}>
                    {e.title}
                  </div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                    {e.inWorldDate}
                  </div>
                </Link>
              ))}
            </div>

            {prophecies.length > 0 && (
              <>
                <SectionHead kicker="foretellings that touch them">What has been said</SectionHead>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 18 }}>
                  {prophecies.map((p) => (
                    <li key={p.id} style={{ paddingBottom: 14, borderBottom: "0.5px dotted var(--rule)" }}>
                      <Link
                        href={`/world/${world.id}/prophecy/${p.id}`}
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        <p style={{ fontSize: 17, fontStyle: "italic", margin: 0, color: "var(--ink)" }}>
                          “{p.text}”
                        </p>
                        <div style={{ fontSize: 12, color: "var(--ink-faint)", fontStyle: "italic", marginTop: 6 }}>
                          — {p.source}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RelationGroup({
  label,
  relations,
  worldId,
}: {
  label: string;
  relations: ReturnType<ReturnType<typeof db>["listRelationshipsFrom"]>;
  worldId: string;
}) {
  if (relations.length === 0) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="display-sc" style={{ fontSize: 12, letterSpacing: "0.28em", color: "var(--ink-soft)", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {relations.map((r) => {
          const other = db().getCharacter(worldId, r.toId);
          if (!other) return null;
          return (
            <Link
              key={r.toId}
              href={`/world/${worldId}/character/${r.toId}`}
              style={{ textDecoration: "none", color: "inherit", padding: "10px 0", borderTop: "0.5px solid var(--rule)" }}
            >
              <div className="display" style={{ fontSize: 19, fontStyle: "italic" }}>
                {other.name}
                <span style={{ color: "var(--ink-faint)", fontSize: 14, marginLeft: 8, fontStyle: "italic" }}>
                  — {r.typeFromMe}
                </span>
              </div>
              {r.note && (
                <div style={{ fontSize: 13, color: "var(--ink-soft)", fontStyle: "italic", marginTop: 2, maxWidth: "44ch" }}>
                  {r.note}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
