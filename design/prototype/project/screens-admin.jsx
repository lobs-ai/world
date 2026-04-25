// screens-admin.jsx — dense, monospace, anti-parchment. The scriptorium.

function ScreenAdmin({ nav, route }) {
  useEffect(() => {
    document.body.classList.add("admin-mode");
    return () => document.body.classList.remove("admin-mode");
  }, []);

  const ticks = [
    { tick: 168, status: "ok", llm: "$0.62", t: "11.4s", scenes: 2, beats: 2, validated: 14, rejected: 1, plot: "succession", note: "council called; rider passes Bell & Buckle" },
    { tick: 167, status: "ok", llm: "$0.71", t: "13.2s", scenes: 2, beats: 1, validated: 11, rejected: 0, plot: "cabinet",   note: "fenwick contradicts the horse-story" },
    { tick: 166, status: "ok", llm: "$0.58", t: "10.1s", scenes: 1, beats: 1, validated: 8,  rejected: 2, plot: "succession", note: "king speaks: 'orchard'" },
    { tick: 165, status: "warn", llm: "$0.49", t: "9.8s", scenes: 1, beats: 1, validated: 6, rejected: 4, plot: "dreams",    note: "validator rejected DESIRE_FORM; refused 'gift from heaven' as prop" },
    { tick: 164, status: "ok", llm: "$0.55", t: "10.6s", scenes: 1, beats: 1, validated: 9,  rejected: 0, plot: "succession", note: "writ signed; king's seal omitted" },
    { tick: 163, status: "ok", llm: "$0.66", t: "12.1s", scenes: 2, beats: 1, validated: 12, rejected: 1, plot: "succession", note: "vael's banner-master rides; rumor spawned at Bell & Buckle" },
    { tick: 162, status: "fail", llm: "$0.18", t: "3.2s", scenes: 0, beats: 0, validated: 0, rejected: 0, plot: "—", note: "DIRECTOR malformed JSON; retry x2; tick aborted; chronicle wrote ambient" },
    { tick: 161, status: "ok", llm: "$0.61", t: "11.9s", scenes: 2, beats: 1, validated: 10, rejected: 2, plot: "succession", note: "feast of lanterns — quiet beat per pacing rule" },
  ];

  const sc = (s) => ({ ok: "#7fb069", warn: "#d4a637", fail: "#c14b4b" }[s]);

  return (
    <div style={{ minHeight: "100vh", background: "#0e0d0b", color: "#c8c2b1", fontFamily: "var(--mono)" }}>
      {/* dense header */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 18px", borderBottom: "1px solid #2a2820",
        background: "#16140f"
      }}>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <span style={{ color: "#d4a637", fontWeight: 500 }}>scriptorium</span>
          <span style={{ color: "#5e5a4d" }}>·</span>
          <span style={{ color: "#9a9484" }}>world: aelmere</span>
          <span style={{ color: "#5e5a4d" }}>·</span>
          <span style={{ color: "#9a9484" }}>tick 168</span>
          <span style={{ color: "#5e5a4d" }}>·</span>
          <span style={{ color: "#7fb069" }}>● running</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <span onClick={() => nav("chronicle")} style={{ color: "#9a9484", cursor: "default" }}>← back to chronicle</span>
        </div>
      </header>

      <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
        <Stat label="next tick in" value="11m 42s" />
        <Stat label="cost / 24h"   value="$31.84" sub="cap $48.00" />
        <Stat label="active plots" value="3" sub="0 abandoned · 4 resolved" />
        <Stat label="cohort fail" value="0.4%" sub="last 168 ticks" />
      </div>

      {/* tick log */}
      <div style={{ padding: "0 18px" }}>
        <div style={{ fontSize: 11, color: "#5e5a4d", letterSpacing: "0.22em", textTransform: "uppercase", padding: "12px 0 6px", borderTop: "1px solid #2a2820" }}>
          // TICK LOG · most recent first
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ color: "#5e5a4d", textAlign: "left", borderBottom: "1px solid #2a2820" }}>
              {["", "tick", "lat", "$", "scenes", "beats", "validated", "rejected", "focal plot", "note"].map(h => (
                <th key={h} style={{ padding: "8px 12px 8px 0", fontWeight: 400, fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ticks.map(t => (
              <tr key={t.tick} style={{ borderBottom: "1px solid #1c1a15" }}>
                <td style={{ padding: "10px 12px 10px 0" }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: sc(t.status) }} />
                </td>
                <td style={{ padding: "10px 12px 10px 0", color: "#d4a637" }}>{t.tick}</td>
                <td style={{ padding: "10px 12px 10px 0", color: "#9a9484" }}>{t.t}</td>
                <td style={{ padding: "10px 12px 10px 0", color: "#9a9484" }}>{t.llm}</td>
                <td style={{ padding: "10px 12px 10px 0" }}>{t.scenes}</td>
                <td style={{ padding: "10px 12px 10px 0" }}>{t.beats}</td>
                <td style={{ padding: "10px 12px 10px 0", color: "#7fb069" }}>{t.validated}</td>
                <td style={{ padding: "10px 12px 10px 0", color: t.rejected > 0 ? "#d4a637" : "#5e5a4d" }}>{t.rejected}</td>
                <td style={{ padding: "10px 12px 10px 0", color: "#9a9484" }}>{t.plot}</td>
                <td style={{ padding: "10px 12px 10px 0", color: "#a8a294", fontStyle: "italic" }}>{t.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* split — rejected changes + recent prompt */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, padding: 18 }}>
        <div>
          <div style={{ fontSize: 11, color: "#5e5a4d", letterSpacing: "0.22em", textTransform: "uppercase", padding: "12px 0 6px", borderTop: "1px solid #2a2820" }}>
            // RECENT REJECTIONS
          </div>
          <pre style={{ margin: 0, color: "#c8c2b1", fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
{`tick 168  KILL                 src=character:vael
          payload.target=oren  visibility=hidden
          REJECTED: validator/permanence
          reason: lethal action requires director sanction
          on protected character (oren · narrative_weight 0.95)

tick 165  DESIRE_FORM          src=character:irela
          goal="to know my gift is from heaven"
          REJECTED: validator/duplicate
          reason: identical desire active since tick 144

tick 162  DirectorPlan         src=director
          REJECTED: schema/parse
          reason: malformed JSON · missing field 'focal_plot_ids'
          retried 2x; aborted; quiet ambient written`}
          </pre>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#5e5a4d", letterSpacing: "0.22em", textTransform: "uppercase", padding: "12px 0 6px", borderTop: "1px solid #2a2820" }}>
            // PLOT STATE
          </div>
          <pre style={{ margin: 0, color: "#c8c2b1", fontSize: 12, lineHeight: 1.7 }}>
{`succession   rising    tension 0.78   beats 5   ticks-since-advance 0
cabinet      setup     tension 0.42   beats 3   ticks-since-advance 1
dreams       setup     tension 0.31   beats 2   ticks-since-advance 3

unpaid promises (foreshadow > payoff):
  · "third cabinet"        [ticks open: 80]   prio HIGH
  · "grey rider"           [ticks open:  5]   prio MED
  · "anchoress's dream"    [ticks open:  9]   prio MED`}
          </pre>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div style={{ border: "1px solid #2a2820", padding: "12px 14px", background: "#13110d" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "#5e5a4d", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, color: "#d4a637", fontWeight: 500 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#5e5a4d", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

window.ScreenAdmin = ScreenAdmin;
