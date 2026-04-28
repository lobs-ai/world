import Link from "next/link";
import { notFound } from "next/navigation";
import type { ChronicleEntry, Paragraph } from "@world/app";
import { db } from "@/lib/db";
import { Fleuron } from "@/components/Primitives";
import { Nav } from "@/components/Nav";
import { ChronicleImage, imageUrlFromPath } from "@/components/ChronicleImage";
import { latestPullQuote, mainStory, storySoFar } from "@/lib/story";

export const dynamic = "force-dynamic";

export default function ChroniclePage({ params }: { params: { id: string } }) {
  const world = db().getWorld(params.id);
  if (!world) notFound();
  const entries = db().listEntries(world.id, 30);
  const story = mainStory(world);
  const sof = storySoFar(world);
  const pullQuote = latestPullQuote(world);

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav worldId={world.id} worldName={world.name} active="chronicle" />

      <section style={{ position: "relative", zIndex: 1, padding: "80px 64px 0", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ textAlign: "center" }}>
          <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.4em", marginBottom: 16 }}>
            ✦&nbsp;&nbsp;the chronicle of&nbsp;&nbsp;✦
          </div>
          <h1 className="display" style={{ fontStyle: "italic", fontSize: 92, lineHeight: 1, marginBottom: 28, paddingBottom: 6 }}>
            {world.name}
          </h1>
          <p style={{ fontSize: 19, fontStyle: "italic", color: "var(--ink-soft)", maxWidth: "52ch", marginInline: "auto" }}>
            {world.era}
          </p>
          <div style={{ marginTop: 28, display: "flex", gap: 24, justifyContent: "center", alignItems: "center" }}>
            <span className="mono" style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
              {entries[0] ? `last writ on ${entries[0].inWorldDate}` : "the chronicle is yet to begin"}
            </span>
          </div>
        </div>
        <Fleuron glyph="✦   ✦   ✦" />
      </section>

      {/* ── Story So Far hero ────────────────────────────────────────── */}
      {story.protagonist && entries.length > 0 && (
        <section
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 1100,
            margin: "0 auto 60px",
            padding: "0 64px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "200px 1fr",
              gap: 36,
              padding: "32px 36px",
              border: "0.5px solid var(--rule)",
              background: "var(--paper-deep)",
              alignItems: "start",
            }}
          >
            <Link
              href={`/world/${world.id}/story`}
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
              {(() => {
                const url = imageUrlFromPath(story.protagonist!.imagePath);
                return url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={story.protagonist!.name}
                    style={{
                      width: 200,
                      height: 250,
                      objectFit: "cover",
                      border: "0.5px solid rgba(0,0,0,0.18)",
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 200,
                      height: 250,
                      background: "var(--paper)",
                      border: "0.5px solid rgba(0,0,0,0.16)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--display)",
                      fontStyle: "italic",
                      fontSize: 60,
                      color: "var(--ink-faint)",
                    }}
                  >
                    {story
                      .protagonist!.name.split(/\s+/)
                      .slice(0, 2)
                      .map((s) => s[0]!)
                      .join("")}
                  </div>
                );
              })()}
            </Link>
            <div>
              <div className="display-sc" style={{ fontSize: 11, letterSpacing: "0.32em", color: "var(--accent-deep)", marginBottom: 8 }}>
                the story so far
              </div>
              <h2 className="display" style={{ fontSize: 36, fontStyle: "italic", lineHeight: 1.05, marginBottom: 4 }}>
                <Link href={`/world/${world.id}/story`} style={{ color: "inherit", textDecoration: "none" }}>
                  {story.spine?.title ?? story.protagonist.name}
                </Link>
              </h2>
              <div style={{ fontSize: 14, fontStyle: "italic", color: "var(--ink-faint)", marginBottom: 16 }}>
                {story.protagonist.name} — {story.protagonist.epithet}
              </div>
              <p style={{ fontSize: 16, lineHeight: 1.55, color: "var(--ink-soft)", margin: 0, fontStyle: "italic" }}>
                {sof.arc}
              </p>
              {sof.latestBeatTitle && (
                <p style={{ fontSize: 14, color: "var(--ink-faint)", marginTop: 12, fontStyle: "italic" }}>
                  Most recently: <span style={{ color: "var(--ink-soft)" }}>{sof.latestBeatTitle}</span>
                  {sof.latestBeatSketch ? ` — ${sof.latestBeatSketch}` : ""}
                </p>
              )}
              {pullQuote && (
                <blockquote
                  style={{
                    margin: "20px 0 0 0",
                    paddingLeft: 16,
                    borderLeft: "2px solid var(--accent-deep)",
                    fontSize: 16,
                    fontStyle: "italic",
                    color: "var(--ink)",
                  }}
                >
                  {pullQuote.quote}
                  {pullQuote.speakerName && (
                    <span style={{ display: "block", fontSize: 12, color: "var(--ink-faint)", marginTop: 6, fontStyle: "italic" }}>
                      — {pullQuote.speakerName}, in “{pullQuote.entryTitle}”
                    </span>
                  )}
                </blockquote>
              )}
              <div style={{ marginTop: 22, display: "flex", gap: 14 }}>
                <Link
                  href={`/world/${world.id}/story`}
                  className="inline-link"
                  style={{ fontSize: 13, color: "var(--accent-deep)", letterSpacing: "0.04em" }}
                >
                  Open the full story →
                </Link>
                <Link
                  href={`/world/${world.id}/about`}
                  className="inline-link"
                  style={{ fontSize: 13, color: "var(--ink-faint)" }}
                >
                  Or wander the world
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <section style={{ position: "relative", zIndex: 1, padding: "0 64px 120px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ maxWidth: "64ch", marginInline: "auto", position: "relative" }}>
          {entries.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <p style={{ fontStyle: "italic", color: "var(--ink-soft)", fontSize: 18, margin: 0 }}>
                The chronicle has just begun.
              </p>
              <p style={{ fontStyle: "italic", color: "var(--ink-faint)", fontSize: 14, marginTop: 6 }}>
                The first writ is being set down. Return in a moment.
              </p>
            </div>
          ) : (
            entries.map((e, i) => (
              <ChronicleArticle
                key={e.id}
                entry={e}
                worldId={world.id}
                showOpener={i === 0}
                idx={i}
              />
            ))
          )}

          <div style={{ textAlign: "center", marginTop: 60 }}>
            <span className="display-sc" style={{ color: "var(--ink-faint)", fontSize: 14, letterSpacing: "0.32em" }}>
              ❧ &nbsp; here ends the present writ &nbsp; ❧
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

function ChronicleArticle({
  entry,
  worldId,
  showOpener,
  idx,
}: {
  entry: ChronicleEntry;
  worldId: string;
  showOpener: boolean;
  idx: number;
}) {
  const characters = db().listCharacters(worldId);
  const locations = db().listLocations(worldId);
  const plots = db().listPlots(worldId);

  const charById = new Map(characters.map((c) => [c.id, c]));
  const locById = new Map(locations.map((l) => [l.id, l]));
  const plotById = new Map(plots.map((p) => [p.id, p]));

  const tagPlot = entry.plotIds[0] ? plotById.get(entry.plotIds[0]) : undefined;
  const tagPlaces = entry.locationIds.map((id) => locById.get(id)).filter(Boolean);
  const sceneCast = entry.characterIds
    .map((id) => charById.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const isReport = entry.beatType === "world_report";

  return (
    <article style={{ marginBottom: 80, position: "relative" }}>
      {/* date / weather marginalia (only on wide screens via CSS) */}
      <div
        className="marginalia"
        style={{
          position: "absolute",
          left: -210,
          top: 6,
          width: 190,
          textAlign: "right",
          color: "var(--ink-faint)",
          fontFamily: "var(--mono)",
          fontSize: 10.5,
          lineHeight: 1.7,
          letterSpacing: "0.04em",
        }}
      >
        <div className="display-sc" style={{ fontSize: 13, letterSpacing: "0.16em", color: "var(--ink-soft)", marginBottom: 6 }}>
          {entry.inWorldDate}
        </div>
        <div>{entry.timeOfDay}</div>
        <div style={{ fontStyle: "italic", marginTop: 4 }}>{entry.weather}</div>
      </div>

      {/* Plot kicker — show the plot and beat type as a single forward line */}
      <div
        className="display-sc"
        style={{
          fontSize: 11,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
          marginBottom: 8,
        }}
      >
        {tagPlot ? (
          <>
            <Link href={`/world/${worldId}/plot/${tagPlot.id}`} style={{ color: "var(--accent-deep)", textDecoration: "none" }}>
              {tagPlot.title}
            </Link>
            <span style={{ margin: "0 10px", opacity: 0.5 }}>·</span>
            <span>{readableBeatType(entry.beatType)}</span>
          </>
        ) : (
          <span>{readableBeatType(entry.beatType)}</span>
        )}
      </div>

      <h2 className="display" style={{ fontStyle: "italic", fontSize: 38, lineHeight: 1.05, marginBottom: 14, color: "var(--ink)" }}>
        {entry.title}
      </h2>

      {entry.imagePath && (
        <ChronicleImage path={entry.imagePath} alt={entry.title} aspect="16 / 9" />
      )}

      {/* Scene meta strip: place(s) + cast. Hidden on world reports. */}
      {!isReport && (sceneCast.length > 0 || tagPlaces.length > 0) && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "6px 14px",
            fontSize: 13,
            color: "var(--ink-soft)",
            marginBottom: 26,
            paddingBottom: 14,
            borderBottom: "0.5px solid var(--rule)",
          }}
        >
          {tagPlaces.length > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Glyph>◇</Glyph>
              {tagPlaces.slice(0, 2).map((p, i) =>
                p ? (
                  <span key={p.id}>
                    {i > 0 && <span style={{ opacity: 0.4 }}>, </span>}
                    <Link
                      href={`/world/${worldId}/location/${p.id}`}
                      style={{ color: "inherit", textDecoration: "none", borderBottom: "0.5px dotted var(--ink-faint)" }}
                    >
                      {p.name}
                    </Link>
                  </span>
                ) : null,
              )}
            </span>
          )}
          {sceneCast.length > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontStyle: "italic" }}>
              <Glyph>◌</Glyph>
              <span style={{ fontStyle: "normal", letterSpacing: "0.04em", textTransform: "uppercase", fontSize: 10.5, color: "var(--ink-faint)" }}>with</span>
              {sceneCast.slice(0, 5).map((c, i) => (
                <span key={c.id}>
                  {i > 0 && <span style={{ opacity: 0.4 }}>, </span>}
                  <Link
                    href={`/world/${worldId}/character/${c.id}`}
                    style={{ color: "inherit", textDecoration: "none", borderBottom: "0.5px dotted var(--ink-faint)" }}
                  >
                    {c.name}
                  </Link>
                </span>
              ))}
              {sceneCast.length > 5 && <span style={{ opacity: 0.6 }}>+{sceneCast.length - 5}</span>}
            </span>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {entry.paragraphs.map((p, i) => {
          const prev = i > 0 ? entry.paragraphs[i - 1] : null;
          return (
            <ParagraphView
              key={i}
              p={p}
              prevKind={prev?.kind}
              prevSpeakerId={prev && prev.kind === "dialogue" ? prev.who : undefined}
              isFirstScene={i === 0 && showOpener && p.kind === "scene"}
              charLookupName={(id) => charById.get(id)?.name ?? id}
              charLookupEpithet={(id) => charById.get(id)?.epithet ?? ""}
            />
          );
        })}
      </div>

      <Fleuron glyph={idx % 2 === 0 ? "✦" : "❦"} />
    </article>
  );
}

