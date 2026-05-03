"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChronicleEntry, Paragraph } from "@world/app";
import { Fleuron } from "@/components/Primitives";
import { ChronicleImage, imageUrlFromPath } from "@/components/ChronicleImage";

interface CharLite {
  id: string;
  name: string;
  epithet: string;
}
interface LocLite {
  id: string;
  name: string;
}
interface PlotLite {
  id: string;
  title: string;
}

interface ReadBookProps {
  worldId: string;
  worldName: string;
  entries: ChronicleEntry[];
  characters: Record<string, CharLite>;
  locations: Record<string, LocLite>;
  plots: Record<string, PlotLite>;
  initialPage: number;
}

export function ReadBook({
  worldId,
  worldName,
  entries,
  characters,
  locations,
  plots,
  initialPage,
}: ReadBookProps) {
  const total = entries.length;
  const [page, setPage] = useState(initialPage);
  const [turn, setTurn] = useState<"none" | "next" | "prev">("none");
  const turnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback(
    (next: number, direction: "next" | "prev" | "none" = "none") => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      if (clamped === page) return;
      if (direction !== "none") {
        setTurn(direction);
        if (turnTimer.current) clearTimeout(turnTimer.current);
        turnTimer.current = setTimeout(() => setTurn("none"), 320);
      }
      setPage(clamped);
    },
    [page, total],
  );

  const goNext = useCallback(() => goTo(page + 1, "next"), [page, goTo]);
  const goPrev = useCallback(() => goTo(page - 1, "prev"), [page, goTo]);

  // Keep the URL in sync so refreshes / sharing land on the same page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (page === 0) url.searchParams.delete("p");
    else url.searchParams.set("p", String(page));
    window.history.replaceState(null, "", url.toString());
  }, [page]);

  // ← / → navigation. Works anywhere on the page; we don't capture when
  // the user is typing into a field (none here, but defensive).
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (ev.key === "ArrowRight" || ev.key === " " || ev.key === "PageDown") {
        ev.preventDefault();
        goNext();
      } else if (ev.key === "ArrowLeft" || ev.key === "PageUp") {
        ev.preventDefault();
        goPrev();
      } else if (ev.key === "Home") {
        ev.preventDefault();
        goTo(0);
      } else if (ev.key === "End") {
        ev.preventDefault();
        goTo(total - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, goTo, total]);

  const charLookup = useMemo(
    () => ({
      name: (id: string) => characters[id]?.name ?? id,
      epithet: (id: string) => characters[id]?.epithet ?? "",
    }),
    [characters],
  );

  if (total === 0) {
    return (
      <div className="page" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", padding: "120px 0" }}>
          <p style={{ fontStyle: "italic", color: "var(--ink-soft)", fontSize: 20 }}>
            The book has yet to be opened.
          </p>
          <p style={{ fontStyle: "italic", color: "var(--ink-faint)", fontSize: 14 }}>
            No writs have been set down.
          </p>
        </div>
      </div>
    );
  }

  const entry = entries[page]!;
  const isFirst = page === 0;
  const isLast = page === total - 1;

  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        padding: "32px 64px 80px",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      {/* ── Top header strip: world / chapter marker ─────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 24,
          paddingBottom: 12,
          borderBottom: "0.5px solid var(--rule)",
        }}
      >
        <div
          className="display-sc"
          style={{ fontSize: 11, letterSpacing: "0.32em", color: "var(--ink-faint)" }}
        >
          ❧ &nbsp; {worldName}
        </div>
        <div
          className="mono"
          style={{
            fontSize: 10.5,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
          }}
        >
          page {page + 1} of {total}
        </div>
      </div>

      {/* ── The page itself ──────────────────────────────────────────── */}
      <div
        key={entry.id}
        className={`book-page ${turn === "next" ? "is-turning-next" : turn === "prev" ? "is-turning-prev" : ""}`}
      >
        <article style={{ position: "relative" }}>
          <PageHead entry={entry} worldId={worldId} plots={plots} />

          {entry.imagePath && (
            <ChronicleImage path={entry.imagePath} alt={entry.title} aspect="16 / 9" />
          )}

          <SceneTags entry={entry} worldId={worldId} characters={characters} locations={locations} />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {entry.paragraphs.map((p, i) => {
              const prev = i > 0 ? entry.paragraphs[i - 1] : null;
              return (
                <ParagraphView
                  key={i}
                  p={p}
                  prevKind={prev?.kind}
                  prevSpeakerId={prev && prev.kind === "dialogue" ? prev.who : undefined}
                  isFirstScene={i === 0 && p.kind === "scene"}
                  charLookupName={charLookup.name}
                  charLookupEpithet={charLookup.epithet}
                />
              );
            })}
          </div>

          <Fleuron glyph={page % 2 === 0 ? "✦" : "❦"} />
        </article>
      </div>

      {/* ── Page-turn controls ──────────────────────────────────────── */}
      <PageControls
        page={page}
        total={total}
        isFirst={isFirst}
        isLast={isLast}
        onPrev={goPrev}
        onNext={goNext}
        onJump={(n) => goTo(n)}
      />

      {isLast && (
        <div style={{ textAlign: "center", marginTop: 36 }}>
          <span
            className="display-sc"
            style={{ color: "var(--ink-faint)", fontSize: 14, letterSpacing: "0.32em" }}
          >
            ❧ &nbsp; here ends the book, for now &nbsp; ❧
          </span>
          <div style={{ marginTop: 14 }}>
            <Link
              href={`/world/${worldId}/read?p=0`}
              onClick={(e) => {
                e.preventDefault();
                goTo(0);
              }}
              className="inline-link"
              style={{ fontSize: 13, color: "var(--accent-deep)", letterSpacing: "0.04em" }}
            >
              ← return to the beginning
            </Link>
          </div>
        </div>
      )}

      {/* ── Page-turn animation styles ──────────────────────────────── */}
      <style jsx>{`
        .book-page {
          will-change: transform, opacity;
          transform-origin: left center;
        }
        .book-page.is-turning-next {
          animation: turnNext 320ms ease-out;
        }
        .book-page.is-turning-prev {
          animation: turnPrev 320ms ease-out;
        }
        @keyframes turnNext {
          0% {
            opacity: 0;
            transform: translateX(36px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes turnPrev {
          0% {
            opacity: 0;
            transform: translateX(-36px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}

function PageHead({
  entry,
  worldId,
  plots,
}: {
  entry: ChronicleEntry;
  worldId: string;
  plots: Record<string, PlotLite>;
}) {
  const tagPlot = entry.plotIds[0] ? plots[entry.plotIds[0]] : undefined;
  return (
    <div style={{ position: "relative", marginBottom: 18 }}>
      {/* Marginal date — visible on wider screens, slides above the title
          on narrower ones via the inline fallback below. */}
      <div
        className="marginalia"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontFamily: "var(--mono)",
          fontSize: 10.5,
          letterSpacing: "0.04em",
          color: "var(--ink-faint)",
          marginBottom: 10,
        }}
      >
        <span
          className="display-sc"
          style={{ fontSize: 12, letterSpacing: "0.2em", color: "var(--ink-soft)" }}
        >
          {entry.inWorldDate}
        </span>
        <span style={{ fontStyle: "italic" }}>
          {entry.timeOfDay}
          <span style={{ opacity: 0.5, margin: "0 6px" }}>·</span>
          {entry.weather}
        </span>
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
          <Link
            href={`/world/${worldId}/plot/${tagPlot.id}`}
            style={{ color: "var(--accent-deep)", textDecoration: "none" }}
          >
            {tagPlot.title}
          </Link>
        </div>
      )}

      <h2
        className="display"
        style={{
          fontStyle: "italic",
          fontSize: 38,
          lineHeight: 1.05,
          marginBottom: 0,
          color: "var(--ink)",
        }}
      >
        {entry.title}
      </h2>
    </div>
  );
}

function SceneTags({
  entry,
  worldId,
  characters,
  locations,
}: {
  entry: ChronicleEntry;
  worldId: string;
  characters: Record<string, CharLite>;
  locations: Record<string, LocLite>;
}) {
  const tagPlaces = entry.locationIds.map((id) => locations[id]).filter(Boolean) as LocLite[];
  const sceneCast = entry.characterIds.map((id) => characters[id]).filter(Boolean) as CharLite[];
  const isReport = entry.beatType === "world_report";
  if (isReport) return null;
  if (tagPlaces.length === 0 && sceneCast.length === 0) return null;
  return (
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
          <span style={{ color: "var(--ink-faint)", fontSize: 11, marginRight: 2 }}>◇</span>
          {tagPlaces.slice(0, 2).map((p, i) => (
            <span key={p.id}>
              {i > 0 && <span style={{ opacity: 0.4 }}>, </span>}
              <Link
                href={`/world/${worldId}/location/${p.id}`}
                style={{
                  color: "inherit",
                  textDecoration: "none",
                  borderBottom: "0.5px dotted var(--ink-faint)",
                }}
              >
                {p.name}
              </Link>
            </span>
          ))}
        </span>
      )}
      {sceneCast.length > 0 && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontStyle: "italic" }}>
          <span style={{ color: "var(--ink-faint)", fontSize: 11, marginRight: 2 }}>◌</span>
          <span
            style={{
              fontStyle: "normal",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              fontSize: 10.5,
              color: "var(--ink-faint)",
            }}
          >
            with
          </span>
          {sceneCast.slice(0, 5).map((c, i) => (
            <span key={c.id}>
              {i > 0 && <span style={{ opacity: 0.4 }}>, </span>}
              <Link
                href={`/world/${worldId}/character/${c.id}`}
                style={{
                  color: "inherit",
                  textDecoration: "none",
                  borderBottom: "0.5px dotted var(--ink-faint)",
                }}
              >
                {c.name}
              </Link>
            </span>
          ))}
          {sceneCast.length > 5 && (
            <span style={{ opacity: 0.6 }}>+{sceneCast.length - 5}</span>
          )}
        </span>
      )}
    </div>
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
      style={{ margin: "10px 0", fontSize: 17, lineHeight: 1.65 }}
    >
      {p.text}
    </p>
  );
}

function PageControls({
  page,
  total,
  isFirst,
  isLast,
  onPrev,
  onNext,
  onJump,
}: {
  page: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  onPrev: () => void;
  onNext: () => void;
  onJump: (n: number) => void;
}) {
  return (
    <div
      style={{
        marginTop: 64,
        paddingTop: 24,
        borderTop: "0.5px solid var(--rule)",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: 24,
      }}
    >
      <button
        type="button"
        onClick={onPrev}
        disabled={isFirst}
        className="page-turn"
        style={{ justifySelf: "start" }}
      >
        <span aria-hidden style={{ marginRight: 10 }}>←</span>
        Earlier writ
      </button>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <input
          type="range"
          min={0}
          max={total - 1}
          value={page}
          onChange={(e) => onJump(parseInt(e.target.value, 10))}
          aria-label="Skip through the chronicle"
          style={{ width: 220 }}
        />
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
          }}
        >
          ← / → to turn the page
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={isLast}
        className="page-turn"
        style={{ justifySelf: "end" }}
      >
        Later writ
        <span aria-hidden style={{ marginLeft: 10 }}>→</span>
      </button>

      <style jsx>{`
        .page-turn {
          font-family: var(--display);
          font-style: italic;
          font-size: 18px;
          background: transparent;
          border: 0.5px solid var(--rule);
          padding: 10px 18px;
          color: var(--ink);
          cursor: pointer;
          letter-spacing: 0.02em;
          transition: background 120ms ease, color 120ms ease;
        }
        .page-turn:hover:not(:disabled) {
          background: var(--paper-deep);
          color: var(--accent-deep);
        }
        .page-turn:disabled {
          opacity: 0.3;
          cursor: default;
        }
      `}</style>
    </div>
  );
}
