import { describe, expect, it } from "vitest";
import { navGroups } from "./nav";
import { hintForPath, moduleHints } from "./module-help";

describe("guide for every visible navigation module", () => {
  it("provides help and a concrete first step for each section", () => {
    const missing=navGroups.flatMap(g=>g.items)
      .filter(item=>!moduleHints[item.href] ||
        !moduleHints[item.href].why.trim() || !moduleHints[item.href].firstStep.trim());
    expect(missing.map(item=>item.href)).toEqual([]);
  });
  it("recognizes route subpages and language prefixes", () => {
    expect(hintForPath("/de/meetings/123")?.title).toBe("Eigentümerversammlungen");
    expect(hintForPath("/cases/abc")?.title).toBe("Gespeicherte Vorgänge");
  });
});
