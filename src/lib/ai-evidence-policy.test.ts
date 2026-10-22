import { describe, expect, it } from "vitest";
import { evidenceHash, identifyEvidence, safeEvidenceName, MAX_EVIDENCE_SIZE } from "./ai-evidence-policy";

const tinyPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
const tinyJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 0xff, 0xd9]);
const tinyPng = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  Buffer.alloc(25),
  Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]),
]);

describe("E3 Evidence restrictive signature policy", () => {
  it("identifies PDF from bytes (not file MIME/extension)", () =>
    expect(identifyEvidence(tinyPdf)).toEqual({ mime: "application/pdf", ext: ".pdf" }));
  it("identifies JPEG by magic and EOI", () =>
    expect(identifyEvidence(tinyJpeg)?.mime).toBe("image/jpeg"));
  it("identifies PNG by signature and IEND", () =>
    expect(identifyEvidence(tinyPng)?.mime).toBe("image/png"));
  it("rejects empty bytes", () => expect(identifyEvidence(Buffer.alloc(0))).toBeNull());
  it("rejects oversize content", () =>
    expect(identifyEvidence(Buffer.alloc(MAX_EVIDENCE_SIZE + 1))).toBeNull());
  it("rejects browser MIME claims with script bytes", () =>
    expect(identifyEvidence(Buffer.from("<script>alert(1)</script>"))).toBeNull());
  it("rejects PDF missing trailer", () =>
    expect(identifyEvidence(Buffer.from("%PDF-1.7\nnot complete"))).toBeNull());
  it("rejects truncated JPEG", () =>
    expect(identifyEvidence(tinyJpeg.subarray(0, 5))).toBeNull());
  it("normalizes unsafe names and chooses trusted extension", () =>
    expect(safeEvidenceName('../A"\\B?.exe', ".pdf")).toBe(".._A__B_.exe.pdf"));
  it("binds SHA-256 to exact bytes", () => {
    expect(evidenceHash(tinyPdf)).toHaveLength(64);
    expect(evidenceHash(tinyPdf)).not.toBe(evidenceHash(Buffer.concat([tinyPdf, Buffer.from("x")])));
  });
});
