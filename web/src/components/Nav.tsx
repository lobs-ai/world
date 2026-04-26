import Link from "next/link";

interface NavProps {
  worldId: string;
  worldName: string;
  active?: "chronicle" | "map" | "chapter" | null;
}

export function Nav({ worldId, worldName, active }: NavProps) {
  return (
    <div className="nav">
      <div className="nav-left">
        <Link href={`/world/${worldId}`} className={`nav-link${active === "chronicle" ? " is-active" : ""}`}>
          Chronicle
        </Link>
        <Link href={`/world/${worldId}/map`} className={`nav-link${active === "map" ? " is-active" : ""}`}>
          The Realm
        </Link>
        <Link href={`/world/${worldId}/chapter`} className={`nav-link${active === "chapter" ? " is-active" : ""}`}>
          Chapter
        </Link>
      </div>
      <div className="nav-title">
        {worldName}
        <span className="small">a chronicle that writes itself</span>
      </div>
      <div className="nav-right">
        <Link href="/" className="nav-link">other worlds</Link>
      </div>
    </div>
  );
}
