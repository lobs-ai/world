import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Fleuron } from "@/components/Primitives";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

// One row in the codex. The codex is a flat A-Z index of every named thing
// in the world — characters, places, factions, plots, prophecies, and the
// deep-history items. Each row is a single line: kind / title / one-line.
type CodexKind =
  | "character"
  | "location"
  | "faction"
  | "plot"
  | "prophecy"
  | "ancient"
  | "oath"
  | "order"
  | "lost place";

interface CodexEntry {
  key: string;       // alphabetical sort key (lowercased title without articles)
  kind: CodexKind;
  title: string;
  subtitle?: string; // epithet, banner phrase, era — short
  body: string;      // one-line summary; wraps to two lines max in UI
  href?: string;     // detail page if any; deep-history items have none
  tone?: "principal" | "secondary" | "atmospheric" | "spine" | "subplot" | "ambient";
}

const KIND_LABEL: Record<CodexKind, string> = {
  character: "person",
  location: "place",
  faction: "banner",
  plot: "thread",
  prophecy: "foretelling",
  ancient: "the deep past",
  oath: "broken oath",
  order: "fallen order",
  "lost place": "lost place",
};

// "the bell of pellan" → "bell of pellan" — index articles out so an
// alphabetical sort lands on the operative noun, the way real glossaries do.
function sortKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/^(the|a|an|of|and|in)\s+/g, "")
    .trim();
}

interface SearchProps { params: { id: string }; searchParams?: { kind?: string } }

