// screens-chapter.jsx — weekly retrospective, framed as a chapter of a novel

function ScreenChapter({ nav, route }) {
  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav route={route} nav={nav} />

      <div style={{ position: "relative", zIndex: 1, padding: "100px 64px 160px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.4em", marginBottom: 22 }}>
            chapter the seventh
          </div>
          <h1 className="display" style={{ fontSize: 76, fontStyle: "italic", lineHeight: 0.98, marginBottom: 16 }}>
            Of an Orchard, and<br />of What Was Said in It
          </h1>
          <p className="display" style={{ fontSize: 20, fontStyle: "italic", color: "var(--ink-soft)", maxWidth: "48ch", marginInline: "auto" }}>
            in which the king speaks once, the queen signs only her name, and a banner-master rides south by night
          </p>
          <Fleuron glyph="✦   ❦   ✦" />
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
            covering the week of the lanterns
          </div>
        </div>

        <article style={{ maxWidth: "62ch", marginInline: "auto" }}>
          <p className="dropcap dropcap-illum">
            There was a season once, in the early years, when the realm believed the king would live. The court physicians spoke of him as a man newly fevered; the queen had not yet learned to write his name in her own hand; the heir was a child and slept in a cradle the carpenter had carved with pears, in honour of an orchard the king had planted on the day of his coronation, which was already in those days a famous thing. That season passed.
          </p>

          <p>
            Forty years is a long time to be a season. By the eve of this year's Feast of Lanterns it had become possible — and was indeed observed, in the marshes and in the western shires, by men who would not have dared to say so within hearing of the keep — that {parseInline("{char:caelin|the prince}", nav)} was now older than his father had been at the coronation, and that the realm had come to be governed not by a king and his regent but by a regent and the long, polite fiction of a king. The fiction was kept by one woman, and one healer, and a great quantity of wax.
          </p>

          <Fleuron glyph="✦" />

          <p>
            On the morning after the Lanterns, against every expectation, {parseInline("{char:oren|the king}", nav)} woke speaking. The word he said was {parseInline("{place:orchard|orchard}", nav)}, and he said it twice. {parseInline("{char:margreth|The Queen Regent}", nav)} stood at the window with her face away from the bed and counted, as she had taught herself to count, to twelve. The prince was in the antechamber; he heard the word through the door and did not enter. Of the three persons in or near that room, none would speak afterwards of what was said, and yet by the second evening the word had reached as far as the {parseInline("{place:bell|Bell & Buckle}", nav)}, where a maid told a traveller, and the traveller told another, and the orchard, which had not been visited by the king in fourteen years, became — in the way of these things — the centre of a story it would not survive.
          </p>

          <p>
            That night, in the marsh, {parseInline("{char:vael|Lord Vael}", nav)} watched a banner-master cross his causeway with two riders behind him and did not lift his hand in farewell. The man knew the road. By the bells of the inn he had passed without stopping, and a maid there said afterwards that the lead rider had eyes of a colour she could not name.
          </p>

          <Fleuron glyph="❦" />

          <p>
            The week ended, as such weeks end, with a writ. The harvest-tithes of the western shires wanted the king's seal; {parseInline("{char:margreth|the Queen Regent}", nav)} signed it instead with her name only. It was a very small thing. She had signed in his place every day for thirty-eight years. But her name alone, on a tax-writ, was a thing the realm had not seen before, and she sent it south by the next courier without looking at it again.
          </p>

          <p>
            What this week kept, the next will spend. There is to be a council. The {parseInline("{thread:succession|long succession}", nav)} has begun to be spoken of by name.
          </p>

        </article>

        <div style={{ textAlign: "center", marginTop: 80 }}>
          <Fleuron glyph="✦   ✦   ✦" />
          <div style={{ display: "flex", justifyContent: "center", gap: 60, marginTop: 24 }}>
            <span className="nav-link">← chapter the sixth</span>
            <span className="nav-link" onClick={() => nav("chronicle")}>back to the chronicle</span>
            <span style={{ color: "var(--ink-ghost)" }}>chapter the eighth →</span>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ScreenChapter = ScreenChapter;
