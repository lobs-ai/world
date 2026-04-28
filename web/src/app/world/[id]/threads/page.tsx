import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Fleuron, SectionHead } from "@/components/Primitives";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = {
  spine: "the spine of the chronicle",
  subplot: "secondary threads",
  ambient: "slow burns of the realm",
};

export default function ThreadsPage({ params }: { params: { id: string } }) {
  const world = db().getWorld(params.id);
  if (!world) notFound();
  const plots = db().listPlots(world.id);
  const factions = db().listFactions(world.id);
  const prophecies = db().listProphecies(world.id);

  const spine = plots.filter((p) => p.tier === "spine");
  const subplots = plots.filter((p) => p.tier === "subplot");
  const ambient = plots.filter((p) => p.tier === "ambient");

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav worldId={world.id} worldName={world.name} active="threads" />

      <div className="page" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.32em", marginBottom: 12 }}>
            ❧&nbsp;&nbsp;the threads of {world.name}&nbsp;&nbsp;❧
          </div>
          <h1 className="display" style={{ fontSize: 64, fontStyle: "italic", lineHeight: 1, marginBottom: 16 }}>
            What is being told
          </h1>
          <p style={{ fontStyle: "italic", color: "var(--ink-soft)", maxWidth: "62ch", marginInline: "auto" }}>
            A spine that pulls forward, threads that cross it, slow burns the world has not yet noticed,
            and the foretellings the chronicler has not yet paid.
          </p>
        </div>

        <Fleuron glyph="✦   ❦   ✦" />

        <PlotTier worldId={world.id} tier="spine" plots={spine} />
        <PlotTier worldId={world.id} tier="subplot" plots={subplots} />
        <PlotTier worldId={world.id} tier="ambient" plots={ambient} />

        <SectionHead kicker="banners and houses with their own momentum">Factions</SectionHead>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
          {factions.length === 0 && (
            <p style={{ fontStyle: "italic", color: "var(--ink-faint)" }}>
              No banner has yet been set in the field.
            </p>
          )}
          {factions.map((f) => (
            <Link
              key={f.id}
              href={`/world/${world.id}/faction/${f.id}`}
              className="card clickable"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="display-sc" style={{ fontSize: 11, letterSpacing: "0.28em", color: "var(--ink-faint)", marginBottom: 6 }}>
                {factionMood(f.tension)}
              </div>
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

        <SectionHead kicker="not yet paid; not yet broken">Foretellings</SectionHead>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {prophecies.length === 0 && (
            <p style={{ fontStyle: "italic", color: "var(--ink-faint)" }}>
              No oracle has spoken into the chronicle.
            </p>
          )}
          {prophecies.map((p) => (
            <Link
              key={p.id}
              href={`/world/${world.id}/prophecy/${p.id}`}
              className="row-link"
              style={{
                textDecoration: "none",
                color: "inherit",
                padding: "16px 0",
                borderTop: "0.5px solid var(--rule)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span className="display-sc" style={{ fontSize: 12, letterSpacing: "0.22em", color: "var(--accent-deep)" }}>
                  {prophecyStatusLabel(p.status)}
                </span>
              </div>
              <p style={{ fontStyle: "italic", fontSize: 19, margin: 0, color: "var(--ink)" }}>
                “{p.text}”
              </p>
              <div style={{ fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic", marginTop: 6 }}>
                — {p.source}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlotTier({
  worldId,
  tier,
  plots,
}: {
  worldId: string;
  tier: "spine" | "subplot" | "ambient";
  plots: ReturnType<ReturnType<typeof db>["listPlots"]>;
}) {
  if (plots.length === 0) return null;
  return (
    <>
      <SectionHead kicker={tier === "spine" ? "the through-line" : tier === "subplot" ? "secondary threads" : "slow burns"}>
        {TIER_LABEL[tier]}
      </SectionHead>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {plots.map((p) => (
          <Link
            key={p.id}
            href={`/world/${worldId}/plot/${p.id}`}
            className="card clickable"
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span className="display-sc" style={{ fontSize: 11, letterSpacing: "0.28em", color: "var(--ink-faint)" }}>
                {plotMood(p.state, p.tension)}
              </span>
            </div>
            <div className="display" style={{ fontSize: 26, fontStyle: "italic", marginBottom: 6 }}>
              {p.title}
            </div>
            <p style={{ margin: 0, fontSize: 15, fontStyle: "italic", color: "var(--ink-soft)" }}>
              {p.arc}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}

function factionMood(tension: number): string {
  if (tension >= 0.85) return "on the brink";
  if (tension >= 0.65) return "fraying";
  if (tension >= 0.4) return "watchful";
  if (tension >= 0.2) return "quiet, for now";
  return "at rest";
}

function plotMood(state: string, tension: number): string {
  if (state === "resolved") return "resolved";
  if (state === "climax") return "at its turning";
  if (state === "falling") return "the dust settling";
  if (tension >= 0.75) return "rising sharply";
  if (state === "rising") return "rising";
  if (state === "setup") return "newly opened";
  return "still gathering";
}

function prophecyStatusLabel(s: string): string {
  switch (s) {
    case "echoing":
      return "echoes already heard";
    case "half_fulfilled":
      return "half-true so far";
    case "fulfilled":
      return "the moment paid";
    case "broken":
      return "broken";
    default:
      return "not yet paid, not yet broken";
  }
}
