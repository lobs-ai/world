// screens-map.jsx — Wheel-of-Time-style painted map of Aelmere
// Pan/zoom + chronicle event pins

function ScreenMap({ nav, route }) {
  const [hover, setHover] = useState(null);
  const [pinHover, setPinHover] = useState(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [drag, setDrag] = useState(null);
  const stageRef = useRef(null);

  const places = [
    { id: "highkeep",  x: 600, y: 360, label: "The Highkeep",     region: "Aelmere",   important: true },
    { id: "orchard",   x: 680, y: 410, label: "King's Orchard",   region: "Aelmere" },
    { id: "bell",      x: 510, y: 530, label: "Bell & Buckle",    region: "the Wold" },
    { id: "marshhold", x: 440, y: 660, label: "Marshhold",        region: "the Marsh", important: true },
    { id: "owlcot",    x: 880, y: 290, label: "Owlcot",           region: "Eastern Cliffs" },
  ];

  // Chronicle event pins — spatially placed against the map. Each ties to a chronicle entry.
  const eventPins = [
    { n: "i",   loc: "highkeep",  entry: "e168", title: "A Council Called",       at: { x: 615, y: 345 } },
    { n: "ii",  loc: "highkeep",  entry: "e167", title: "A Story About a Horse",  at: { x: 588, y: 380 } },
    { n: "iii", loc: "orchard",   entry: "e166", title: "The Orchard, Asked After", at: { x: 692, y: 420 } },
    { n: "iv",  loc: "owlcot",    entry: "e165", title: "The Third Dream",        at: { x: 875, y: 282 } },
    { n: "v",   loc: "highkeep",  entry: "e164", title: "An Unsigned Writ",       at: { x: 632, y: 372 } },
    { n: "vi",  loc: "marshhold", entry: "e163", title: "A Banner-Master Rides",  at: { x: 452, y: 658 } },
  ];

  // Pan / zoom
  const onPointerDown = (e) => {
    if (e.target.closest("[data-pin]") || e.target.closest("[data-place]")) return;
    setDrag({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };
  const onPointerMove = (e) => {
    if (!drag) return;
    setTransform(t => ({ ...t, x: e.clientX - drag.x, y: e.clientY - drag.y }));
  };
  const onPointerUp = () => setDrag(null);
  const onWheel = (e) => {
    e.preventDefault();
    const rect = stageRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const dk = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setTransform(t => {
      const k = Math.max(0.5, Math.min(3.5, t.k * dk));
      const ratio = k / t.k;
      return {
        k,
        x: cx - (cx - t.x) * ratio,
        y: cy - (cy - t.y) * ratio,
      };
    });
  };
  const zoomBy = (factor) => {
    setTransform(t => {
      const k = Math.max(0.5, Math.min(3.5, t.k * factor));
      const rect = stageRef.current.getBoundingClientRect();
      const cx = rect.width / 2, cy = rect.height / 2;
      const ratio = k / t.k;
      return { k, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio };
    });
  };
  const reset = () => setTransform({ x: 0, y: 0, k: 1 });

  return (
    <div className="paper" style={{ minHeight: "100vh" }}>
      <Nav route={route} nav={nav} />

      <div style={{ position: "relative", zIndex: 1, padding: "32px 32px 60px", maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div className="display-sc" style={{ fontSize: 13, color: "var(--ink-faint)", letterSpacing: "0.32em" }}>
            a true and unfolded chart of
          </div>
          <h1 className="display" style={{ fontSize: 56, fontStyle: "italic", lineHeight: 1, margin: "8px 0" }}>
            The Realm of Aelmere
          </h1>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
            drag to wander &nbsp;·&nbsp; scroll to draw nearer &nbsp;·&nbsp; click a pin to read what passed there
          </div>
        </div>

        {/* Stage */}
        <div ref={stageRef}
             onPointerDown={onPointerDown}
             onPointerMove={onPointerMove}
             onPointerUp={onPointerUp}
             onPointerLeave={onPointerUp}
             onWheel={onWheel}
             style={{
               position: "relative",
               width: "100%", height: 720,
               border: "1px solid var(--ink)",
               background: "#0a1a26",
               overflow: "hidden",
               cursor: drag ? "grabbing" : "grab",
               boxShadow: "inset 0 0 0 8px var(--paper-deep), inset 0 0 0 9px var(--ink), 0 30px 80px rgba(0,0,0,0.4)"
             }}>

          <svg viewBox="0 0 1300 800" preserveAspectRatio="xMidYMid meet"
               style={{
                 width: "100%", height: "100%", display: "block",
                 transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
                 transformOrigin: "0 0",
                 transition: drag ? "none" : "transform 220ms ease",
                 userSelect: "none"
               }}>
            <defs>
              {/* Land elevation gradient */}
              <radialGradient id="land-grad" cx="55%" cy="45%" r="70%">
                <stop offset="0%"  stopColor="#e8d59a" />
                <stop offset="40%" stopColor="#cfae67" />
                <stop offset="75%" stopColor="#9b7e3f" />
                <stop offset="100%" stopColor="#5d4923" />
              </radialGradient>
              {/* Sea */}
              <radialGradient id="sea-grad" cx="50%" cy="50%" r="80%">
                <stop offset="0%"  stopColor="#1f3a52" />
                <stop offset="60%" stopColor="#13283a" />
                <stop offset="100%" stopColor="#0a1a26" />
              </radialGradient>
              {/* Marsh */}
              <linearGradient id="marsh-grad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#7a8a52" />
                <stop offset="100%" stopColor="#3e4a26" />
              </linearGradient>
              {/* Forest */}
              <linearGradient id="forest-grad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#3e5a2c" />
                <stop offset="100%" stopColor="#23341a" />
              </linearGradient>
              {/* Mountains */}
              <linearGradient id="mtn-grad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#d8d3c2" />
                <stop offset="55%" stopColor="#7a6b4a" />
                <stop offset="100%" stopColor="#3a2e18" />
              </linearGradient>

              {/* Wave hatching pattern */}
              <pattern id="waves" width="20" height="10" patternUnits="userSpaceOnUse">
                <path d="M 0 5 Q 5 2, 10 5 T 20 5" stroke="#3a5a78" strokeWidth="0.6" fill="none" opacity="0.55" />
              </pattern>
              {/* paper grain over land */}
              <filter id="grain"><feTurbulence baseFrequency="0.9" numOctaves="2" seed="2"/><feColorMatrix values="0 0 0 0 0.4  0 0 0 0 0.3  0 0 0 0 0.15  0 0 0 0.2 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
              {/* coastline rough */}
              <filter id="rough"><feTurbulence baseFrequency="0.04" numOctaves="2" seed="5"/><feDisplacementMap in="SourceGraphic" scale="3"/></filter>
              <filter id="rougher"><feTurbulence baseFrequency="0.02" numOctaves="3" seed="8"/><feDisplacementMap in="SourceGraphic" scale="6"/></filter>

              <pattern id="hatch-marsh" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="#1a2410" strokeWidth="0.5" opacity="0.7" />
              </pattern>
            </defs>

            {/* SEA */}
            <rect x="0" y="0" width="1300" height="800" fill="url(#sea-grad)" />
            <rect x="0" y="0" width="1300" height="800" fill="url(#waves)" />

            {/* coastal halo — paler ring around land */}
            <path d="M 140 240 Q 180 140, 320 120 Q 480 95, 700 130 Q 880 160, 1020 240 Q 1110 320, 1100 480 Q 1080 620, 940 700 Q 760 760, 540 740 Q 360 720, 220 620 Q 110 480, 140 240 Z"
                  fill="#5b7185" opacity="0.35" filter="url(#rougher)" transform="scale(1.04) translate(-25,-15)" />

            {/* MAINLAND */}
            <path d="M 140 240 Q 180 140, 320 120 Q 480 95, 700 130 Q 880 160, 1020 240 Q 1110 320, 1100 480 Q 1080 620, 940 700 Q 760 760, 540 740 Q 360 720, 220 620 Q 110 480, 140 240 Z"
                  fill="url(#land-grad)" stroke="#3a2e18" strokeWidth="1.2" filter="url(#rough)" />
            {/* land grain */}
            <path d="M 140 240 Q 180 140, 320 120 Q 480 95, 700 130 Q 880 160, 1020 240 Q 1110 320, 1100 480 Q 1080 620, 940 700 Q 760 760, 540 740 Q 360 720, 220 620 Q 110 480, 140 240 Z"
                  fill="url(#land-grad)" opacity="0.6" filter="url(#grain)" />

            {/* MOUNTAIN RANGE — north */}
            <g>
              {Array.from({ length: 28 }).map((_, i) => {
                const x = 280 + i * 22 + (i % 3) * 4;
                const y = 200 + (i % 4) * 6;
                const h = 38 + (i % 5) * 8;
                return (
                  <g key={"m"+i}>
                    <path d={`M ${x} ${y} l ${h*0.4} ${-h} l ${h*0.6} ${h} Z`}
                          fill="url(#mtn-grad)" stroke="#2a2010" strokeWidth="0.7" />
                    {/* snow cap */}
                    <path d={`M ${x + h*0.4 - 4} ${y - h + 8} l 4 ${-8} l 6 ${8} l ${-3} 1 l ${-2} ${-3} l ${-2} 3 Z`}
                          fill="#f3eeda" opacity="0.85" />
                  </g>
                );
              })}
              {Array.from({ length: 16 }).map((_, i) => {
                const x = 880 + i * 14;
                const y = 200 + (i % 3) * 8;
                const h = 28 + (i % 4) * 6;
                return (
                  <path key={"e"+i} d={`M ${x} ${y} l ${h*0.4} ${-h} l ${h*0.6} ${h} Z`}
                        fill="url(#mtn-grad)" stroke="#2a2010" strokeWidth="0.6" />
                );
              })}
            </g>

            {/* FORESTS — east of capital */}
            <g>
              {Array.from({ length: 80 }).map((_, i) => {
                const col = i % 10, row = Math.floor(i / 10);
                const x = 760 + col * 18 + (row % 2) * 9;
                const y = 380 + row * 16;
                return (
                  <g key={"t"+i}>
                    <ellipse cx={x} cy={y} rx="9" ry="11" fill="url(#forest-grad)" stroke="#1a2410" strokeWidth="0.5" />
                    <line x1={x} y1={y+10} x2={x} y2={y+14} stroke="#1a2410" strokeWidth="0.6" />
                  </g>
                );
              })}
            </g>
            {/* small forest west */}
            <g>
              {Array.from({ length: 24 }).map((_, i) => {
                const col = i % 6, row = Math.floor(i / 6);
                const x = 240 + col * 16 + (row % 2) * 8;
                const y = 480 + row * 14;
                return (
                  <g key={"tw"+i}>
                    <ellipse cx={x} cy={y} rx="7" ry="9" fill="url(#forest-grad)" stroke="#1a2410" strokeWidth="0.4" />
                  </g>
                );
              })}
            </g>

            {/* MARSH — south */}
            <path d="M 360 600 Q 480 580, 580 620 Q 600 690, 500 710 Q 380 700, 340 670 Q 320 630, 360 600 Z"
                  fill="url(#marsh-grad)" stroke="#1a2410" strokeWidth="0.8" />
            <path d="M 360 600 Q 480 580, 580 620 Q 600 690, 500 710 Q 380 700, 340 670 Q 320 630, 360 600 Z"
                  fill="url(#hatch-marsh)" />
            {/* reeds */}
            {Array.from({ length: 18 }).map((_, i) => {
              const x = 370 + (i * 13) % 200;
              const y = 615 + (i * 7) % 80;
              return <line key={"r"+i} x1={x} y1={y} x2={x} y2={y-7} stroke="#1a2410" strokeWidth="0.5" />;
            })}

            {/* RIVER OWL */}
            <path d="M 360 250 Q 460 320, 600 360 Q 720 400, 860 480"
                  fill="none" stroke="#5b8aa8" strokeWidth="4" strokeLinecap="round" />
            <path d="M 360 250 Q 460 320, 600 360 Q 720 400, 860 480"
                  fill="none" stroke="#a3c5d8" strokeWidth="1.4" />
            <text fontFamily="var(--display)" fontSize="18" fontStyle="italic" fill="#13283a">
              <textPath href="#riverpath" startOffset="20%">river Owl</textPath>
            </text>
            <path id="riverpath" d="M 360 250 Q 460 320, 600 360 Q 720 400, 860 480" fill="none" />

            {/* ROAD — Highkeep → Bell → Marshhold */}
            <path d="M 600 360 Q 565 440, 510 530 Q 470 600, 440 660"
                  fill="none" stroke="#3a2e18" strokeWidth="1.2" strokeDasharray="4 5" opacity="0.7" />

            {/* REGION LABELS */}
            <g fontFamily="var(--display)" fontStyle="italic" fill="#3a2e18">
              <text x="540" y="280" fontSize="34" letterSpacing="6" opacity="0.7">AELMERE</text>
              <text x="430" y="640" fontSize="22" letterSpacing="4" opacity="0.7">THE MARSH</text>
              <text x="430" y="490" fontSize="18" letterSpacing="3" opacity="0.6">the wold</text>
              <text x="820" y="540" fontSize="20" letterSpacing="3" opacity="0.65">EASTWOOD</text>
              <text x="850" y="220" fontSize="20" letterSpacing="3" opacity="0.7">eastern cliffs</text>
              <text x="380" y="200" fontSize="16" letterSpacing="3" opacity="0.6">the spine</text>
              <text x="80"  y="430" fontSize="22" letterSpacing="4" fill="#a3c5d8" opacity="0.85">Western Ocean</text>
              <text x="900" y="690" fontSize="20" letterSpacing="4" fill="#a3c5d8" opacity="0.85">the Sea of Owls</text>
            </g>

            {/* BANNER CARTOUCHE — top left */}
            <g transform="translate(50,40)">
              <path d="M 0 0 L 380 0 L 380 70 L 360 90 L 340 70 L 40 70 L 20 90 L 0 70 Z"
                    fill="#f4e7c4" stroke="#3a2e18" strokeWidth="1.2" />
              <path d="M 0 0 L 380 0 L 380 6 L 0 6 Z" fill="#3a2e18" opacity="0.15" />
              {/* drape ends */}
              <path d="M 0 70 L -18 110 L 6 96 L 20 90 Z" fill="#d6c290" stroke="#3a2e18" strokeWidth="1" />
              <path d="M 380 70 L 398 110 L 374 96 L 360 90 Z" fill="#d6c290" stroke="#3a2e18" strokeWidth="1" />
              <text x="190" y="32" textAnchor="middle" fontFamily="var(--display)" fontStyle="italic" fontSize="28" fill="#3a2e18">
                The Realm of Aelmere
              </text>
              <text x="190" y="55" textAnchor="middle" fontFamily="var(--mono)" fontSize="9" letterSpacing="0.32em" fill="#3a2e18" opacity="0.8">
                AS KNOWN AT THE FEAST OF LANTERNS
              </text>
            </g>

            {/* COMPASS ROSE — bottom-left, owl motif (since Year of the Owl) */}
            <g transform="translate(155,690)">
              <circle r="58" fill="#f4e7c4" stroke="#3a2e18" strokeWidth="1" />
              <circle r="46" fill="none" stroke="#3a2e18" strokeWidth="0.4" />
              <circle r="32" fill="none" stroke="#3a2e18" strokeWidth="0.3" />
              {/* cardinal points */}
              {[0,90,180,270].map(a => (
                <g key={a} transform={`rotate(${a})`}>
                  <path d="M 0 -54 L 5 0 L 0 54 L -5 0 Z" fill="#3a2e18" />
                </g>
              ))}
              {[45,135,225,315].map(a => (
                <g key={a} transform={`rotate(${a})`}>
                  <path d="M 0 -38 L 3 0 L 0 38 L -3 0 Z" fill="#7a6b4a" />
                </g>
              ))}
              {/* owl head silhouette in centre */}
              <ellipse cx="0" cy="0" rx="11" ry="9" fill="#3a2e18" />
              <circle cx="-4" cy="-1" r="2.2" fill="#f4e7c4" />
              <circle cx="4"  cy="-1" r="2.2" fill="#f4e7c4" />
              <circle cx="-4" cy="-1" r="0.9" fill="#3a2e18" />
              <circle cx="4"  cy="-1" r="0.9" fill="#3a2e18" />
              <path d="M -1 1 L 0 4 L 1 1 Z" fill="#7a6b4a" />
              {/* tufts */}
              <path d="M -10 -7 L -8 -12 L -6 -8 Z" fill="#3a2e18" />
              <path d="M  10 -7 L  8 -12 L  6 -8 Z" fill="#3a2e18" />
              {/* labels */}
              <text y="-66" textAnchor="middle" fontFamily="var(--display)" fontSize="14" fontStyle="italic" fill="#3a2e18">N</text>
              <text y="74" textAnchor="middle" fontFamily="var(--display)" fontSize="14" fontStyle="italic" fill="#3a2e18">S</text>
              <text x="68" y="4" textAnchor="middle" fontFamily="var(--display)" fontSize="14" fontStyle="italic" fill="#3a2e18">E</text>
              <text x="-68" y="4" textAnchor="middle" fontFamily="var(--display)" fontSize="14" fontStyle="italic" fill="#3a2e18">W</text>
            </g>

            {/* SHIP — west sea */}
            <g transform="translate(70,300) scale(0.9)" stroke="#3a2e18" strokeWidth="0.8" fill="#f4e7c4">
              <path d="M 0 22 Q 8 30, 38 30 Q 60 30, 70 22 L 60 32 L 8 32 Z" />
              <line x1="20" y1="22" x2="20" y2="-22" />
              <line x1="46" y1="22" x2="46" y2="-14" />
              <path d="M 20 -20 Q 30 -10, 20 0 Z" fill="#e6d6a3" />
              <path d="M 20 -2 Q 35 8, 20 18 Z" fill="#e6d6a3" />
              <path d="M 46 -12 Q 56 -4, 46 6 Z" fill="#e6d6a3" />
            </g>
            {/* SHIP — south sea */}
            <g transform="translate(680,720) scale(0.7)" stroke="#3a2e18" strokeWidth="0.8" fill="#f4e7c4">
              <path d="M 0 22 Q 8 30, 38 30 Q 60 30, 70 22 L 60 32 L 8 32 Z" />
              <line x1="30" y1="22" x2="30" y2="-18" />
              <path d="M 30 -16 Q 42 -6, 30 4 Z" fill="#e6d6a3" />
              <path d="M 30 6 Q 44 16, 30 26 Z" fill="#e6d6a3" />
            </g>
            {/* sea creature — east */}
            <g transform="translate(1100,540)" stroke="#a3c5d8" fill="none" strokeWidth="0.8">
              <path d="M 0 0 Q 14 -12, 32 -3 Q 46 8, 60 -3 Q 50 12, 32 8 Q 14 14, 0 0 Z" />
              <text fontFamily="var(--display)" fontStyle="italic" fontSize="11" fill="#a3c5d8" y="22" x="0">here be quiet things</text>
            </g>
            {/* small island */}
            <g transform="translate(150,520)">
              <ellipse cx="0" cy="0" rx="14" ry="9" fill="url(#land-grad)" stroke="#3a2e18" strokeWidth="0.7" />
              <text fontFamily="var(--display)" fontStyle="italic" fontSize="10" fill="#3a2e18" y="22" textAnchor="middle">Drowned Isle</text>
            </g>

            {/* PLACE MARKERS */}
            {places.map(p => {
              const isH = hover === p.id;
              return (
                <g key={p.id}
                   data-place
                   onMouseEnter={() => setHover(p.id)}
                   onMouseLeave={() => setHover(null)}
                   onClick={() => nav("location", p.id)}
                   style={{ cursor: "pointer" }}>
                  {p.important ? (
                    <g transform={`translate(${p.x},${p.y})`}>
                      {/* tower icon */}
                      <rect x="-8" y="-2" width="16" height="20" fill="#f4e7c4" stroke="#3a2e18" strokeWidth="1.3" />
                      <path d="M -10 -2 L 0 -14 L 10 -2 Z" fill="#a02a2a" stroke="#3a2e18" strokeWidth="1.3" />
                      <rect x="-3" y="6" width="6" height="10" fill="#3a2e18" />
                      <rect x="-8" y="-4" width="16" height="2" fill="#3a2e18" />
                    </g>
                  ) : (
                    <g transform={`translate(${p.x},${p.y})`}>
                      <circle r="6" fill="#f4e7c4" stroke="#3a2e18" strokeWidth="1.2" />
                      <circle r="2.5" fill="#a02a2a" />
                    </g>
                  )}
                  <text x={p.x + 14} y={p.y + 6}
                        fontFamily="var(--display)"
                        fontSize={p.important ? 22 : 16}
                        fontStyle="italic"
                        fill={isH ? "#a02a2a" : "#1a1208"}
                        stroke="#f4e7c4" strokeWidth={isH ? 0 : 3} paintOrder="stroke">
                    {p.label}
                  </text>
                </g>
              );
            })}

            {/* CHRONICLE EVENT PINS — wax seals */}
            {eventPins.map(pin => {
              const isH = pinHover === pin.entry;
              return (
                <g key={pin.entry}
                   data-pin
                   onMouseEnter={() => setPinHover(pin.entry)}
                   onMouseLeave={() => setPinHover(null)}
                   onClick={(e) => { e.stopPropagation(); nav("chronicle"); }}
                   style={{ cursor: "pointer" }}>
                  <g transform={`translate(${pin.at.x},${pin.at.y - 28})`}>
                    {/* ribbon tail */}
                    <path d="M -2 12 L -5 22 L 0 18 L 5 22 L 2 12 Z" fill="#7a1a1a" stroke="#3a0a0a" strokeWidth="0.6" />
                    {/* seal */}
                    <circle r={isH ? 14 : 11} fill="#a02a2a" stroke="#3a0a0a" strokeWidth="1.2" />
                    <circle r={isH ? 11 : 8.5} fill="none" stroke="#3a0a0a" strokeWidth="0.5" strokeDasharray="2 2" />
                    <text textAnchor="middle" y="3"
                          fontFamily="var(--display)" fontStyle="italic"
                          fontSize={isH ? 12 : 10} fill="#f4e7c4">
                      {pin.n}
                    </text>
                  </g>
                  {isH && (
                    <g transform={`translate(${pin.at.x + 18},${pin.at.y - 60})`}>
                      <rect x="0" y="0" width="220" height="46" fill="#f4e7c4" stroke="#3a2e18" strokeWidth="1" />
                      <text x="10" y="18" fontFamily="var(--display)" fontStyle="italic" fontSize="14" fill="#3a2e18">
                        {pin.title}
                      </text>
                      <text x="10" y="36" fontFamily="var(--mono)" fontSize="9" letterSpacing="0.16em" fill="#3a2e18" opacity="0.7">
                        CLICK TO READ THE CHRONICLE
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* SCALE — bottom right */}
            <g transform="translate(1080,755)">
              <rect x="0" y="0" width="40" height="6" fill="#3a2e18" />
              <rect x="40" y="0" width="40" height="6" fill="#f4e7c4" stroke="#3a2e18" strokeWidth="0.6" />
              <rect x="80" y="0" width="40" height="6" fill="#3a2e18" />
              <text y="-4" fontFamily="var(--mono)" fontSize="9" letterSpacing="0.16em" fill="#3a2e18">100 LEAGUES</text>
            </g>
          </svg>

          {/* ZOOM CONTROLS */}
          <div style={{
            position: "absolute", right: 18, top: 18,
            display: "flex", flexDirection: "column", gap: 6,
            background: "rgba(244,231,196,0.94)", border: "1px solid #3a2e18",
            padding: 6, fontFamily: "var(--mono)"
          }}>
            <button onClick={() => zoomBy(1.25)} className="map-btn">＋</button>
            <button onClick={() => zoomBy(0.8)}  className="map-btn">－</button>
            <button onClick={reset} className="map-btn" style={{ fontSize: 10 }}>fit</button>
          </div>

          {/* LEGEND */}
          <div style={{
            position: "absolute", left: 18, bottom: 18,
            background: "rgba(244,231,196,0.94)", border: "1px solid #3a2e18",
            padding: "10px 14px", fontFamily: "var(--display)", fontStyle: "italic",
            color: "#3a2e18", fontSize: 13, lineHeight: 1.5, maxWidth: 260
          }}>
            <div style={{ fontFamily: "var(--mono)", fontStyle: "normal", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6, color: "#5e4a20" }}>
              Of the chart
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
              <span style={{ width: 14, height: 14, background: "#a02a2a", borderRadius: "50%", border: "1px solid #3a0a0a", display: "inline-block" }} />
              a place where the chronicle has lately turned
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{
                width: 14, height: 14, display: "inline-block",
                background: "#f4e7c4", border: "1px solid #3a2e18"
              }} />
              a town, keep, or anchorage of the realm
            </div>
          </div>
        </div>

        <style>{`
          .map-btn{
            appearance:none; border:1px solid #3a2e18; background:#f4e7c4;
            color:#3a2e18; width:30px; height:30px;
            font-family: var(--display); font-size: 18px;
            cursor: pointer; padding: 0;
          }
          .map-btn:hover{ background:#3a2e18; color:#f4e7c4; }
        `}</style>
      </div>
    </div>
  );
}

window.ScreenMap = ScreenMap;
