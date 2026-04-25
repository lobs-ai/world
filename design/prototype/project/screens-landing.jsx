// screens-landing.jsx — premise input + catalog of running worlds

function ScreenLanding({ nav }) {
  const [premise, setPremise] = useState("");
  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <div className="page page-narrow" style={{ paddingTop: 100, position: "relative", zIndex: 1 }}>

        <div style={{ textAlign: "center" }}>
          <div className="display-sc" style={{ fontSize: 14, color: "var(--ink-faint)", letterSpacing: "0.4em", marginBottom: 22 }}>
            ❧&nbsp;&nbsp;a chronicle that writes itself&nbsp;&nbsp;❧
          </div>
          <h1 className="display" style={{ fontStyle: "italic", lineHeight: 1.1, marginBottom: 36 }}>
            Set down a premise.<br />Return to find a world.
          </h1>
          <p style={{ marginTop: 0, fontSize: 19, color: "var(--ink-soft)", maxWidth: "44ch", marginInline: "auto" }}>
            One sentence is enough. The chronicle begins within the hour and keeps writing whether or not you are watching.
          </p>
        </div>

        <Fleuron />

        <div style={{ marginTop: 12, position: "relative" }}>
          <textarea
            value={premise}
            onChange={(e) => setPremise(e.target.value)}
            placeholder="A kingdom where the king has been dying for forty years…"
            rows={3}
            style={{
              width: "100%", resize: "none",
              fontFamily: "var(--serif)", fontSize: 22, fontStyle: "italic",
              lineHeight: 1.5, color: "var(--ink)",
              background: "transparent", border: 0, outline: "none",
              borderTop: "0.5px solid var(--rule)",
              borderBottom: "0.5px solid var(--rule)",
              padding: "20px 4px",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
              the genesis takes some little while.
            </span>
            <button className="btn btn-primary" onClick={() => nav("chronicle")}>
              Begin a world&nbsp;&nbsp;✦
            </button>
          </div>
        </div>

        <div style={{ marginTop: 110 }}>
          <SectionHead kicker="other worlds, lately">Worlds running, this hour</SectionHead>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 18 }}>
            {[
              { name: "Aelmere",  premise: "A kingdom where the king has been dying for forty years.", tone: "grimdark", day: "Day 168", entries: 412, current: true },
              { name: "Marrowmere", premise: "A village where one road leads only to itself.", tone: "folkloric", day: "Day 41", entries: 102 },
              { name: "The Singing Sea", premise: "The sea has begun to sing again, after a thousand years of silence.", tone: "mythic", day: "Day 7", entries: 18 },
              { name: "Two Heirs of Houses Burning", premise: "Two heirs of warring houses found a third house.", tone: "tragic", day: "Day 89", entries: 218 },
            ].map(w => (
              <div key={w.name} className={"card" + (w.current ? " clickable" : "")} style={{ borderLeft: w.current ? "2px solid var(--accent)" : undefined, opacity: w.current ? 1 : 0.7 }}
                   onClick={() => w.current && nav("chronicle")}>
                <div className="display" style={{ fontSize: 24, fontStyle: "italic", marginBottom: 4 }}>{w.name}</div>
                <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 12 }}>
                  {w.tone} · {w.day} · {w.entries} entries
                </div>
                <p style={{ fontStyle: "italic", color: "var(--ink-soft)", margin: 0 }}>{w.premise}</p>
                {w.current && <div style={{ marginTop: 14 }}><span className="tag accent">currently reading</span></div>}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

window.ScreenLanding = ScreenLanding;
