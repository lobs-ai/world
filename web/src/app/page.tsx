import Link from "next/link";
import { db } from "@/lib/db";
import { Fleuron, SectionHead } from "@/components/Primitives";

export const dynamic = "force-dynamic";

export default function LandingPage() {
  const worlds = db().listWorlds();
  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <div className="page page-narrow" style={{ paddingTop: 100, position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center" }}>
          <div className="display-sc" style={{ fontSize: 14, color: "var(--ink-faint)", letterSpacing: "0.4em", marginBottom: 22 }}>
            ❧&nbsp;&nbsp;a chronicle that writes itself&nbsp;&nbsp;❧
          </div>
          <h1 className="display" style={{ fontStyle: "italic", lineHeight: 1.1, marginBottom: 36 }}>
            Set down a premise.<br />Return to find a world.
          </h1>
          <p style={{ marginTop: 0, fontSize: 19, color: "var(--ink-soft)", maxWidth: "44ch", marginInline: "auto" }}>
            One sentence is enough. The chronicle begins within the hour and keeps writing whether or not you are watching.
          </p>
        </div>

        <Fleuron />

        <div style={{ marginTop: 80 }}>
          <SectionHead kicker="open chronicles">Worlds in progress</SectionHead>
          {worlds.length === 0 ? (
            <p style={{ fontStyle: "italic", color: "var(--ink-faint)", textAlign: "center", padding: "32px 0" }}>
              None yet. The cartographer&rsquo;s desk is bare.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 18 }}>
              {worlds.map((w) => (
                <Link
                  key={w.id}
                  href={`/world/${w.id}`}
                  className="card clickable"
                  style={{
                    borderLeft: "2px solid var(--accent)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div className="display" style={{ fontSize: 24, fontStyle: "italic", marginBottom: 4 }}>{w.name}</div>
                  <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 12 }}>
                    {[w.tone, ...w.themes.slice(0, 2)].filter(Boolean).join(" · ")}
                  </div>
                  <p style={{ fontStyle: "italic", color: "var(--ink-soft)", margin: 0 }}>{w.premise}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
