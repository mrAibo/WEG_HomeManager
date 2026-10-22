import { describe, expect, it } from "vitest";
import { manifestHash } from "./ai-evidence-snapshot";

const one = { id: "abc", name: "photo.jpg", mime: "image/jpeg",
  size: 1234, sha256: "a".repeat(64) };
const two = { id: "def", name: "letter.pdf", mime: "application/pdf",
  size: 321, sha256: "b".repeat(64) };

describe("E3 reviewed Evidence manifest hashing", () => {
  it("is independent of input listing order", () => {
    expect(manifestHash([one, two])).toBe(manifestHash([two, one]));
  });
  it("uses a deterministic empty Evidence manifest", () => {
    expect(manifestHash([])).toHaveLength(64);
    expect(manifestHash([])).toBe(manifestHash([]));
  });
  it("changes when an attachment is added or removed", () => {
    expect(manifestHash([one])).not.toBe(manifestHash([one, two]));
    expect(manifestHash([one, two])).not.toBe(manifestHash([]));
  });
  it("binds the exact original file digest", () => {
    expect(manifestHash([one])).not.toBe(manifestHash([{ ...one, sha256: "c".repeat(64) }]));
  });
  it("binds the file identity, name, type and size", () => {
    for (const changed of [
      { ...one, id: "other" }, { ...one, name: "other.jpg" },
      { ...one, mime: "image/png" }, { ...one, size: 1235 },
    ]) {
      expect(manifestHash([one])).not.toBe(manifestHash([changed]));
    }
  });
});
