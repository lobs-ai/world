import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Fleuron, Portrait, SectionHead } from "@/components/Primitives";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export default function LocationPage({
  params,
}: {
  params: { id: string; lid: string };
}) {
  const world = db().getWorld(params.id);
  if (!world) notFound();
  const l = db().getLocation(world.id, params.lid);
  if (!l) notFound();
  const residents = db()
    .listCharacters(world.id)
    .filter((c) => c.where === l.id);
  const rumors = db().listRumors(world.id, l.id);
  const appearances = db()
    .listEntries(world.id, 30)
    .filter((e) => e.locationIds.includes(l.id))
    .slice(0, 6);

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav worldId={world.id} worldName={world.name} />

      <div className="page" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center" }}>
          <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.32em", marginBottom: 12 }}>
            a {l.type} of the realm
          </div>
          <h1 className="display" style={{ fontSize: 80, fontStyle: "italic", lineHeight: 0.95, marginBottom: 18 }}>
            {l.name}
          </h1>
          <p style={{ fontSize: 20, fontStyle: "italic", color: "var(--ink-soft)", maxWidth: "56ch", marginInline: "auto" }}>
            {l.description}
          </p>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-faint)", marginTop: 24 }}>
            this hour: {l.weather}
          </div>
        </div>

        <Fleuron glyph="✦   ❦   ✦" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, marginTop: 36 }}>
          <div>
            <SectionHead kicker="those presently here">Within the walls</SectionHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {residents.length ? (
                residents.map((r) => (
                  <Link
                    key={r.id}
                    href={`/world/${world.id}/character/${r.id}`}
                    className="row-link"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "60px 1fr",
                      gap: 16,
                      padding: "12px 0",
                      borderTop: "0.5px solid var(--rule)",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <Portrait label="" w={60} h={75} />
                    <div>
                      <div className="display" style={{ fontSize: 22, fontStyle: "italic" }}>{r.name}</div>
                      <div style={{ fontSize: 14, color: "var(--ink-faint)", fontStyle: "italic", marginBottom: 4 }}>
                        {r.epithet}
                      </div>
                      <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0 }}>{r.summary}</p>
                    </div>
                  </Link>
                ))
              ) : (
                <p style={{ fontStyle: "italic", color: "var(--ink-faint)" }}>None at present. Only the bees.</p>
              )}
            </div>
          </div>

          <div>
            <SectionHead kicker="overheard, this season">What is told here</SectionHead>
            {rumors.length ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 18 }}>
                {rumors.map((r) => (
                  <li key={r.id} style={{ padding: "14px 0", borderTop: "0.5px solid var(--rule)" }}>
                    <p
                      style={{
                        fontSize: 18,
                        fontStyle: "italic",
                        margin: 0,
                        color: `oklch(${0.205 + (1 - r.truth) * 0.2} 0.014 50)`,
                        opacity: 0.55 + r.truth * 0.45,
                      }}
                    >
                      “{r.text}”
                    </p>
                    <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-faint)", marginTop: 8 }}>
                      {r.truth > 0.85 ? "near to the truth" : r.truth > 0.6 ? "in some part true" : "much-distorted"}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontStyle: "italic", color: "var(--ink-faint)" }}>No rumour clings to this place.</p>
            )}

            <SectionHead kicker="entries set here">Lately written</SectionHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {appearances.map((e) => (
                <div key={e.id} style={{ paddingBottom: 12, borderBottom: "0.5px dotted var(--rule)" }}>
                  <div className="display" style={{ fontSize: 18, fontStyle: "italic" }}>{e.title}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                    {e.inWorldDate}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
