import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Fleuron, IntensityBar, Portrait, SectionHead } from "@/components/Primitives";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export default function FactionPage({
  params,
}: {
  params: { id: string; fid: string };
}) {
  const world = db().getWorld(params.id);
  if (!world) notFound();
  const f = db().getFaction(world.id, params.fid);
  if (!f) notFound();
  const seat = f.seatLocationId ? db().getLocation(world.id, f.seatLocationId) : null;
  const members = db()
    .listCharacters(world.id)
    .filter((c) => c.factionId === f.id);
  const plots = db()
    .listPlots(world.id)
    .filter((p) => p.factionIds.includes(f.id));

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav worldId={world.id} worldName={world.name} active="threads" />

      <div className="page" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.32em", marginBottom: 12 }}>
            a banner of the realm
          </div>
          <h1 className="display" style={{ fontSize: 64, fontStyle: "italic", lineHeight: 1, marginBottom: 12 }}>
            {f.name}
          </h1>
          <p style={{ fontStyle: "italic", color: "var(--ink-soft)", maxWidth: "60ch", marginInline: "auto" }}>
            {f.banner}
          </p>
        </div>

        <Fleuron glyph="✦   ❦   ✦" />

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 64, marginTop: 24 }}>
          <div>
            <SectionHead kicker="who they are">In short</SectionHead>
            <p style={{ fontSize: 17, color: "var(--ink)" }}>{f.summary}</p>

            <SectionHead kicker="what they want">Collective desires</SectionHead>
            <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {f.desires.map((d, i) => (
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
                  <span style={{ flex: 1, fontSize: 17, fontStyle: d.unspoken ? "italic" : "normal" }}>
                    {d.unspoken ? `(${d.goal})` : d.goal}
                  </span>
                  <IntensityBar v={d.intensity} />
                </li>
              ))}
            </ol>

            <SectionHead kicker="threads they touch">Plots they steer</SectionHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {plots.length === 0 && (
                <p style={{ fontStyle: "italic", color: "var(--ink-faint)" }}>None named yet.</p>
              )}
              {plots.map((p) => (
                <Link
                  key={p.id}
                  href={`/world/${world.id}/plot/${p.id}`}
                  className="row-link"
                  style={{ textDecoration: "none", color: "inherit", padding: "10px 0", borderTop: "0.5px solid var(--rule)" }}
                >
                  <div className="display-sc" style={{ fontSize: 11, letterSpacing: "0.22em", color: "var(--ink-faint)" }}>
                    {p.tier} · {p.state}
                  </div>
                  <div className="display" style={{ fontSize: 20, fontStyle: "italic" }}>{p.title}</div>
                </Link>
              ))}
            </div>
          </div>

          <div>
            {seat && (
              <>
                <SectionHead kicker="their stronghold">Seat</SectionHead>
                <Link
                  href={`/world/${world.id}/location/${seat.id}`}
                  className="row-link"
                  style={{ textDecoration: "none", color: "inherit", display: "block" }}
                >
                  <div className="display" style={{ fontSize: 22, fontStyle: "italic" }}>{seat.name}</div>
                  <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0, fontStyle: "italic" }}>
                    {seat.description}
                  </p>
                </Link>
              </>
            )}
            <SectionHead kicker="under this banner">Members</SectionHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {members.length === 0 && (
                <p style={{ fontStyle: "italic", color: "var(--ink-faint)" }}>None at present.</p>
              )}
              {members.map((m) => (
                <Link
                  key={m.id}
                  href={`/world/${world.id}/character/${m.id}`}
                  className="row-link"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "48px 1fr",
                    gap: 12,
                    alignItems: "center",
                    padding: "8px 0",
                    borderTop: "0.5px solid var(--rule)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <Portrait label="" w={48} h={60} />
                  <div>
                    <div className="display" style={{ fontSize: 18, fontStyle: "italic" }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-faint)", fontStyle: "italic" }}>
                      {m.epithet} · {m.weight}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
