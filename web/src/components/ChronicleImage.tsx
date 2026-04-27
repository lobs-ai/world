// A small client-safe helper that turns a stored "data/images/<hash>.png"
// path into the URL the route handler serves, and falls back gracefully
// when the image hasn't been generated yet.

export function imageUrlFromPath(path: string | undefined): string | null {
  if (!path) return null;
  // Stored as "data/images/<hash>.png" — pull out the hash.
  const m = /\/?images\/([a-f0-9]+)\.png$/i.exec(path);
  if (!m || !m[1]) return null;
  return `/api/img/${m[1]}`;
}

export function ChronicleImage({
  path,
  alt,
  aspect = "16 / 9",
  rounded = false,
}: {
  path: string | undefined;
  alt: string;
  aspect?: string;
  rounded?: boolean;
}) {
  const url = imageUrlFromPath(path);
  if (!url) return null;
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: aspect,
        marginBottom: 18,
        background: "var(--paper-deep)",
        overflow: "hidden",
        borderRadius: rounded ? 4 : 0,
        border: "0.5px solid var(--rule)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
    </div>
  );
}
