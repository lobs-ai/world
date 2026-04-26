import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Bipole, IntensityBar, Portrait, SectionHead, romanize } from "@/components/Primitives";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export default function CharacterPage({
  params,
}: {
  params: { id: string; cid: string };
}) {
  const world = db().getWorld(params.id);
  if (!world) notFound();
  const c = db().getCharacter(world.id, params.cid);
  if (!c) notFound();
  const place = db().getLocation(world.id, c.where);
  const rels = db().listRelationshipsFrom(world.id, c.id);
  const memories = db().listMemories(world.id, c.id).slice(0, 6);
  const appearances = db()
    .listEntries(world.id, 30)
    .filter((e) => e.characterIds.includes(c.id))
    .slice(0, 4);

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav worldId={world.id} worldName={world.name} />

      <div className="page" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 40, alignItems: "start" }}>
          <Portrait label={c.portrait} w={180} h={220} />
          <div>
            <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.32em", marginBottom: 10 }}>
              of the {place?.name || "realm"}
            </div>
            <h1 className="display" style={{ fontSize: 64, fontStyle: "italic", lineHeight: 1, marginBottom: 6 }}>
              {c.name}
            </h1>
            <div className="display" style={{ fontSize: 22, fontStyle: "italic", color: "var(--ink-soft)", marginBottom: 18 }}>
              {c.epithet}
            </div>
            <p style={{ fontSize: 18, color: "var(--ink-soft)", maxWidth: "56ch" }}>{c.summary}</p>
            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              <span className="tag">{c.age} years</span>
              {place && (
                <Link href={`/world/${world.id}/location/${place.id}`} className="tag clickable" style={{ textDecoration: "none" }}>
                  at {place.name}
                </Link>
              )}
              {!c.alive && <span className="tag accent">deceased</span>}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 64, marginTop: 64 }}>
          <div>
            <SectionHead kicker="ledger of the heart">What moves them</SectionHead>

            <div style={{ marginBottom: 28 }}>
              <div className="display-sc" style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 8 }}>presently</div>
              <p style={{ fontSize: 22, fontStyle: "italic", color: "var(--ink)" }}>
                {c.mood.dominant}
              </p>
            </div>

            <div>
              <div className="display-sc" style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 12 }}>longings</div>
              <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {c.desires.map((d, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      gap: 18,
                      alignItems: "baseline",
                      padding: "10px 0",
                      borderTop: "0.5px dotted var(--rule)",
                    }}
                  >
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", width: 32, textAlign: "right" }}>
                      {romanize(i + 1)}.
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 17,
                        fontStyle: d.unspoken ? "italic" : "normal",
                        color: d.unspoken ? "var(--ink-faint)" : "var(--ink)",
                      }}
                    >
                      {d.unspoken ? `(${d.goal})` : d.goal}
                    </span>
                    <IntensityBar v={d.intensity} />
                  </li>
                ))}
              </ol>
            </div>

            <SectionHead kicker="bonds, in their own measure">Of others, and how they hold them</SectionHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {rels.length === 0 && (
                <p style={{ fontStyle: "italic", color: "var(--ink-faint)" }}>
                  No bond yet recorded.
                </p>
              )}
              {rels.map((r) => {
                const other = db().getCharacter(world.id, r.toId);
                if (!other) return null;
                return (
                  <div
                    key={r.toId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 200px",
                      gap: 18,
                      padding: "16px 0",
                      borderTop: "0.5px solid var(--rule)",
                    }}
                  >
                    <div>
                      <div className="display" style={{ fontSize: 22, fontStyle: "italic" }}>
                        <span style={{ color: "var(--ink-faint)" }}>holds</span>{" "}
                        <Link href={`/world/${world.id}/character/${r.toId}`} className="inline-link character">
                          {other.name}
                        </Link>{" "}
                        <span style={{ color: "var(--ink-faint)" }}>as</span> {r.typeFromMe}.
                      </div>
                      {r.note && (
                        <p style={{ fontSize: 15, fontStyle: "italic", color: "var(--ink-soft)", marginTop: 4, maxWidth: "44ch" }}>
                          {r.note}
                        </p>
                      )}
                    </div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.8 }}>
                      <Bipole label="affection" v={r.affection} />
                      <Bipole label="trust" v={r.trust} />
                    </div>
                  </div>
                );
              })}
              <p style={{ fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic", marginTop: 4 }}>
                These are how <em>{c.name.split(" ")[0]}</em> holds the others. The others may hold them differently.
              </p>
            </div>
          </div>

          <div>
            <SectionHead kicker="entries in which they appear">Lately written</SectionHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {appearances.length === 0 && (
                <p style={{ fontStyle: "italic", color: "var(--ink-faint)" }}>
                  Not yet named in any writ.
                </p>
              )}
              {appearances.map((e) => (
                <Link
                  key={e.id}
                  href={`/world/${world.id}#${e.id}`}
                  className="row-link"
                  style={{ paddingBottom: 14, borderBottom: "0.5px dotted var(--rule)", textDecoration: "none", color: "inherit" }}
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

            <SectionHead kicker="memories, weighted">What stays with them</SectionHead>
            {memories.length === 0 && (
              <p style={{ fontStyle: "italic", color: "var(--ink-faint)" }}>No memory yet has weight.</p>
            )}
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {memories.map((m) => (
                <li key={m.id} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span
                    style={{
                      width: 4,
                      alignSelf: "stretch",
                      background: "var(--accent)",
                      opacity: m.weight,
                    }}
                  />
                  <p
                    style={{
                      margin: 0,
                      fontSize: 15,
                      fontStyle: "italic",
                      color: m.weight > 0.5 ? "var(--ink)" : "var(--ink-soft)",
                    }}
                  >
                    {m.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