function ParagraphView({
  p,
  prevKind,
  prevSpeakerId,
  isFirstScene,
  charLookupName,
  charLookupEpithet,
}: {
  p: Paragraph;
  prevKind?: Paragraph["kind"];
  prevSpeakerId?: string;
  isFirstScene: boolean;
  charLookupName: (id: string) => string;
  charLookupEpithet: (id: string) => string;
}) {
  if (p.kind === "dialogue") {
    const speakerName = p.who ? charLookupName(p.who) : "";
    const speakerEpithet = p.who ? charLookupEpithet(p.who) : "";
    const sameSpeakerAsPrev = prevKind === "dialogue" && prevSpeakerId === p.who;

    // Bigger top margin if we're starting a new speaker after a scene/aside.
    const topGap = sameSpeakerAsPrev ? 4 : prevKind === "dialogue" ? 12 : 18;

    return (
      <div style={{ marginTop: topGap, marginBottom: 4 }}>
        {!sameSpeakerAsPrev && speakerName && (
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10.5,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--accent-deep)",
              marginBottom: 4,
              paddingLeft: 22,
            }}
            title={speakerEpithet}
          >
            {speakerName}
          </div>
        )}
        <p
          style={{
            paddingLeft: 22,
            borderLeft: "2px solid var(--accent-deep)",
            color: "var(--ink)",
            fontSize: 18,
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          {p.text}
        </p>
      </div>
    );
  }
  if (p.kind === "aside") {
    return (
      <p
        style={{
          fontStyle: "italic",
          color: "var(--ink-soft)",
          fontSize: 16.5,
          lineHeight: 1.6,
          margin: "16px 0 16px 8px",
          paddingLeft: 18,
          borderLeft: "1px dotted var(--ink-ghost)",
        }}
      >
        {p.text}
      </p>
    );
  }
  return (
    <p
      className={isFirstScene ? "dropcap-illum" : undefined}
      style={{
        margin: "10px 0",
        fontSize: 17,
        lineHeight: 1.65,
      }}
    >
      {p.text}
    </p>
  );
}

function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ color: "var(--ink-faint)", fontSize: 11, marginRight: 2 }}>{children}</span>
  );
}

function readableBeatType(b: string): string {
  switch (b) {
    case "setup":
      return "Setup";
    case "complication":
      return "Complication";
    case "rising":
      return "Rising Action";
    case "climax":
      return "Climax";
    case "falling":
      return "Falling Action";
    case "resolution":
      return "Resolution";
    case "world_report":
      return "Report from the Realm";
    case "private":
      return "A Quiet Hour";
    default:
      return b;
  }
}
