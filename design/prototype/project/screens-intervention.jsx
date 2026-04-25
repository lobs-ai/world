// screens-intervention.jsx — reader submits prophecy / rumor / stranger

function ScreenIntervention({ onClose }) {
  const [kind, setKind] = useState("prophecy");
  const [text, setText] = useState("");
  const [where, setWhere] = useState("highkeep");
  const [submitted, setSubmitted] = useState(false);

  const kinds = [
    { id: "prophecy", label: "A prophecy", note: "spoken by a generated seer; may be heard at courts and crossroads." },
    { id: "rumor", label: "A rumour", note: "seeded in a place of your choosing; will travel as such things do." },
    { id: "stranger", label: "A stranger", note: "a brief description; may or may not become a person of the realm." },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(20, 14, 8, 0.68)",
      backdropFilter: "blur(2px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "60px 24px", overflowY: "auto"
    }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="paper deckled deckled-on" style={{
        position: "relative", width: "min(640px, 100%)",
        padding: "60px 64px 56px",
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 16, right: 20,
          background: "transparent", border: 0, cursor: "default",
          fontFamily: "var(--mono)", fontSize: 14, color: "var(--ink-faint)",
          letterSpacing: "0.16em", textTransform: "uppercase"
        }}>close ✕</button>

        {!submitted ? (
          <div style={{ position: "relative", zIndex: 1 }}>
            <div className="display-sc" style={{ fontSize: 12, color: "var(--ink-faint)", letterSpacing: "0.4em", marginBottom: 14, textAlign: "center" }}>
              an offering to the chronicle
            </div>
            <h2 className="display" style={{ fontSize: 44, fontStyle: "italic", lineHeight: 1, marginBottom: 14, textAlign: "center" }}>
              Send a thing into Aelmere
            </h2>
            <p style={{ fontStyle: "italic", color: "var(--ink-soft)", textAlign: "center", maxWidth: "44ch", marginInline: "auto" }}>
              Once a day you may set a small thing in motion. The director will see it; it may use it, or set it aside.
            </p>

            <Fleuron />

            {/* Kind picker */}
            <div style={{ display: "flex", gap: 0, marginBottom: 24, border: "0.5px solid var(--ink-soft)" }}>
              {kinds.map((k, i) => (
                <button key={k.id}
                  onClick={() => setKind(k.id)}
                  style={{
                    flex: 1, padding: "12px 8px", cursor: "default",
                    fontFamily: "var(--display)", fontSize: 16, fontStyle: "italic",
                    background: kind === k.id ? "var(--ink)" : "transparent",
                    color: kind === k.id ? "var(--paper)" : "var(--ink-soft)",
                    border: 0, borderRight: i < kinds.length - 1 ? "0.5px solid var(--ink-soft)" : 0,
                    transition: "background 120ms"
                  }}>
                  {k.label}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 18 }}>
              <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-soft)", letterSpacing: "0.18em", marginBottom: 8 }}>
                {kind === "prophecy" ? "the words of the seer" : kind === "rumor" ? "what is being said" : "a stranger, briefly"}
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder={
                  kind === "prophecy"
                  ? "When the orchard is asked after, the realm will turn upon a single hinge…"
                  : kind === "rumor"
                  ? "It is said that the third cabinet has been opened…"
                  : "A grey rider, who would not give his name, and whose horse cast no shadow at the bridge…"
                }
                style={{
                  width: "100%", fontFamily: "var(--serif)", fontSize: 19,
                  fontStyle: "italic", lineHeight: 1.55, color: "var(--ink)",
                  background: "transparent", border: "0.5px solid var(--ink-faint)",
                  padding: 14, resize: "none", outline: "none"
                }}
              />
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-faint)", marginTop: 4, letterSpacing: "0.16em", textTransform: "uppercase" }}>
                {kind === "prophecy" ? "attributed to the anchoress of the owl, or to one like her" : kind === "rumor" ? "to be planted at —" : "may or may not appear"}
              </div>
            </div>

            {kind === "rumor" && (
              <div style={{ marginBottom: 18 }}>
                <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-soft)", letterSpacing: "0.18em", marginBottom: 8 }}>
                  to be heard at
                </div>
                <select value={where} onChange={(e) => setWhere(e.target.value)}
                  style={{
                    width: "100%", padding: 10, fontFamily: "var(--serif)",
                    fontSize: 17, fontStyle: "italic", color: "var(--ink)",
                    background: "var(--paper-deep)",
                    border: "0.5px solid var(--ink-faint)"
                  }}>
                  {Object.values(LOCATIONS).map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 30 }}>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                one offering per day
              </span>
              <button className="btn btn-primary"
                disabled={!text.trim()}
                onClick={() => setSubmitted(true)}
                style={{ opacity: text.trim() ? 1 : 0.5 }}>
                Send into the world &nbsp;✦
              </button>
            </div>
          </div>
        ) : (
          <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "40px 0" }}>
            <Fleuron glyph="✦" />
            <h2 className="display" style={{ fontSize: 44, fontStyle: "italic", lineHeight: 1.1, marginBottom: 18 }}>
              It is set down.
            </h2>
            <p style={{ fontStyle: "italic", color: "var(--ink-soft)", maxWidth: "44ch", marginInline: "auto", marginBottom: 32 }}>
              The director will read your offering at the next writing. Whether it is taken up, or set quietly aside, you will know in the chronicle.
            </p>
            <Fleuron />
            <button className="btn" onClick={onClose}>Return to the chronicle</button>
          </div>
        )}
      </div>
    </div>
  );
}

window.ScreenIntervention = ScreenIntervention;
