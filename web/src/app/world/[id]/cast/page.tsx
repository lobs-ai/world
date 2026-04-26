import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Fleuron, Portrait, SectionHead } from "@/components/Primitives";
import { Nav } from "@/components/Nav";
import type { Character } from "@world/app";

export const dynamic = "force-dynamic";

const TIER_LABEL = {
  principal: "the named at the heart of it",
  secondary: "the named who bear the weight",
  atmospheric: "the named who fill the world",
} as const;

export default function CastPage({ params }: { params: { id: string } }) {
  const world = db().getWorld(params.id);
  if (!world) notFound();
  const cast = db().listCharacters(world.id);
  const principals = cast.filter((c) => c.weight === "principal");
  const secondaries = cast.filter((c) => c.weight === "secondary");
  const atmospherics = cast.filter((c) => c.weight === "atmospheric");

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav worldId={world.id} worldName={world.name} active="cast" />

      <div className="page" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.32em", marginBottom: 12 }}>
            ❧&nbsp;&nbsp;the named of {world.name}&nbsp;&nbsp;❧
          </div>
          <h1 className="display" style={{ fontSize: 64, fontStyle: "italic", lineHeight: 1, marginBottom: 12 }}>
            The chronicle's people
          </h1>
          <p style={{ fontStyle: "italic", color: "var(--ink-soft)", maxWidth: "62ch", marginInline: "auto" }}>
            {cast.length} named, of every weight — the queen, the steward, the
            abbot, the marsh-witch who knows what was buried at the
            crossroads. Each carries their own desires and their own
            unspoken things.
          </p>
        </div>

        <Fleuron glyph="✦   ❦   ✦" />

        <CastTier worldId={world.id} tier="principal" cast={principals} />
        <CastTier worldId={world.id} tier="secondary" cast={secondaries} />
        <CastTier worldId={world.id} tier="atmospheric" cast={atmospherics} />
      </div>
    </div>
  );
}

function CastTier({
  worldId,
  tier,
  cast,
}: {
  worldId: string;
  tier: keyof typeof TIER_LABEL;
  cast: Character[];
}) {
  if (cast.length === 0) return null;
  return (
    <>
      <SectionHead kicker={`${cast.length} ${tier}`}>{TIER_LABEL[tier]}</SectionHead>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {cast.map((c) => (
          <Link
            key={c.id}
            href={`/world/${worldId}/character/${c.id}`}
            className="row-link"
            style={{
              display: "grid",
              gridTemplateColumns: "52px 1fr",
              gap: 12,
              alignItems: "center",
              padding: "10px 0",
              borderTop: "0.5px solid var(--rule)",
              textDecoration: "none",
              color: "inherit",
              opacity: c.alive ? 1 : 0.6,
            }}
          >
            <Portrait label="" w={52} h={66} />
            <div>
              <div className="display" style={{ fontSize: 18, fontStyle: "italic", lineHeight: 1.1 }}>
                {c.name} {!c.alive && <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>† dead</span>}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-faint)", fontStyle: "italic", marginTop: 2 }}>
                {c.epithet}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
