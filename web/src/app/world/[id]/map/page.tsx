import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Fleuron } from "@/components/Primitives";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export default function MapPage({ params }: { params: { id: string } }) {
  const world = db().getWorld(params.id);
  if (!world) notFound();
  const locations = db().listLocations(world.id);

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav worldId={world.id} worldName={world.name} active="map" />

      <div className="page" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.4em", marginBottom: 16 }}>
            ❧&nbsp;&nbsp;the realm in brief&nbsp;&nbsp;❧
          </div>
          <h1 className="display" style={{ fontSize: 64, fontStyle: "italic", lineHeight: 1, marginBottom: 12 }}>
            Places of {world.name}
          </h1>
          <p style={{ fontStyle: "italic", color: "var(--ink-soft)", maxWidth: "60ch", marginInline: "auto" }}>
            A painted map is not yet drawn. For now, the gazetteer.
          </p>
        </div>

        <Fleuron />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24, marginTop: 32 }}>
          {locations.map((l) => (
            <Link
              key={l.id}
              href={`/world/${world.id}/location/${l.id}`}
              className="card clickable"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="display-sc" style={{ fontSize: 12, letterSpacing: "0.32em", color: "var(--ink-faint)", marginBottom: 6 }}>
                {l.type}
              </div>
              <div className="display" style={{ fontSize: 24, fontStyle: "italic", marginBottom: 8 }}>
                {l.name}
              </div>
              <p style={{ fontStyle: "italic", color: "var(--ink-soft)", margin: 0 }}>{l.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
