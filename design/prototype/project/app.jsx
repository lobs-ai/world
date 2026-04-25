// app.jsx — router + tweaks + intervention overlay

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "tone": "grimdark",
  "typePairing": "old-print",
  "density": "regular",
  "dropcap": "illum",
  "deckled": true,
  "foxing": 0.55,
  "texture": 0.55
}/*EDITMODE-END*/;

function App() {
  const [route, setRoute] = useState({ screen: "landing", id: null });
  const [intervention, setIntervention] = useState(false);
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply body classes from tweaks
  useEffect(() => {
    const b = document.body;
    b.classList.remove("tone-grimdark","tone-folkloric","tone-romantic","tone-mythic");
    b.classList.add(`tone-${t.tone}`);
    b.classList.remove("type-old","type-classical","type-modern");
    b.classList.add(`type-${t.typePairing === "old-print" ? "old" : t.typePairing}`);
    b.classList.remove("density-compact","density-regular","density-airy");
    b.classList.add(`density-${t.density}`);
    document.documentElement.style.setProperty("--foxing-opacity", t.foxing);
    document.documentElement.style.setProperty("--texture-opacity", t.texture);
  }, [t.tone, t.typePairing, t.density, t.foxing, t.texture]);

  const nav = (screen, id = null) => {
    setRoute({ screen, id });
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  window.__nav = nav;

  let screen;
  switch (route.screen) {
    case "landing":   screen = <ScreenLanding nav={nav} />; break;
    case "chronicle": screen = <ScreenChronicle nav={nav} route={route} tweaks={t} openIntervention={() => setIntervention(true)} />; break;
    case "character": screen = <ScreenCharacter nav={nav} route={route} id={route.id || "caelin"} />; break;
    case "plot":      screen = <ScreenPlot nav={nav} route={route} id={route.id || "succession"} />; break;
    case "location":  screen = <ScreenLocation nav={nav} route={route} id={route.id || "highkeep"} />; break;
    case "map":       screen = <ScreenMap nav={nav} route={route} />; break;
    case "chapter":   screen = <ScreenChapter nav={nav} route={route} />; break;
    case "admin":     screen = <ScreenAdmin nav={nav} route={route} />; break;
    default:          screen = <ScreenLanding nav={nav} />;
  }

  // Apply deckled class on chronicle entries via document body data attr
  useEffect(() => {
    document.body.dataset.deckled = t.deckled ? "on" : "off";
  }, [t.deckled]);

  return (
    <div className="app" data-screen-label={route.screen}>
      {screen}

      {intervention && <ScreenIntervention onClose={() => setIntervention(false)} />}

      <TweaksPanel>
        <TweakSection label="The voice of the world" />
        <TweakRadio label="Tone"
          value={t.tone}
          options={[
            { value: "grimdark", label: "Grimdark" },
            { value: "folkloric", label: "Folkloric" },
            { value: "romantic", label: "Romantic" },
            { value: "mythic", label: "Mythic" },
          ]}
          onChange={(v) => setTweak("tone", v)} />

        <TweakSection label="Typography" />
        <TweakRadio label="Pairing"
          value={t.typePairing}
          options={[
            { value: "old-print", label: "Old print" },
            { value: "classical", label: "Classical" },
            { value: "modern", label: "Modern" },
          ]}
          onChange={(v) => setTweak("typePairing", v)} />
        <TweakRadio label="Density"
          value={t.density}
          options={["compact","regular","airy"]}
          onChange={(v) => setTweak("density", v)} />
        <TweakRadio label="Drop cap"
          value={t.dropcap}
          options={[
            { value: "illum", label: "Illuminated" },
            { value: "plain", label: "Plain" },
            { value: "off", label: "Off" },
          ]}
          onChange={(v) => setTweak("dropcap", v)} />

        <TweakSection label="The page itself" />
        <TweakSlider label="Foxing" value={t.foxing} min={0} max={1} step={0.05}
                     onChange={(v) => setTweak("foxing", v)} />
        <TweakSlider label="Paper grain" value={t.texture} min={0} max={1} step={0.05}
                     onChange={(v) => setTweak("texture", v)} />

        <TweakSection label="Wander" />
        <TweakButton label="Premise" onClick={() => nav("landing")}>landing</TweakButton>
        <TweakButton label="Chronicle" onClick={() => nav("chronicle")}>main read</TweakButton>
        <TweakButton label="Character" onClick={() => nav("character", "caelin")}>Prince Caelin</TweakButton>
        <TweakButton label="Plot" onClick={() => nav("plot", "succession")}>The Long Succession</TweakButton>
        <TweakButton label="Location" onClick={() => nav("location", "highkeep")}>The Highkeep</TweakButton>
        <TweakButton label="Map" onClick={() => nav("map")}>map</TweakButton>
        <TweakButton label="Chapter" onClick={() => nav("chapter")}>weekly retrospective</TweakButton>
        <TweakButton label="Intervene" onClick={() => { nav("chronicle"); setIntervention(true); }}>send a prophecy</TweakButton>
        <TweakButton label="Scriptorium" onClick={() => nav("admin")}>operator view</TweakButton>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
