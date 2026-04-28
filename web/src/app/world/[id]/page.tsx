import Link from "next/link";
import { notFound } from "next/navigation";
import type { ChronicleEntry, Paragraph } from "@world/app";
import { db } from "@/lib/db";
import { Fleuron, romanize } from "@/components/Primitives";
import { Nav } from "@/components/Nav";
import { ChronicleImage, imageUrlFromPath } from "@/components/ChronicleImage";
import {
  chapterTimeline,
  currentChapter,
  latestPullQuote,
  mainStory,
} from "@/lib/story";

export const dynamic = "force-dynamic";

export default function ChroniclePage({ params }: { params: { id: string } }) {
  const world = db().getWorld(params.id);
  if (!world) notFound();
  const story = mainStory(world);
  const chapter = currentChapter(world, 30);
  const timeline = chapterTimeline(world);
  const pullQuote = latestPullQuote(world);

  const totalEntries = chapter.thisChapter.length + chapter.earlier.length;
  const hasStory = !!story.protagonist;
  const heroPortraitUrl = story.protagonist
    ? imageUrlFromPath(story.protagonist.imagePath)
    : null;

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav worldId={world.id} worldName={world.name} active="chronicle" />

      {/* ── Slim banner: the world's name and the moment in its calendar.
            The world is the *setting* of the story; the chapter hero
            below is the story itself. ─────────────────────────────── */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "56px 64px 0",
          maxWidth: 1280,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <div
          className="display-sc"
          style={{
            fontSize: 12,
            color: "var(--ink-faint)",
            letterSpacing: "0.4em",
            marginBottom: 10,
          }}
        >
          ✦&nbsp;&nbsp;the chronicle of&nbsp;&nbsp;✦
        </div>
        <h1
          className="display"
          style={{
            fontStyle: "italic",
            fontSize: 44,
            lineHeight: 1.05,
            marginBottom: 6,
          }}
        >
          {world.name}
        </h1>
        <p
          style={{
            fontSize: 14,
            fontStyle: "italic",
            color: "var(--ink-faint)",
            margin: 0,
            maxWidth: "60ch",
            marginInline: "auto",
          }}
        >
          {world.era}
          {totalEntries > 0 && (
            <>
              <span style={{ margin: "0 10px", opacity: 0.5 }}>·</span>
              <span className="mono" style={{ letterSpacing: "0.18em", textTransform: "uppercase", fontStyle: "normal", fontSize: 11 }}>
                {totalEntries} writ{totalEntries === 1 ? "" : "s"} so far
              </span>
            </>
          )}
        </p>
      </section>

      {/* ── Chapter hero: the dramatic now. Big, present-tense, with the
            beat sketch as the question this chapter is asking. ──────── */}
      {hasStory && chapter.beat && (
        <section
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 1100,
            margin: "44px auto 28px",
            padding: "0 64px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: heroPortraitUrl ? "240px 1fr" : "1fr",
              gap: 44,
              alignItems: "start",
              padding: "40px 44px",
              border: "0.5px solid var(--rule)",
              background: "var(--paper-deep)",
            }}
          >
            {heroPortraitUrl && (
              <Link
                href={`/world/${world.id}/character/${story.protagonist!.id}`}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroPortraitUrl}
                  alt={story.protagonist!.name}
                  style={{
                    width: 240,
                    height: 300,
                    objectFit: "cover",
                    border: "0.5px solid rgba(0,0,0,0.18)",
                    display: "block",
                  }}
                />
                <div
                  className="display"
                  style={{
                    fontSize: 18,
                    fontStyle: "italic",
                    marginTop: 10,
                    color: "var(--ink)",
                  }}
                >
                  {story.protagonist!.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontStyle: "italic",
                    color: "var(--ink-faint)",
                  }}
                >
                  {story.protagonist!.epithet}
                </div>
              </Link>
            )}

            <div>
              <div
                className="display-sc"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.32em",
                  color: "var(--ink-faint)",
                  marginBottom: 8,
                }}
              >
                Chapter {romanize(chapter.number)} &nbsp;·&nbsp; {chapter.beat.when}
              </div>
              <h2
                className="display"
                style={{
                  fontSize: 32,
                  fontStyle: "italic",
                  lineHeight: 1.1,
                  margin: "0 0 14px 0",
                  color: "var(--ink-soft)",
                }}
              >
                {chapter.beat.title}
              </h2>

              {/* The dramatic question is the chapter's identity. Big,
                  italic, present-tense — what the reader is watching for. */}
              <p
                className="display"
                style={{
                  fontSize: 36,
                  fontStyle: "italic",
                  lineHeight: 1.18,
                  color: "var(--ink)",
                  margin: 0,
                  maxWidth: "26ch",
                }}
              >
                {chapter.beat.question ?? chapter.beat.sketch}
              </p>

              {chapter.beat.stakes && (
                <p
                  style={{
                    fontSize: 17,
                    lineHeight: 1.55,
                    color: "var(--ink-soft)",
                    margin: "18px 0 0 0",
                    maxWidth: "52ch",
                  }}
                >
                  <span
                    className="display-sc"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.28em",
                      color: "var(--accent-deep)",
                      marginRight: 8,
                    }}
                  >
                    if it goes wrong —
                  </span>
                  {chapter.beat.stakes}
                </p>
              )}

              {/* When a beat carries a question, the sketch becomes
                  background colour rather than the headline. */}
              {chapter.beat.question && chapter.beat.sketch && (
                <p
                  style={{
                    fontSize: 14,
                    fontStyle: "italic",
                    lineHeight: 1.55,
                    color: "var(--ink-faint)",
                    margin: "14px 0 0 0",
                    maxWidth: "56ch",
                  }}
                >
                  {chapter.beat.sketch}
                </p>
              )}

              {pullQuote && (
                <blockquote
                  style={{
                    margin: "26px 0 0 0",
                    paddingLeft: 18,
                    borderLeft: "2px solid var(--accent-deep)",
                    fontSize: 17,
                    fontStyle: "italic",
                    color: "var(--ink)",
                    lineHeight: 1.55,
                  }}
                >
                  {pullQuote.quote}
                  {pullQuote.speakerName && (
                    <span
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: "var(--ink-faint)",
                        marginTop: 6,
                        fontStyle: "italic",
                      }}
                    >
                      — {pullQuote.speakerName}, in “{pullQuote.entryTitle}”
                    </span>
                  )}
                </blockquote>
              )}

              {story.spine && (
                <p
                  style={{
                    fontSize: 14,
                    fontStyle: "italic",
                    color: "var(--ink-faint)",
                    margin: "24px 0 0 0",
                    maxWidth: "60ch",
                    lineHeight: 1.55,
                  }}
                >
                  <span
                    className="display-sc"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.28em",
                      color: "var(--ink-faint)",
                      marginRight: 8,
                      fontStyle: "normal",
                    }}
                  >
                    the through-line —
                  </span>
                  {story.spine.arc}
                </p>
              )}

              <div style={{ marginTop: 22, display: "flex", gap: 18, flexWrap: "wrap" }}>
                <Link
                  href={`/world/${world.id}/story`}
                  className="inline-link"
                  style={{ fontSize: 13, color: "var(--accent-deep)", letterSpacing: "0.04em" }}
                >
                  New here? Begin with the story →
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

      {/* ── Chapter progress strip — visible spine. Each marker is a
            past or current beat; the current one is filled. ────────── */}
      {timeline.length > 0 && (
        <section
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 1100,
            margin: "0 auto 64px",
            padding: "0 64px",
          }}
        >
          <Link
            href={`/world/${world.id}/story`}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            <div
              className="display-sc"
              style={{
                fontSize: 11,
                letterSpacing: "0.32em",
                color: "var(--ink-faint)",
                marginBottom: 14,
                textAlign: "center",
              }}
            >
              the chapters so far
            </div>
            <ol
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gridTemplateColumns: `repeat(${timeline.length}, 1fr)`,
                gap: 0,
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 12,
                  right: 12,
                  top: 7,
                  height: 1,
                  background: "var(--rule)",
                  opacity: 0.55,
                }}
              />
              {timeline.map((m) => (
                <li
                  key={m.index}
                  style={{
                    position: "relative",
                    textAlign: "center",
                    paddingTop: 22,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: 0,
                      transform: "translateX(-50%)",
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      border: `1px solid ${m.active ? "var(--accent-deep)" : "var(--ink-soft)"}`,
                      background: m.active ? "var(--accent)" : "var(--paper)",
                    }}
                  />
                  <div
                    className="mono"
                    style={{
                      fontSize: 9.5,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "var(--ink-faint)",
                      marginBottom: 2,
                    }}
                  >
                    {romanize(m.index)}
                  </div>
                  <div
                    className="display"
                    style={{
                      fontSize: 13,
                      fontStyle: "italic",
                      color: m.active ? "var(--ink)" : "var(--ink-soft)",
                      lineHeight: 1.25,
                      padding: "0 6px",
                    }}
                  >
                    {m.title}
                  </div>
                </li>
              ))}
            </ol>
          </Link>
        </section>
      )}

      {!hasStory && (
        <section
          style={{
            position: "relative",
            zIndex: 1,
            padding: "0 64px",
            maxWidth: 1100,
            margin: "0 auto 60px",
            textAlign: "center",
          }}
        >
          <Fleuron glyph="✦   ✦   ✦" />
          <p style={{ fontStyle: "italic", color: "var(--ink-soft)", fontSize: 18 }}>
            The chronicle has just begun.
          </p>
        </section>
      )}

      {/* ── The writs ────────────────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "0 64px 120px",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div style={{ maxWidth: "64ch", marginInline: "auto", position: "relative" }}>
          {totalEntries === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <p style={{ fontStyle: "italic", color: "var(--ink-soft)", fontSize: 18, margin: 0 }}>
                The first writ is being set down.
              </p>
              <p style={{ fontStyle: "italic", color: "var(--ink-faint)", fontSize: 14, marginTop: 6 }}>
                Return in a moment.
              </p>
            </div>
          ) : (
            <>
              {chapter.thisChapter.length > 0 && (
                <>
                  <ChapterDivider
                    label={hasStory && chapter.beat ? "Within this chapter" : "Recent writs"}
                    sub={
                      hasStory && chapter.beat
                        ? `“${chapter.beat.title}” — ${chapter.thisChapter.length} writ${
                            chapter.thisChapter.length === 1 ? "" : "s"
                          }`
                        : null
                    }
                  />
                  {chapter.thisChapter.map((e, i) => (
                    <ChronicleArticle
                      key={e.id}
                      entry={e}
                      worldId={world.id}
                      showOpener={i === 0}
                      idx={i}
                    />
                  ))}
                </>
              )}

              {chapter.thisChapter.length === 0 && hasStory && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 0",
                    fontStyle: "italic",
                    color: "var(--ink-faint)",
                  }}
                >
                  The chapter has just turned. The first writ of it is on its way.
                </div>
              )}

              {chapter.earlier.length > 0 && (
                <>
                  <ChapterDivider
                    label="Earlier writs"
                    sub="From chapters before"
                    muted
                  />
                  {chapter.earlier.map((e, i) => (
                    <ChronicleArticle
                      key={e.id}
                      entry={e}
                      worldId={world.id}
                      showOpener={false}
                      idx={i}
                      muted
                    />
                  ))}
                </>
              )}
            </>
          )}

          <div style={{ textAlign: "center", marginTop: 60 }}>
            <span
              className="display-sc"
              style={{ color: "var(--ink-faint)", fontSize: 14, letterSpacing: "0.32em" }}
            >
              ❧ &nbsp; here ends the present writ &nbsp; ❧
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

function ChapterDivider({
  label,
  sub,
  muted,
}: {
  label: string;
  sub?: string | null;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        margin: "20px 0 56px",
        opacity: muted ? 0.85 : 1,
      }}
    >
      <div
        style={{
          height: 1,
          background: "var(--rule)",
          opacity: 0.6,
          margin: "0 auto 18px",
          maxWidth: 180,
        }}
      />
      <div
        className="display-sc"
        style={{
          fontSize: 12,
          letterSpacing: "0.36em",
          color: muted ? "var(--ink-faint)" : "var(--accent-deep)",
        }}
      >
        ✦ &nbsp; {label} &nbsp; ✦
      </div>
      {sub && (
        <div
          style={{
            fontSize: 13,
            fontStyle: "italic",
            color: "var(--ink-faint)",
            marginTop: 6,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function ChronicleArticle({
  entry,
  worldId,
  showOpener,
  idx,
  muted,
}: {
  entry: ChronicleEntry;
  worldId: string;
  showOpener: boolean;
  idx: number;
  muted?: boolean;
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
    <article
      style={{
        marginBottom: 80,
        position: "relative",
        opacity: muted ? 0.78 : 1,
      }}
    >
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

      {tagPlot && (
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
          <Link href={`/world/${worldId}/plot/${tagPlot.id}`} style={{ color: "var(--accent-deep)", textDecoration: "none" }}>
            {tagPlot.title}
          </Link>
        </div>
      )}

      <h2 className="display" style={{ fontStyle: "italic", fontSize: 38, lineHeight: 1.05, marginBottom: 14, color: "var(--ink)" }}>
        {entry.title}
      </h2>

      {entry.imagePath && (
        <ChronicleImage path={entry.imagePath} alt={entry.title} aspect="16 / 9" />
      )}

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