export default function CodexPage({ params, searchParams }: SearchProps) {
  const world = db().getWorld(params.id);
  if (!world) notFound();
  const filterKind = (searchParams?.kind ?? "all") as CodexKind | "all";

  const characters = db().listCharacters(world.id);
  const locations = db().listLocations(world.id);
  const factions = db().listFactions(world.id);
  const plots = db().listPlots(world.id);
  const prophecies = db().listProphecies(world.id);

  // Build the master entry list. Deep-history items don't have detail
  // pages — they live as inline cards with no `href`. Every other
  // category links to its existing detail page so the codex acts as a
  // single index for the rest of the site.
  const entries: CodexEntry[] = [];

  for (const c of characters) {
    entries.push({
      key: sortKey(c.name),
      kind: "character",
      title: c.name,
      subtitle: c.epithet,
      body: c.summary,
      href: `/world/${world.id}/character/${c.id}`,
      tone: c.weight,
    });
  }
  for (const l of locations) {
    entries.push({
      key: sortKey(l.name),
      kind: "location",
      title: l.name,
      subtitle: `a ${l.type}${l.region ? ` — ${l.region}` : ""}`,
      body: l.description,
      href: `/world/${world.id}/location/${l.id}`,
    });
  }
  for (const f of factions) {
    entries.push({
      key: sortKey(f.name),
      kind: "faction",
      title: f.name,
      subtitle: f.banner,
      body: f.summary,
      href: `/world/${world.id}/faction/${f.id}`,
    });
  }
  for (const p of plots) {
    entries.push({
      key: sortKey(p.title),
      kind: "plot",
      title: p.title,
      subtitle: `${p.tier} thread, presently ${p.state}`,
      body: p.arc,
      href: `/world/${world.id}/plot/${p.id}`,
      tone: p.tier,
    });
  }
  for (const p of prophecies) {
    entries.push({
      key: sortKey(p.text),
      kind: "prophecy",
      title: `“${p.text}”`,
      subtitle: `— ${p.source}`,
      body: prophecyStatusLine(p.status),
      href: `/world/${world.id}/prophecy/${p.id}`,
    });
  }
  // Deep-history items — no detail pages, but first-class codex entries.
  const dh = world.deepHistory;
  for (const a of dh.ancients ?? []) {
    entries.push({
      key: sortKey(a.name),
      kind: "ancient",
      title: a.name,
      subtitle: `${a.era}${a.epithet ? ` — ${a.epithet}` : ""}`,
      body: a.one_line,
    });
  }
  for (const o of dh.brokenOaths ?? []) {
    entries.push({
      key: sortKey(o.title),
      kind: "oath",
      title: o.title,
      subtitle: o.era,
      body: o.one_line,
    });
  }
  for (const o of dh.fallenOrders ?? []) {
    entries.push({
      key: sortKey(o.title),
      kind: "order",
      title: o.title,
      subtitle: o.era,
      body: o.one_line,
    });
  }
  for (const lp of dh.lostPlaces ?? []) {
    entries.push({
      key: sortKey(lp.title),
      kind: "lost place",
      title: lp.title,
      subtitle: lp.era,
      body: lp.one_line,
    });
  }

  // Counts before filtering, so the pills always show the same totals.
  const counts: Record<string, number> = { all: entries.length };
  for (const e of entries) counts[e.kind] = (counts[e.kind] ?? 0) + 1;

  const filtered =
    filterKind === "all"
      ? entries
      : entries.filter((e) => e.kind === filterKind);
  filtered.sort((a, b) => a.key.localeCompare(b.key));

  // Bucket A-Z so the page reads like a glossary, with letter rules.
  const buckets = new Map<string, CodexEntry[]>();
  for (const e of filtered) {
    const letter = (e.key[0] ?? "•").toUpperCase();
    const norm = /[A-Z]/.test(letter) ? letter : "•";
    if (!buckets.has(norm)) buckets.set(norm, []);
    buckets.get(norm)!.push(e);
  }
  const orderedLetters = Array.from(buckets.keys()).sort((a, b) =>
    a.localeCompare(b),
  );

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav worldId={world.id} worldName={world.name} active="codex" />

      <div className="page" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.32em", marginBottom: 14 }}>
            ❧&nbsp;&nbsp;the codex of {world.name}&nbsp;&nbsp;❧
          </div>
          <h1 className="display" style={{ fontSize: 72, fontStyle: "italic", lineHeight: 1, marginBottom: 14 }}>
            An index of named things
          </h1>
          <p style={{ fontStyle: "italic", color: "var(--ink-soft)", maxWidth: "62ch", marginInline: "auto" }}>
            Every person and place set down in the chronicle, every banner
            in the field, and the foretellings, broken oaths, fallen orders,
            and lost cities behind them.
          </p>
        </div>

        {/* Filter pills. Server-rendered links so the codex still works
            without JS. The "all" pill resets the filter. */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
            marginBottom: 32,
          }}
        >
          <KindPill
            href={`/world/${world.id}/codex`}
            active={filterKind === "all"}
          >
            all <span style={{ opacity: 0.5, marginLeft: 4 }}>{counts.all ?? 0}</span>
          </KindPill>
          {(Object.keys(KIND_LABEL) as CodexKind[]).map((k) => (
            <KindPill
              key={k}
              href={`/world/${world.id}/codex?kind=${encodeURIComponent(k)}`}
              active={filterKind === k}
            >
              {KIND_LABEL[k]}
              <span style={{ opacity: 0.5, marginLeft: 6 }}>{counts[k] ?? 0}</span>
            </KindPill>
          ))}
        </div>

        {/* Letter jump-bar — keeps a long codex navigable. */}
        {orderedLetters.length > 4 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 6,
              marginBottom: 32,
              fontFamily: "var(--display-sc)",
              fontSize: 12,
              letterSpacing: "0.22em",
            }}
          >
            {orderedLetters.map((l) => (
              <a
                key={l}
                href={`#letter-${l}`}
                style={{
                  padding: "4px 8px",
                  border: "0.5px solid var(--rule)",
                  color: "var(--ink-soft)",
                  textDecoration: "none",
                  textTransform: "uppercase",
                  background: "var(--paper)",
                }}
              >
                {l}
              </a>
            ))}
          </div>
        )}

        <Fleuron glyph="✦   ❦   ✦" />

        {filtered.length === 0 && (
          <p style={{ textAlign: "center", fontStyle: "italic", color: "var(--ink-faint)", padding: "60px 0" }}>
            Nothing of that kind has been set down yet.
          </p>
        )}

        {orderedLetters.map((letter) => {
          const items = buckets.get(letter)!;
          return (
            <section key={letter} id={`letter-${letter}`} style={{ marginTop: 28 }}>
              <div
                className="display"
                style={{
                  fontSize: 64,
                  fontStyle: "italic",
                  color: "var(--ink-ghost)",
                  lineHeight: 1,
                  marginBottom: 8,
                  borderBottom: "0.5px solid var(--rule)",
                  paddingBottom: 6,
                }}
              >
                {letter}
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {items.map((e, i) => (
                  <CodexRow key={i} entry={e} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function CodexRow({ entry }: { entry: CodexEntry }) {
  const inner = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: 24,
        padding: "16px 0",
        borderTop: "0.5px dotted var(--rule)",
      }}
    >
      <div>
        <div className="display-sc" style={{ fontSize: 11, letterSpacing: "0.22em", color: kindColor(entry.kind), textTransform: "lowercase" }}>
          {KIND_LABEL[entry.kind]}
        </div>
        {entry.tone && (
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-faint)", marginTop: 4 }}>
            {entry.tone}
          </div>
        )}
      </div>
      <div>
        <div className="display" style={{ fontSize: 20, fontStyle: "italic", lineHeight: 1.2, color: "var(--ink)" }}>
          {entry.title}
        </div>
        {entry.subtitle && (
          <div style={{ fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic", marginTop: 2 }}>
            {entry.subtitle}
          </div>
        )}
        <p style={{ margin: "8px 0 0 0", fontSize: 15, color: "var(--ink-soft)" }}>
          {entry.body.length > 320 ? entry.body.slice(0, 320).replace(/\s+\S*$/, "") + "…" : entry.body}
        </p>
      </div>
    </div>
  );
  return (
    <li>
      {entry.href ? (
        <Link
          href={entry.href}
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

function KindPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 14px",
        fontFamily: "var(--display-sc)",
        fontSize: 12,
        letterSpacing: "0.18em",
        textTransform: "lowercase",
        color: active ? "var(--paper)" : "var(--ink-soft)",
        background: active ? "var(--ink)" : "var(--paper-deep)",
        border: `0.5px solid ${active ? "var(--ink)" : "var(--rule)"}`,
        textDecoration: "none",
        cursor: "pointer",
      }}
    >
      {children}
    </Link>
  );
}

function kindColor(kind: CodexKind): string {
  switch (kind) {
    case "character":
      return "var(--accent-deep)";
    case "prophecy":
      return "var(--accent-deep)";
    case "plot":
      return "var(--accent)";
    case "ancient":
    case "oath":
    case "order":
    case "lost place":
      return "var(--ink-soft)";
    default:
      return "var(--ink-faint)";
  }
}

function prophecyStatusLine(s: string): string {
  switch (s) {
    case "echoing":
      return "Echoes have been heard.";
    case "half_fulfilled":
      return "Half-true so far.";
    case "fulfilled":
      return "Paid in full.";
    case "broken":
      return "Broken — the words did not land.";
    default:
      return "Not yet paid, not yet broken.";
  }
}
