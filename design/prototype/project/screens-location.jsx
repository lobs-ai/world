// screens-location.jsx — a place, who is there, what is rumoured

function ScreenLocation({ nav, route, id }) {
  const l = LOCATIONS[id] || LOCATIONS.highkeep;
  const residents = (l.residents || []).map(rid => CHARACTERS[rid]).filter(Boolean);
  const apperances = CHRONICLE.filter(e => e.locationIds.includes(l.id));

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav route={route} nav={nav} />

      <div className="page" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center" }}>
          <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.32em", marginBottom: 12 }}>
            a {l.type} of the realm
          </div>
          <h1 className="display" style={{ fontSize: 80, fontStyle: "italic", lineHeight: 0.95, marginBottom: 18 }}>
            {l.name}
          </h1>
          <p style={{ fontSize: 20, fontStyle: "italic", color: "var(--ink-soft)", maxWidth: "56ch", marginInline: "auto" }}>
            {l.description}
          </p>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-faint)", marginTop: 24 }}>
            this hour: {l.weather}
          </div>
        </div>

        <Fleuron glyph="✦   ❦   ✦" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, marginTop: 36 }}>
          {/* Residents */}
          <div>
            <SectionHead kicker="those presently here">Within the walls</SectionHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {residents.length ? residents.map(r => (
                <div key={r.id} className="row-link" onClick={() => nav("character", r.id)}
                     style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 16, padding: "12px 0", borderTop: "0.5px solid var(--rule)" }}>
                  <Portrait label="" w={60} h={75} />
                  <div>
                    <div className="display" style={{ fontSize: 22, fontStyle: "italic" }}>{r.name}</div>
                    <div style={{ fontSize: 14, color: "var(--ink-faint)", fontStyle: "italic", marginBottom: 4 }}>{r.epithet}</div>
                    <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0 }}>{r.summary}</p>
                  </div>
                </div>
              )) : <p style={{ fontStyle: "italic", color: "var(--ink-faint)" }}>None at present. Only the bees.</p>}
            </div>
          </div>

          {/* Rumors */}
          <div>
            <SectionHead kicker="overheard, this season">What is told here</SectionHead>
            {l.rumors.length ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 18 }}>
                {l.rumors.map((r, i) => (
                  <li key={i} style={{ padding: "14px 0", borderTop: "0.5px solid var(--rule)" }}>
                    <p style={{
                      fontSize: 18, fontStyle: "italic", margin: 0,
                      color: `oklch(${0.205 + (1-r.truth)*0.20} 0.014 50)`,
                      opacity: 0.55 + r.truth * 0.45
                    }}>
                      “{r.text}”
                    </p>
                    <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-faint)", marginTop: 8 }}>
                      {r.truth > 0.85 ? "near to the truth" : r.truth > 0.6 ? "in some part true" : "much-distorted"}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p style={{ fontStyle: "italic", color: "var(--ink-faint)" }}>No rumour clings to this place.</p>}

            <SectionHead kicker="entries set here">Lately written</SectionHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {apperances.slice(0, 4).map(e => (
                <div key={e.id} className="row-link" onClick={() => nav("chronicle")}
                     style={{ paddingBottom: 12, borderBottom: "0.5px dotted var(--rule)" }}>
                  <div className="display" style={{ fontSize: 18, fontStyle: "italic" }}>{e.title}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                    {e.inWorldDate}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ScreenLocation = ScreenLocation;
