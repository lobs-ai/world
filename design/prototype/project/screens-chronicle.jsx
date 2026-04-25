// screens-chronicle.jsx — the main read

function ChronicleEntry({ entry, idx, dropcapStyle, nav, showOpener }) {
  const chars = entry.characterIds.map(id => CHARACTERS[id]).filter(Boolean);
  const places = entry.locationIds.map(id => LOCATIONS[id]).filter(Boolean);
  const plot = PLOTS[entry.plotIds[0]];

  return (
    <article style={{ marginBottom: 64, position: "relative" }}>
      {/* Marginalia — left side: in-world date + weather */}
      <div style={{
        position: "absolute", left: -210, top: 6, width: 190,
        textAlign: "right", color: "var(--ink-faint)",
        fontFamily: "var(--mono)", fontSize: 10.5, lineHeight: 1.6,
        letterSpacing: "0.04em"
      }}>
        <div style={{ fontFamily: "var(--display-sc)", fontSize: 13, letterSpacing: "0.16em", color: "var(--ink-soft)", marginBottom: 6 }}>
          {entry.inWorldDate}
        </div>
        <div>{entry.timeOfDay}</div>
        <div style={{ fontStyle: "italic" }}>{entry.weather}</div>
      </div>

      {/* Title */}
      <h2 className="display" style={{
        fontStyle: "italic", fontSize: 36, marginBottom: 6,
        color: "var(--ink)"
      }}>{entry.title}</h2>

      {/* Tags row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 22 }}>
        {plot && (
          <span className="tag accent clickable"
                onClick={() => nav("plot", plot.id)}>
            {plot.title}
          </span>
        )}
        {places.slice(0, 2).map(p => (
          <span key={p.id} className="tag clickable"
                onClick={() => nav("location", p.id)}>
            {p.name}
          </span>
        ))}
      </div>

      {/* Body */}
      <div>
        {entry.paragraphs.map((p, i) => (
          <ChroniclePara key={i} p={p} nav={nav}
                         isFirst={i === 0 && showOpener && p.kind === "scene"}
                         dropcapStyle={dropcapStyle} />
        ))}
      </div>

      <Fleuron glyph={idx % 2 === 0 ? "✦" : "❦"} />
    </article>
  );
}

function ScreenChronicle({ nav, route, tweaks, openIntervention }) {
  const dropcap = tweaks?.dropcap || "illum";

  // Section break after first entry — ambient + then older
  const [firstEntry, ...rest] = CHRONICLE;

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav route={route} nav={nav} />

      {/* Hero — the world's heading */}
      <section style={{ position: "relative", zIndex: 1, padding: "80px 64px 0", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ textAlign: "center" }}>
          <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.4em", marginBottom: 16 }}>
            ✦&nbsp;&nbsp;the chronicle of&nbsp;&nbsp;✦
          </div>
          <h1 className="display" style={{ fontStyle: "italic", fontSize: 92, lineHeight: 1, marginBottom: 28, paddingBottom: 6 }}>
            Aelmere
          </h1>
          <p style={{
            fontSize: 19, fontStyle: "italic", color: "var(--ink-soft)",
            maxWidth: "52ch", marginInline: "auto"
          }}>
            Being the four-and-fortieth year of King Oren the Patient, called also the Lingering, in whose long sickness the realm has now passed two generations.
          </p>
          <div style={{ marginTop: 28, display: "flex", gap: 24, justifyContent: "center", alignItems: "center" }}>
            <span className="mono" style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
              last writ at the hour of vespers, this evening
            </span>
            <span style={{ color: "var(--ink-ghost)" }}>·</span>
            <span className="nav-link" onClick={openIntervention}>send a prophecy →</span>
          </div>
        </div>

        <Fleuron glyph="✦   ✦   ✦" />
      </section>

      {/* Entries */}
      <section style={{ position: "relative", zIndex: 1, padding: "0 64px 120px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ maxWidth: "62ch", marginInline: "auto", position: "relative" }}>
          <ChronicleEntry entry={firstEntry} idx={0} dropcapStyle={dropcap} nav={nav} showOpener={true} />

          {/* Ambient line */}
          <div style={{
            textAlign: "center", color: "var(--ink-faint)",
            fontStyle: "italic", fontSize: 16,
            margin: "12px 0 56px", letterSpacing: "0.01em"
          }}>
            {AMBIENT[0]}
          </div>

          {rest.map((e, i) => (
            <ChronicleEntry key={e.id} entry={e} idx={i+1} dropcapStyle={dropcap} nav={nav} showOpener={false} />
          ))}

          <div style={{ textAlign: "center", marginTop: 60 }}>
            <span className="display-sc" style={{ color: "var(--ink-faint)", fontSize: 14, letterSpacing: "0.32em" }}>
              ❧ &nbsp; here ends the present writ &nbsp; ❧
            </span>
            <div style={{ marginTop: 24 }}>
              <span className="nav-link" onClick={() => nav("chapter")}>read the most recent chapter →</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

window.ScreenChronicle = ScreenChronicle;
