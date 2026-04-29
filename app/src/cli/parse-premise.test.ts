import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePremiseArgs } from "./parse-premise.js";

// Stubbed file-system: in-memory map of paths → contents. Anything not in
// the map is treated as nonexistent.
function fakeFs(files: Record<string, string>) {
  return {
    isFile: (p: string) => Object.prototype.hasOwnProperty.call(files, p),
    readFile: (p: string) => {
      if (!Object.prototype.hasOwnProperty.call(files, p)) {
        throw new Error(`fakeFs: ${p} not found`);
      }
      return files[p]!;
    },
  };
}

describe("parsePremiseArgs", () => {
  it("returns empty when no args", () => {
    const r = parsePremiseArgs([], fakeFs({}));
    assert.equal(r.kind, "empty");
    if (r.kind === "empty") assert.equal(r.fresh, false);
  });

  it("treats a single literal arg as the premise", () => {
    const r = parsePremiseArgs(["A literal premise."], fakeFs({}));
    assert.equal(r.kind, "ok");
    if (r.kind === "ok") assert.equal(r.premise, "A literal premise.");
  });

  it("recognises --fresh anywhere in argv", () => {
    const r = parsePremiseArgs(["--fresh", "A premise"], fakeFs({}));
    assert.equal(r.kind, "ok");
    if (r.kind === "ok") {
      assert.equal(r.premise, "A premise");
      assert.equal(r.fresh, true);
    }
  });

  it("reads the file passed to -f", () => {
    const r = parsePremiseArgs(
      ["-f", "premise.txt"],
      fakeFs({ "premise.txt": "  contents from file  \n" }),
    );
    assert.equal(r.kind, "ok");
    if (r.kind === "ok") assert.equal(r.premise, "contents from file");
  });

  it("reads the file passed to --file", () => {
    const r = parsePremiseArgs(
      ["--file", "premise.txt"],
      fakeFs({ "premise.txt": "alpha" }),
    );
    assert.equal(r.kind, "ok");
    if (r.kind === "ok") assert.equal(r.premise, "alpha");
  });

  it("uses --premise as a literal when given", () => {
    const r = parsePremiseArgs(["--premise", "boxed text"], fakeFs({}));
    assert.equal(r.kind, "ok");
    if (r.kind === "ok") assert.equal(r.premise, "boxed text");
  });

  it("auto-detects a bare positional that exists as a file", () => {
    const r = parsePremiseArgs(
      ["premise.txt"],
      fakeFs({ "premise.txt": "from disk" }),
    );
    assert.equal(r.kind, "ok");
    if (r.kind === "ok") assert.equal(r.premise, "from disk");
  });

  it("treats a positional that does not exist as literal text", () => {
    const r = parsePremiseArgs(["not a real path"], fakeFs({}));
    assert.equal(r.kind, "ok");
    if (r.kind === "ok") assert.equal(r.premise, "not a real path");
  });

  it("returns error when -f points at a missing file", () => {
    const r = parsePremiseArgs(["-f", "missing.txt"], fakeFs({}));
    assert.equal(r.kind, "error");
    if (r.kind === "error") assert.match(r.message, /file not found/);
  });

  it("does not consume the value of -f as a positional premise", () => {
    // 'literal' should not be inferred as premise alongside the -f file.
    const r = parsePremiseArgs(
      ["-f", "premise.txt"],
      fakeFs({ "premise.txt": "from file" }),
    );
    assert.equal(r.kind, "ok");
    if (r.kind === "ok") assert.equal(r.premise, "from file");
  });

  it("rejects ambiguous positional input (more than one bare arg)", () => {
    const r = parsePremiseArgs(["one", "two"], fakeFs({}));
    assert.equal(r.kind, "error");
    if (r.kind === "error") assert.match(r.message, /single premise/);
  });

  it("--fresh combined with -f still resolves the file", () => {
    const r = parsePremiseArgs(
      ["--fresh", "-f", "premise.txt"],
      fakeFs({ "premise.txt": "A" }),
    );
    assert.equal(r.kind, "ok");
    if (r.kind === "ok") {
      assert.equal(r.premise, "A");
      assert.equal(r.fresh, true);
    }
  });
});
