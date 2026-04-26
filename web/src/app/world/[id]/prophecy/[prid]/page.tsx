import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Fleuron, SectionHead } from "@/components/Primitives";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  unfulfilled: "not yet stirred",
  echoing: "first echoes heard",
  half_fulfilled: "halfway answered",
  fulfilled: "answered in full",
  broken: "broken",
};

export default function ProphecyPage({
  params,
}: {
  params: { id: string; prid: string };
}) {
  const world = db().getWorld(params.id);
  if (!world) notFound();
  const p = db().getProphecy(world.id, params.prid);
  if (!p) notFound();
  const tickNow = world.tick;
  const overdue = tickNow > p.targetPayoffMax;
  const inWindow = tickNow >= p.targetPayoffMin && tickNow <= p.targetPayoffMax;
  const relatedPlots = p.relatedPlotIds
    .map((id) => db().getPlot(world.id, id))
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const relatedChars = p.relatedCharacterIds
    .map((id) => db().getCharacter(world.id, id))
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav worldId={world.id} worldName={world.name} active="threads" />

      <div className="page" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.32em", marginBottom: 12 }}>
            a foretelling of {world.name}
          </div>
          <p style={{ fontSize: 28, fontStyle: "italic", lineHeight: 1.4, maxWidth: "44ch", marginInline: "auto", color: "var(--ink)" }}>
            “{p.text}”
          </p>
          <div style={{ fontSize: 15, color: "var(--ink-faint)", fontStyle: "italic", marginTop: 18 }}>
            — {p.source}
          </div>
        </div>

        <Fleuron glyph="✦   ❦   ✦" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginTop: 24 }}>
          <div>
            <SectionHead kicker="the chronicler's measure">Status</SectionHead>
            <p style={{ fontSize: 22, fontStyle: "italic", color: "var(--accent-deep)" }}>
              {STATUS_LABEL[p.status]}
            </p>
            <p style={{ fontSize: 14, color: "var(--ink-soft)", fontStyle: "italic" }}>
              {p.echoes === 0
                ? "No echo has yet been struck."
                : `Echoed ${p.echoes} time${p.echoes === 1 ? "" : "s"} in the chronicle.`}
            </p>

            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-faint)", marginTop: 18 }}>
              payoff window: ticks {p.targetPayoffMin}–{p.targetPayoffMax}<br />
              now: tick {tickNow}{overdue ? " · overdue" : inWindow ? " · in window" : " · awaiting"}
            </div>
          </div>

          <div>
            <SectionHead kicker="threads it touches">Related plots</SectionHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {relatedPlots.length === 0 && (
                <p style={{ fontStyle: "italic", color: "var(--ink-faint)" }}>None named.</p>
              )}
              {relatedPlots.map((rp) => (
                <Link
                  key={rp.id}
                  href={`/world/${world.id}/plot/${rp.id}`}
                  className="row-link"
                  style={{ textDecoration: "none", color: "inherit", padding: "8px 0", borderTop: "0.5px solid var(--rule)" }}
                >
                  <div className="display-sc" style={{ fontSize: 11, letterSpacing: "0.22em", color: "var(--ink-faint)" }}>
                    {rp.tier} · {rp.state}
                  </div>
                  <div className="display" style={{ fontSize: 18, fontStyle: "italic" }}>{rp.title}</div>
                </Link>
              ))}
            </div>

            <SectionHead kicker="the named within it">Figures</SectionHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {relatedChars.length === 0 && (
                <p style={{ fontStyle: "italic", color: "var(--ink-faint)" }}>None named.</p>
              )}
              {relatedChars.map((c) => (
                <Link
                  key={c.id}
                  href={`/world/${world.id}/character/${c.id}`}
                  className="row-link"
                  style={{ textDecoration: "none", color: "inherit", padding: "6px 0", borderTop: "0.5px dotted var(--rule)" }}
                >
                  <div className="display" style={{ fontSize: 17, fontStyle: "italic" }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-faint)", fontStyle: "italic" }}>{c.epithet}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
