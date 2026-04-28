import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Fleuron } from "@/components/Primitives";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export default function ChapterPage({ params }: { params: { id: string } }) {
  const world = db().getWorld(params.id);
  if (!world) notFound();
  const recent = db().listEntries(world.id, 7);

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav worldId={world.id} worldName={world.name} />

      <div style={{ position: "relative", zIndex: 1, padding: "100px 64px 160px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.4em", marginBottom: 22 }}>
            ❧&nbsp;&nbsp;the latest chapter&nbsp;&nbsp;❧
          </div>
          <h1 className="display" style={{ fontSize: 76, fontStyle: "italic", lineHeight: 0.98, marginBottom: 16 }}>
            Of the seven last writs
          </h1>
          <Fleuron glyph="✦   ❦   ✦" />
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
            recently set down
          </div>
        </div>

        <article style={{ maxWidth: "62ch", marginInline: "auto" }}>
          {recent.length === 0 ? (
            <p style={{ fontStyle: "italic", color: "var(--ink-faint)", textAlign: "center" }}>
              No writ has fallen yet. The chapter is still blank.
            </p>
          ) : (
            recent.reverse().map((e) => (
              <section key={e.id} style={{ marginBottom: 32 }}>
                <h3 className="display" style={{ fontStyle: "italic", fontSize: 24, marginBottom: 4 }}>
                  {e.title}
                </h3>
                <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 10 }}>
                  {e.inWorldDate} · {e.timeOfDay}
                </div>
                {e.paragraphs.slice(0, 2).map((p, i) => (
                  <p key={i} style={p.kind === "dialogue" ? { fontStyle: "italic", paddingLeft: 24, borderLeft: "2px solid var(--ink-ghost)" } : undefined}>
                    {p.text}
                  </p>
                ))}
              </section>
            ))
          )}
        </article>
      </div>
    </div>
  );
}
