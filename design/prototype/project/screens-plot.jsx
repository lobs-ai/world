// screens-plot.jsx — plot page: arc ribbon

function ScreenPlot({ nav, route, id }) {
  const p = PLOTS[id] || PLOTS.succession;
  const states = ["seeded","setup","rising","climax","falling","resolved"];
  const stateIdx = states.indexOf(p.state);

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav route={route} nav={nav} />

      <div className="page" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.32em", marginBottom: 12 }}>
            a thread now running
          </div>
          <h1 className="display" style={{ fontSize: 72, fontStyle: "italic", lineHeight: 1, marginBottom: 16 }}>
            {p.title}
          </h1>
          <p style={{ fontSize: 19, color: "var(--ink-soft)", maxWidth: "60ch", marginInline: "auto", fontStyle: "italic" }}>
            {p.themes.map(t => `“${t}”`).join(" · ")}
          </p>
        </div>

        {/* Arc ribbon */}
        <div style={{ marginTop: 60, marginBottom: 60, position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${states.length}, 1fr)`, gap: 0 }}>
            {states.map((s, i) => {
              const passed = i < stateIdx;
              const current = i === stateIdx;
              return (
                <div key={s} style={{ position: "relative", textAlign: "center", padding: "0 8px" }}>
                  <div style={{
                    height: 1, background: passed || current ? "var(--accent-deep)" : "var(--ink-ghost)",
                    opacity: passed || current ? 0.8 : 0.4,
                    position: "absolute", top: 14, left: 0, right: 0
                  }} />
                  <div style={{
                    width: current ? 18 : 10, height: current ? 18 : 10,
                    borderRadius: "50%", marginInline: "auto",
                    background: passed || current ? "var(--accent-deep)" : "var(--paper)",
                    border: `1px solid ${passed || current ? "var(--accent-deep)" : "var(--ink-faint)"}`,
                    position: "relative", zIndex: 1,
                    marginTop: current ? 5 : 9
                  }} />
                  <div className="display-sc" style={{
                    fontSize: 13, marginTop: 14,
                    color: current ? "var(--accent-deep)" : passed ? "var(--ink)" : "var(--ink-faint)",
                    letterSpacing: "0.18em",
                    fontWeight: current ? 600 : 400
                  }}>{s}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 64 }}>
          {/* Beats */}
          <div>
            <SectionHead kicker="how it has played, beat by beat">The thread, so far</SectionHead>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, position: "relative" }}>
              <span style={{ position: "absolute", left: 6, top: 8, bottom: 8, width: 1, background: "var(--rule)", opacity: 0.5 }} />
              {p.beats.map((b, i) => (
                <li key={i} style={{ position: "relative", paddingLeft: 36, paddingBottom: 28 }}>
                  <span style={{
                    position: "absolute", left: 0, top: 10, width: 13, height: 13,
                    border: `1px solid ${b.current ? "var(--accent-deep)" : "var(--ink-soft)"}`,
                    background: b.current ? "var(--accent)" : "var(--paper)",
                    borderRadius: "50%"
                  }} />
                  <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 4 }}>
                    {b.when} &nbsp;·&nbsp; {b.type}
                  </div>
                  <div className="display" style={{ fontSize: 22, fontStyle: "italic", marginBottom: 6 }}>{b.title}</div>
                  <p style={{ fontSize: 16, color: "var(--ink-soft)", margin: 0, fontStyle: "italic", maxWidth: "52ch" }}>
                    {b.sketch}
                  </p>
                  {b.current && (
                    <div style={{ marginTop: 10 }}>
                      <span className="tag accent">presently</span>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {/* Right column: hooks + central */}
          <div>
            <SectionHead kicker="set down for those who watch">Hints already dropped</SectionHead>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {p.hooks.map((h, i) => (
                <li key={i} style={{ padding: "12px 0", borderTop: "0.5px dotted var(--rule)", display: "flex", gap: 12 }}>
                  <span className="mono" style={{ color: "var(--accent-deep)" }}>✦</span>
                  <span style={{ fontStyle: "italic", color: "var(--ink-soft)" }}>{h}</span>
                </li>
              ))}
            </ul>

            <SectionHead kicker="those at the heart of it">Central figures</SectionHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {p.central.map(cid => {
                const c = CHARACTERS[cid];
                if (!c) return null;
                return (
                  <div key={cid} className="row-link" onClick={() => nav("character", cid)} style={{ display: "flex", gap: 14, alignItems: "center", padding: "8px 0", borderTop: "0.5px solid var(--rule)" }}>" }}>
                    <Portrait label="" w={48} h={60} />
                    <div>
                      <div className="display" style={{ fontSize: 18, fontStyle: "italic" }}>{c.name}</div>
                      <div style={{ fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic" }}>{c.epithet}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ScreenPlot = ScreenPlot;
