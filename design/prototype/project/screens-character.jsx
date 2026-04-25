// screens-character.jsx — character page: ledger of the heart, asymmetric relations

function ScreenCharacter({ nav, route, id }) {
  const c = CHARACTERS[id] || CHARACTERS.caelin;
  const place = LOCATIONS[c.where];

  // Asymmetric pairs (handcrafted for richness)
  const relations = {
    caelin: [
      { other: "margreth", typeFromMe: "mother", affection: -0.2, trust: 0.4, note: "He has not been called my heart in nineteen years." },
      { other: "oren", typeFromMe: "father", affection: 0.5, trust: 0.0, note: "Has not seen the orchard he was named for." },
      { other: "vael", typeFromMe: "rival", affection: -0.6, trust: -0.4, note: "Believes Vael is reasonable. Has not yet learned otherwise." },
    ],
    margreth: [
      { other: "oren", typeFromMe: "husband", affection: 0.7, trust: 1.0, note: "She has signed in his place since the third year." },
      { other: "caelin", typeFromMe: "son", affection: 0.85, trust: 0.5, note: "Calls him my heart in private; never in council." },
      { other: "hesper", typeFromMe: "complicit", affection: 0.4, trust: 0.95, note: "The only person in the realm who knows the truth she knows." },
    ],
    hesper: [
      { other: "fenwick", typeFromMe: "apprentice", affection: 0.7, trust: 0.4, note: "Has begun to fear the boy will ask the question she cannot answer." },
      { other: "margreth", typeFromMe: "complicit", affection: 0.4, trust: 0.95, note: "" },
      { other: "oren", typeFromMe: "patient", affection: 0.6, trust: 0.0, note: "Has not let him die. Will not say why, even to herself." },
    ],
  };
  const rels = relations[c.id] || relations.caelin;

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav route={route} nav={nav} />

      <div className="page" style={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 40, alignItems: "start" }}>
          <Portrait label={c.portrait} w={180} h={220} />
          <div>
            <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.32em", marginBottom: 10 }}>
              of the {place?.name || "realm"}
            </div>
            <h1 className="display" style={{ fontSize: 64, fontStyle: "italic", lineHeight: 1, marginBottom: 6 }}>
              {c.name}
            </h1>
            <div className="display" style={{ fontSize: 22, fontStyle: "italic", color: "var(--ink-soft)", marginBottom: 18 }}>
              {c.epithet}
            </div>
            <p style={{ fontSize: 18, color: "var(--ink-soft)", maxWidth: "56ch" }}>{c.summary}</p>
            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              <span className="tag">{c.age} years</span>
              <span className="tag clickable" onClick={() => nav("location", c.where)}>at {place?.name}</span>
              {c.alive === false ? <span className="tag accent">deceased</span> : null}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 64, marginTop: 64 }}>
          {/* Left: Ledger of the Heart */}
          <div>
            <SectionHead kicker="ledger of the heart">What moves them</SectionHead>

            <div style={{ marginBottom: 28 }}>
              <div className="display-sc" style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 8 }}>presently</div>
              <p style={{ fontSize: 22, fontStyle: "italic", color: "var(--ink)" }}>
                {c.mood?.dominant ? c.mood.dominant : "—"}
              </p>
            </div>

            <div>
              <div className="display-sc" style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 12 }}>longings</div>
              <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {c.desires.map((d, i) => (
                  <li key={i} style={{ display: "flex", gap: 18, alignItems: "baseline", padding: "10px 0", borderTop: "0.5px dotted var(--rule)" }}>
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", width: 32, textAlign: "right" }}>{romanize(i+1)}.</span>
                    <span style={{ flex: 1, fontSize: 17, fontStyle: d.goal.startsWith("(") ? "italic" : "normal", color: d.goal.startsWith("(") ? "var(--ink-faint)" : "var(--ink)" }}>
                      {d.goal}
                    </span>
                    <IntensityBar v={d.intensity} />
                  </li>
                ))}
              </ol>
            </div>

            {/* Relationships */}
            <SectionHead kicker="bonds, in their own measure">Of others, and how they hold them</SectionHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {rels.map((r, i) => {
                const other = CHARACTERS[r.other];
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 18, padding: "16px 0", borderTop: "0.5px solid var(--rule)" }}>
                    <div>
                      <div className="display" style={{ fontSize: 22, fontStyle: "italic" }}>
                        <span style={{ color: "var(--ink-faint)" }}>holds</span>{" "}
                        <a className="inline-link character" onClick={() => nav("character", r.other)}>{other?.name}</a>{" "}
                        <span style={{ color: "var(--ink-faint)" }}>as</span>{" "}
                        {r.typeFromMe}.
                      </div>
                      {r.note && <p style={{ fontSize: 15, fontStyle: "italic", color: "var(--ink-soft)", marginTop: 4, maxWidth: "44ch" }}>{r.note}</p>}
                    </div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.8 }}>
                      <Bipole label="affection" v={r.affection} />
                      <Bipole label="trust" v={r.trust} />
                    </div>
                  </div>
                );
              })}
              <p style={{ fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic", marginTop: 4 }}>
                These are how <em>{c.name.split(" ")[0]}</em> holds the others. The others may hold them differently.
              </p>
            </div>
          </div>

          {/* Right: appearances + memories */}
          <div>
            <SectionHead kicker="entries in which they appear">Lately written</SectionHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {CHRONICLE.filter(e => e.characterIds.includes(c.id)).slice(0, 4).map(e => (
                <div key={e.id} className="row-link" style={{ paddingBottom: 14, borderBottom: "0.5px dotted var(--rule)" }}
                     onClick={() => nav("chronicle")}>
                  <div className="display" style={{ fontSize: 18, fontStyle: "italic", marginBottom: 2 }}>{e.title}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                    {e.inWorldDate}
                  </div>
                </div>
              ))}
            </div>

            <SectionHead kicker="memories, weighted">What stays with them</SectionHead>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { weight: 0.9, text: "Was four. The bells were rung in the morning and not at night, and his mother did not eat at the table." },
                { weight: 0.7, text: "Aged twelve. Read the law of regency by candlelight; understood what it said; understood for the first time that he might die before being king." },
                { weight: 0.4, text: "Aged thirty. The orchard was offered, and refused." },
                { weight: 0.2, text: "Last winter. The court tailor measured him and said, gentleman, you are the same as your father was." },
              ].map((m, i) => (
                <li key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span style={{
                    width: 4, alignSelf: "stretch",
                    background: `var(--accent)`,
                    opacity: m.weight
                  }} />
                  <p style={{ margin: 0, fontSize: 15, fontStyle: "italic", color: m.weight > 0.5 ? "var(--ink)" : "var(--ink-soft)" }}>
                    {m.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function IntensityBar({ v }) {
  return (
    <div style={{ width: 80, display: "flex", gap: 2, alignItems: "center" }}>
      {[1,2,3,4,5,6,7,8].map(i => (
        <span key={i} style={{
          height: 10, flex: 1,
          background: (i/8) <= v ? "var(--accent-deep)" : "var(--ink-ghost)",
          opacity: (i/8) <= v ? 1 : 0.3
        }} />
      ))}
    </div>
  );
}

function Bipole({ label, v }) {
  // -1..1
  const pct = (v + 1) / 2 * 100;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 3 }}>
        {label} · {v >= 0 ? "+" : ""}{v.toFixed(2)}
      </div>
      <div style={{ position: "relative", height: 4, background: "var(--ink-ghost)", opacity: 0.4 }}>
        <div style={{ position: "absolute", left: "50%", top: -2, width: 1, height: 8, background: "var(--ink-faint)" }} />
        <div style={{
          position: "absolute", height: "100%",
          left: v >= 0 ? "50%" : `${pct}%`,
          width: v >= 0 ? `${pct - 50}%` : `${50 - pct}%`,
          background: v >= 0 ? "var(--accent-deep)" : "var(--ink-soft)"
        }} />
      </div>
    </div>
  );
}

function romanize(n) {
  return ["i","ii","iii","iv","v","vi","vii"][n-1] || String(n);
}

window.ScreenCharacter = ScreenCharacter;
