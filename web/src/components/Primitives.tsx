import type { ReactNode } from "react";

export function Fleuron({ glyph = "✦   ❦   ✦" }: { glyph?: string }) {
  return <div className="fleuron">{glyph}</div>;
}

export function SectionHead({
  kicker,
  children,
}: {
  kicker: string;
  children: ReactNode;
}) {
  return (
    <div className="section-head" style={{ marginTop: 36 }}>
      <div className="kicker">{kicker}</div>
      <h2>{children}</h2>
    </div>
  );
}

export function Portrait({
  label,
  w = 60,
  h = 75,
}: {
  label: string;
  w?: number;
  h?: number;
}) {
  return (
    <div
      style={{
        width: w,
        height: h,
        background: "var(--paper-deep)",
        border: "0.5px solid rgba(0,0,0,0.18)",
        backgroundImage:
          "repeating-linear-gradient(45deg, transparent 0 8px, rgba(0,0,0,0.05) 8px 9px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 4,
        fontFamily: "var(--mono)",
        fontSize: 10,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--ink-faint)",
      }}
      title={label}
    >
      {label.split(" ").slice(0, 4).join(" ")}
    </div>
  );
}

export function IntensityBar({ v }: { v: number }) {
  return (
    <div style={{ width: 80, display: "flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <span
          key={i}
          style={{
            height: 10,
            flex: 1,
            background:
              i / 8 <= v ? "var(--accent-deep)" : "var(--ink-ghost)",
            opacity: i / 8 <= v ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}

export function Bipole({ label, v }: { label: string; v: number }) {
  const pct = ((v + 1) / 2) * 100;
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
          marginBottom: 3,
        }}
      >
        {label} · {v >= 0 ? "+" : ""}{v.toFixed(2)}
      </div>
      <div
        style={{
          position: "relative",
          height: 4,
          background: "var(--ink-ghost)",
          opacity: 0.4,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: -2,
            width: 1,
            height: 8,
            background: "var(--ink-faint)",
          }}
        />
        <div
          style={{
            position: "absolute",
            height: "100%",
            left: v >= 0 ? "50%" : `${pct}%`,
            width: v >= 0 ? `${pct - 50}%` : `${50 - pct}%`,
            background: v >= 0 ? "var(--accent-deep)" : "var(--ink-soft)",
          }}
        />
      </div>
    </div>
  );
}

export function romanize(n: number): string {
  return ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii"][n - 1] ?? String(n);
}
