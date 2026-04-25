// primitives.jsx — manuscript building blocks shared across screens

const { useState, useEffect, useRef, useMemo, Fragment } = React;

// Inline link parser: replaces {char:id|label}, {place:id|label}, {thread:id|label}
// with InlineLink components that route via window.__nav.
function parseInline(text, nav) {
  if (!text) return null;
  const out = [];
  const re = /\{(char|place|thread):([a-z0-9]+)\|([^}]+)\}/g;
  let last = 0, m, key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const [, kind, id, label] = m;
    out.push(
      <a key={key++}
         className={`inline-link ${kind === 'char' ? 'character' : kind === 'place' ? 'place' : 'thread'}`}
         onClick={(e) => { e.preventDefault(); if (nav) nav(kind === 'char' ? 'character' : kind === 'place' ? 'location' : 'plot', id); }}>
        {label}
      </a>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Fleuron({ glyph = "❦" }) {
  return <div className="fleuron" aria-hidden="true">{glyph}</div>;
}

function Rule({ kind = "single" }) {
  return <hr className={kind === "double" ? "rule-double" : "rule"} />;
}

// Manuscript-style portrait placeholder — a framed, woodcut-feel box
function Portrait({ label, w = 120, h = 150 }) {
  return (
    <div style={{
      width: w, height: h, position: "relative",
      border: "0.5px solid var(--ink-soft)",
      padding: 4, background: "var(--paper-deep)"
    }}>
      <div style={{
        width: "100%", height: "100%",
        border: "0.5px solid var(--ink-faint)",
        background: `
          repeating-linear-gradient(45deg, transparent 0 6px, rgba(0,0,0,0.06) 6px 7px),
          radial-gradient(ellipse at 50% 35%, rgba(0,0,0,0.08), transparent 60%)
        `,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: 6, color: "var(--ink-faint)",
        fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.16em",
        textTransform: "uppercase", textAlign: "center"
      }}>{label}</div>
    </div>
  );
}

// Section header with small caps + double rule above
function SectionHead({ children, kicker }) {
  return (
    <div style={{ marginTop: 36, marginBottom: 18 }}>
      <hr className="rule-double" style={{ marginBottom: 12 }} />
      {kicker && (
        <div style={{
          fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.2em",
          textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 6
        }}>{kicker}</div>
      )}
      <div className="display-sc" style={{ fontSize: 22, color: "var(--ink)" }}>
        {children}
      </div>
    </div>
  );
}

// Marginalia — small note in the margin (left or right)
function Marginalia({ children, side = "right" }) {
  return (
    <aside style={{
      [side]: -200, position: "absolute", top: 0, width: 180,
      fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.5,
      color: "var(--ink-faint)", letterSpacing: "0.02em",
      textAlign: side === "left" ? "right" : "left"
    }}>
      {children}
    </aside>
  );
}

// A nav header used on most pages
function Nav({ route, nav }) {
  const items = [
    ["chronicle", "The Chronicle"],
    ["map", "Map"],
    ["chapter", "Chapter"],
    ["admin", "Scriptorium"],
  ];
  return (
    <header className="nav">
      <div className="nav-left">
        <span className="nav-link" onClick={() => nav("landing")}>← All Worlds</span>
      </div>
      <div className="nav-title">
        Aelmere
        <span className="small">In the year of the owl</span>
      </div>
      <div className="nav-right">
        {items.map(([id, label]) => (
          <span key={id}
                className={`nav-link ${route.screen === id ? "is-active" : ""}`}
                onClick={() => nav(id)}>
            {label}
          </span>
        ))}
      </div>
    </header>
  );
}

// Render a chronicle paragraph
function ChroniclePara({ p, nav, isFirst, dropcapStyle }) {
  if (p.kind === "dialogue") {
    const speaker = CHARACTERS[p.who];
    return (
      <p style={{ paddingLeft: 28, position: "relative", color: "var(--ink)" }}>
        {parseInline(p.text, nav)}
        <span style={{
          display: "block", fontFamily: "var(--mono)", fontSize: 10,
          letterSpacing: "0.18em", textTransform: "uppercase",
          color: "var(--ink-faint)", marginTop: 4
        }}>— {speaker?.name || p.who}</span>
      </p>
    );
  }
  const cls = isFirst ? `dropcap${dropcapStyle === "illum" ? " dropcap-illum" : ""}${dropcapStyle === "off" ? " no-dropcap" : ""}` : "";
  return <p className={cls}>{parseInline(p.text, nav)}</p>;
}

window.parseInline = parseInline;
window.Fleuron = Fleuron;
window.Rule = Rule;
window.Portrait = Portrait;
window.SectionHead = SectionHead;
window.Marginalia = Marginalia;
window.Nav = Nav;
window.ChroniclePara = ChroniclePara;
