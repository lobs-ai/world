import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Fleuron, SectionHead } from "@/components/Primitives";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

// The Timeline weaves together three layers of narrative time:
//
//   1. Long ago — the deep history. No fixed dates; eras like "five
//      hundred winters past" or "before the river ran backwards." The
//      reader sees these as headings on a vertical column far back.
//
//   2. The chronicle so far — the actual writs the world has produced.
//      Tick-ordered, dated by `inWorldDate`, linked to the entry on the
//      home page. This is where the reader is.
//
//   3. Yet to be paid — the prophecies whose payoff windows are still
//      ahead. The reader sees the windows visually so they know which
//      promises the chronicle still owes.
//
// The visual is a single vertical rule with dotted markers for items.
// Items in the past are inked; items still ahead are faint.

type DeepKind = "ancient" | "oath" | "order" | "lost";

interface DeepItem {
  kind: DeepKind;
  era: string;
  title: string;
  body: string;
}

const DEEP_LABEL: Record<DeepKind, string> = {
  ancient: "an ancient",
  oath: "a broken oath",
  order: "a fallen order",
  lost: "a lost place",
};

export default function TimelinePage({ params }: { params: { id: string } }) {
  const world = db().getWorld(params.id);
  if (!world) notFound();

  const dh = world.deepHistory;
  const deep: DeepItem[] = [];
  for (const a of dh.ancients ?? []) {
    deep.push({
      kind: "ancient",
      era: a.era,
      title: a.epithet ? `${a.name} — ${a.epithet}` : a.name,
      body: a.one_line,
    });
  }
  for (const o of dh.brokenOaths ?? []) {
    deep.push({ kind: "oath", era: o.era, title: o.title, body: o.one_line });
  }
  for (const o of dh.fallenOrders ?? []) {
    deep.push({ kind: "order", era: o.era, title: o.title, body: o.one_line });
  }
  for (const lp of dh.lostPlaces ?? []) {
    deep.push({ kind: "lost", era: lp.era, title: lp.title, body: lp.one_line });
  }
  // Heuristic ordering for deep history: the model writes era phrases
  // ("five hundred winters past", "no living soul remembers") with no
  // numeric time, but the words usually convey age. We push items
  // mentioning "no living soul"/"no record" to the very top, then the
  // explicitly ancient phrases, then the rest. Stable within each bucket.
  deep.sort((a, b) => weighEra(b.era) - weighEra(a.era));

  // Chronicle: list ascending so the timeline reads top→bottom as past→present.
  const entries = db().listEntries(world.id, 200).slice().reverse();
  const characters = db().listCharacters(world.id);
  const charById = new Map(characters.map((c) => [c.id, c]));

  // Prophecies: keep only those not yet paid; sort by earliest payoff
  // window so "the one nearest" rises to the top.
  const prophecies = db()
    .listProphecies(world.id)
    .filter((p) => p.status !== "fulfilled" && p.status !== "broken")
    .sort((a, b) => a.targetPayoffMin - b.targetPayoffMin);

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav worldId={world.id} worldName={world.name} active="timeline" />

      <div className="page" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.32em", marginBottom: 14 }}>
            ❧&nbsp;&nbsp;the long thread of {world.name}&nbsp;&nbsp;❧
          </div>
          <h1 className="display" style={{ fontSize: 72, fontStyle: "italic", lineHeight: 1, marginBottom: 14 }}>
            From the deep past to the next promise
          </h1>
          <p style={{ fontStyle: "italic", color: "var(--ink-soft)", maxWidth: "62ch", marginInline: "auto" }}>
            Eras the chronicle remembers, the writs already set down, and
            the oracles whose windows have not yet closed.
          </p>
        </div>

        <Fleuron glyph="✦   ❦   ✦" />

        <div style={{ maxWidth: 880, marginInline: "auto", position: "relative", paddingLeft: 28 }}>
          {/* The single vertical rule — runs the full height of the
              timeline. Every item dots into it. */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 11,
              top: 6,
              bottom: 6,
              width: 1,
              background: "var(--rule)",
              opacity: 0.55,
            }}
          />

          {/* ── Section: Long ago ─────────────────────────────────────── */}
          <SectionHead kicker="before any of these were written">Long ago</SectionHead>
          {deep.length === 0 && (
            <p style={{ color: "var(--ink-faint)", fontStyle: "italic", marginLeft: 28 }}>
              The deep past is silent.
            </p>
          )}
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {deep.map((d, i) => (
              <TimelineRow
                key={`d${i}`}
                kicker={d.era}
                tone="past"
                title={d.title}
                rightLabel={DEEP_LABEL[d.kind]}
              >
                <p style={{ margin: 0, fontStyle: "italic", color: "var(--ink-soft)" }}>
                  {d.body}
                </p>
              </TimelineRow>
            ))}
          </ol>

          {/* ── Section: The chronicle so far ─────────────────────────── */}
          <SectionHead kicker="the writs already set down">The chronicle so far</SectionHead>
          {entries.length === 0 && (
            <p style={{ color: "var(--ink-faint)", fontStyle: "italic", marginLeft: 28 }}>
              The first writ is being inked. Return in a moment.
            </p>
          )}
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {entries.map((e, i) => {
              const focal = e.characterIds
                .slice(0, 3)
                .map((cid) => charById.get(cid)?.name)
                .filter(Boolean);
              return (
                <TimelineRow
                  key={e.id}
                  kicker={e.inWorldDate}
                  tone={i === entries.length - 1 ? "present" : "writ"}
                  title={e.title}
                  href={`/world/${world.id}#${e.id}`}
                  rightLabel={beatLabel(e.beatType)}
                >
                  {focal.length > 0 && (
                    <p style={{ margin: 0, fontSize: 14, color: "var(--ink-faint)", fontStyle: "italic" }}>
                      with {focal.join(", ")}
                    </p>
                  )}
                </TimelineRow>
              );
            })}
          </ol>

          {/* ── Section: Yet to be paid ───────────────────────────────── */}
          <SectionHead kicker="oracles whose windows have not closed">Yet to come</SectionHead>
          {prophecies.length === 0 && (
            <p style={{ color: "var(--ink-faint)", fontStyle: "italic", marginLeft: 28 }}>
              No promise lingers; the chronicle has paid every word.
            </p>
          )}
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {prophecies.map((p) => {
              const open = world.tick >= p.targetPayoffMin && world.tick <= p.targetPayoffMax;
              const overdue = world.tick > p.targetPayoffMax;
              const tone = overdue ? "overdue" : open ? "open" : "future";
              const minLeft = Math.max(0, p.targetPayoffMin - world.tick);
              const maxLeft = Math.max(0, p.targetPayoffMax - world.tick);
              const windowLine = overdue
                ? `the window has closed ${world.tick - p.targetPayoffMax} writs past`
                : open
                  ? `the window is open — closes in ${maxLeft} writs`
                  : `opens in ${minLeft} writs, closes in ${maxLeft}`;
              return (
                <TimelineRow
                  key={p.id}
                  kicker={p.source}
                  tone={tone}
                  title={`“${p.text}”`}
                  href={`/world/${world.id}/prophecy/${p.id}`}
                  rightLabel={prophecyStatusLabel(p.status)}
                >
                  <p style={{ margin: 0, fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic" }}>
                    {windowLine}
                  </p>
                  <ProphecyWindowBar
                    plantedTick={p.plantedTick}
                    minTick={p.targetPayoffMin}
                    maxTick={p.targetPayoffMax}
                    nowTick={world.tick}
                  />
                </TimelineRow>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

type Tone = "past" | "writ" | "present" | "future" | "open" | "overdue";

function TimelineRow({
  kicker,
  title,
  href,
  rightLabel,
  tone,
  children,
}: {
  kicker: string;
  title: string;
  href?: string;
  rightLabel?: string;
  tone: Tone;
  children?: React.ReactNode;
}) {
  const dot = dotColorFor(tone);
  const titleColor =
    tone === "past"
      ? "var(--ink-soft)"
      : tone === "future"
        ? "var(--ink-soft)"
        : "var(--ink)";
  const inner = (
    <div
      style={{
        position: "relative",
        marginLeft: -28 + 28, // align: list padding-left absorbs the rule offset
        paddingLeft: 28,
        paddingTop: 14,
        paddingBottom: 22,
        borderBottom: "0.5px dotted var(--rule)",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 7,
          top: 22,
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: dot.fill,
          border: `1px solid ${dot.ring}`,
          boxShadow: tone === "present" ? `0 0 0 4px rgba(120,40,30,0.16)` : "none",
        }}
      />
      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
          {kicker}
        </div>
        {rightLabel && (
          <div className="display-sc" style={{ fontSize: 11, color: dot.ring, letterSpacing: "0.22em" }}>
            {rightLabel}
          </div>
        )}
      </div>
      <div
        className="display"
        style={{
          marginTop: 4,
          fontSize: 22,
          fontStyle: "italic",
          color: titleColor,
          lineHeight: 1.2,
        }}
      >
        {title}
      </div>
      {children && <div style={{ marginTop: 6 }}>{children}</div>}
    </div>
  );
  return (
    <li>
      {href ? (
        <Link
          href={href}
          className="row-link"
          style={{ textDecoration: "none", color: "inherit", display: "block" }}
        >
          {inner}
        </Link>
      ) : (
        inner
      )}
    </li>
  );
}

// Visual bar for a prophecy's payoff window. Shows where the current
// tick sits relative to the window's start and end. Compressed so the
// reader can compare windows at a glance.
function ProphecyWindowBar({
  plantedTick,
  minTick,
  maxTick,
  nowTick,
}: {
  plantedTick: number;
  minTick: number;
  maxTick: number;
  nowTick: number;
}) {
  // Span the bar from "planted" to a little past the window end so the
  // window itself takes a useful fraction of the bar.
  const span = Math.max(1, maxTick + Math.ceil((maxTick - plantedTick) * 0.05) - plantedTick);
  const pct = (t: number) => Math.max(0, Math.min(100, ((t - plantedTick) / span) * 100));
  const winStart = pct(minTick);
  const winEnd = pct(maxTick);
  const nowPct = pct(nowTick);
  return (
    <div style={{ marginTop: 10, position: "relative", height: 14 }}>
      {/* base track */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: "6px 0 6px 0",
          background: "var(--ink-ghost)",
          opacity: 0.35,
        }}
      />
      {/* the window — when it is open and overdue */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: `${winStart}%`,
          width: `${Math.max(2, winEnd - winStart)}%`,
          top: 4,
          bottom: 4,
          background: "rgba(120,40,30,0.20)",
          border: "0.5px solid var(--accent-soft)",
        }}
      />
      {/* now marker */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: `${nowPct}%`,
          top: 0,
          bottom: 0,
          width: 1,
          background: "var(--ink)",
          transform: "translateX(-0.5px)",
        }}
      />
    </div>
  );
}

function dotColorFor(tone: Tone): { fill: string; ring: string } {
  switch (tone) {
    case "past":
      return { fill: "var(--paper)", ring: "var(--ink-soft)" };
    case "writ":
      return { fill: "var(--ink-soft)", ring: "var(--ink-soft)" };
    case "present":
      return { fill: "var(--accent)", ring: "var(--accent-deep)" };
    case "open":
      return { fill: "var(--accent-soft)", ring: "var(--accent-deep)" };
    case "overdue":
      return { fill: "var(--paper)", ring: "var(--accent)" };
    case "future":
      return { fill: "var(--paper)", ring: "var(--ink-faint)" };
  }
}

function beatLabel(b: string): string {
  switch (b) {
    case "setup": return "Setup";
    case "complication": return "Complication";
    case "rising": return "Rising";
    case "climax": return "Climax";
    case "falling": return "Falling";
    case "resolution": return "Resolution";
    case "world_report": return "From the realm";
    case "private": return "Quiet hour";
    default: return b;
  }
}

function prophecyStatusLabel(s: string): string {
  switch (s) {
    case "echoing": return "Echoes heard";
    case "half_fulfilled": return "Half-true";
    default: return "Not yet paid";
  }
}

// Ranks an "era" phrase by perceived antiquity. We don't try to be
// precise — just push the genuinely ancient ("no living soul remembers")
// to the top, then the explicit-old ("five hundred winters past"), then
// recent-ish ("a generation past", "forty years"). Stable within bucket.
function weighEra(era: string): number {
  const e = era.toLowerCase();
  if (/no (living soul|record|memory)/.test(e)) return 100;
  if (/(thousand|millennia|ancient|aeon|first age)/.test(e)) return 90;
  if (/(century|centuries|five hundred|six hundred|seven hundred)/.test(e)) return 80;
  if (/(generation|hundred winters|two hundred|three hundred)/.test(e)) return 70;
  if (/(seventy|eighty|ninety|seventy years)/.test(e)) return 50;
  if (/(forty|fifty|sixty)\s*(years|winters)/.test(e)) return 40;
  if (/(twenty|thirty|recent)/.test(e)) return 30;
  return 60;
}
