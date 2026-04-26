import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Portrait, SectionHead } from "@/components/Primitives";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

const STATES = ["seeded", "setup", "rising", "climax", "falling", "resolved"] as const;

export default function PlotPage({
  params,
}: {
  params: { id: string; pid: string };
}) {
  const world = db().getWorld(params.id);
  if (!world) notFound();
  const p = db().getPlot(world.id, params.pid);
  if (!p) notFound();
  const stateIdx = STATES.indexOf(p.state);

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav worldId={world.id} worldName={world.name} />

      <div className="page" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.32em", marginBottom: 12 }}>
            a thread now running
          </div>
          <h1 className="display" style={{ fontSize: 72, fontStyle: "italic", lineHeight: 1, marginBottom: 16 }}>
            {p.title}
          </h1>
          <p style={{ fontSize: 19, color: "var(--ink-soft)", maxWidth: "60ch", marginInline: "auto", fontStyle: "italic" }}>
            {p.themes.map((t) => `“${t}”`).join(" · ")}
          </p>
        </div>

        <div style={{ marginTop: 60, marginBottom: 60, position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${STATES.length}, 1fr)`, gap: 0 }}>
            {STATES.map((s, i) => {
              const passed = i < stateIdx;
              const current = i === stateIdx;
              return (
                <div key={s} style={{ position: "relative", textAlign: "center", padding: "0 8px" }}>
                  <div
                    style={{
                      height: 1,
                      background: passed || current ? "var(--accent-deep)" : "var(--ink-ghost)",
                      opacity: passed || current ? 0.8 : 0.4,
                      position: "absolute",
                      top: 14,
                      left: 0,
                      right: 0,
                    }}
                  />
                  <div
                    style={{
                      width: current ? 18 : 10,
                      height: current ? 18 : 10,
                      borderRadius: "50%",
                      marginInline: "auto",
                      background: passed || current ? "var(--accent-deep)" : "var(--paper)",
                      border: `1px solid ${passed || current ? "var(--accent-deep)" : "var(--ink-faint)"}`,
                      position: "relative",
                      zIndex: 1,
                      marginTop: current ? 5 : 9,
                    }}
                  />
                  <div
                    className="display-sc"
                    style={{
                      fontSize: 13,
                      marginTop: 14,
                      color: current ? "var(--accent-deep)" : passed ? "var(--ink)" : "var(--ink-faint)",
                      letterSpacing: "0.18em",
                      fontWeight: current ? 600 : 400,
                    }}
                  >
                    {s}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 64 }}>
          <div>
            <SectionHead kicker="how it has played, beat by beat">The thread, so far</SectionHead>
            {p.beats.length === 0 ? (
              <p style={{ fontStyle: "italic", color: "var(--ink-faint)" }}>
                No beat has fallen yet. The plot is still tuning its strings.
              </p>
            ) : (
              <ol style={{ listStyle: "none", margin: 0, padding: 0, position: "relative" }}>
                <span style={{ position: "absolute", left: 6, top: 8, bottom: 8, width: 1, background: "var(--rule)", opacity: 0.5 }} />
                {p.beats.map((b, i) => {
                  const isLast = i === p.beats.length - 1;
                  return (
                    <li key={i} style={{ position: "relative", paddingLeft: 36, paddingBottom: 28 }}>
                      <span
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 10,
                          width: 13,
                          height: 13,
                          border: `1px solid ${isLast ? "var(--accent-deep)" : "var(--ink-soft)"}`,
                          background: isLast ? "var(--accent)" : "var(--paper)",
                          borderRadius: "50%",
                        }}
                      />
                      <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 4 }}>
                        {b.when} · {b.type}
                      </div>
                      <div className="display" style={{ fontSize: 22, fontStyle: "italic", marginBottom: 6 }}>
                        {b.title}
                      </div>
                      <p style={{ fontSize: 16, color: "var(--ink-soft)", margin: 0, fontStyle: "italic", maxWidth: "52ch" }}>
                        {b.sketch}
                      </p>
                      {isLast && (
                        <div style={{ marginTop: 10 }}>
                          <span className="tag accent">presently</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div>
            <SectionHead kicker="set down for those who watch">Hints already dropped</SectionHead>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {p.hooks.map((h, i) => (
                <li key={i} style={{ padding: "12px 0", borderTop: "0.5px dotted var(--rule)", display: "flex", gap: 12 }}>
                  <span className="mono" style={{ color: "var(--accent-deep)" }}>✦</span>
                  <span style={{ fontStyle: "italic", color: "var(--ink-soft)" }}>{h}</span>
                </li>
              ))}
            </ul>

            <SectionHead kicker="those at the heart of it">Central figures</SectionHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {p.central.map((cid) => {
                const c = db().getCharacter(world.id, cid);
                if (!c) return null;
                return (
                  <Link
                    key={cid}
                    href={`/world/${world.id}/character/${cid}`}
                    className="row-link"
                    style={{
                      display: "flex",
                      gap: 14,
                      alignItems: "center",
                      padding: "8px 0",
                      borderTop: "0.5px solid var(--rule)",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <Portrait label="" w={48} h={60} />
                    <div>
                      <div className="display" style={{ fontSize: 18, fontStyle: "italic" }}>{c.name}</div>
                      <div style={{ fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic" }}>{c.epithet}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
