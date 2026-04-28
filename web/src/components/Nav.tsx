import Link from "next/link";

interface NavProps {
  worldId: string;
  worldName: string;
  active?:
    | "chronicle"
    | "story"
    | "cast"
    | "world"
    | "atlas"
    | "codex"
    | "timeline"
    | "threads"
    | null;
}

// Nav layout: read first, explore the world second, browse the index/time
// third. Order is deliberate — left-to-right is "the story → the people
// and places → the long view."
const LINKS: { key: NonNullable<NavProps["active"]>; label: string; path: string }[] = [
  { key: "chronicle", label: "Chronicle", path: "" },
  { key: "story", label: "Story", path: "/story" },
  { key: "cast", label: "Cast", path: "/cast" },
  { key: "atlas", label: "Atlas", path: "/map" },
  { key: "codex", label: "Codex", path: "/codex" },
  { key: "timeline", label: "Timeline", path: "/timeline" },
  { key: "threads", label: "Threads", path: "/threads" },
  { key: "world", label: "The World", path: "/about" },
];

export function Nav({ worldId, worldName, active }: NavProps) {
  return (
    <div className="nav">
      <div className="nav-left">
        {LINKS.map((l) => (
          <Link
            key={l.key}
            href={`/world/${worldId}${l.path}`}
            className={`nav-link${active === l.key ? " is-active" : ""}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <div className="nav-title">
        {worldName}
        <span className="small">a chronicle that writes itself</span>
      </div>
      <div className="nav-right">
        <Link href="/" className="nav-link">All chronicles</Link>
      </div>
    </div>
  );
}
