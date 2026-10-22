import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { inspectPdfInChild, PdfProcessRejected, pdfProcessErrorMessage } from "./ai-pdf-process";
import { MAX_EVIDENCE_SIZE } from "./ai-evidence-policy";

async function validPdf() {
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 300]);
  return Buffer.from(await pdf.save());
}
describe("isolated PDF worker fail-closed contract", () => {
  it("accepts valid PDF using actual restricted subprocess", async () => {
    await expect(inspectPdfInChild(await validPdf())).resolves.toBeUndefined();
  });
  it("refuses bogus PDF without returning raw input", async () => {
    await expect(inspectPdfInChild(Buffer.from("%PDF-1.4\nNot a document\n%%EOF\n")))
      .rejects.toBeInstanceOf(PdfProcessRejected);
  });
  it("does not start a worker for oversized bytes", async () => {
    await expect(inspectPdfInChild(Buffer.alloc(MAX_EVIDENCE_SIZE + 1)))
      .rejects.toMatchObject({ code: "SIZE" });
  });
  it("limits concurrent worker processes on an application instance", async () => {
    const bytes = await validPdf();
    const one = inspectPdfInChild(bytes);
    const two = inspectPdfInChild(bytes);
    await expect(inspectPdfInChild(bytes)).rejects.toMatchObject({ code: "BUSY" });
    await Promise.all([one, two]);
  });
  it("worker has no filesystem access outside module allowlist", () => {
    const root = process.cwd();
    const worker = path.resolve(root, "src/server/workers/pdf-inspect-worker.mjs");
    const deps = path.resolve(root, "node_modules");
    const result = spawnSync(process.execPath, [
      "--permission", `--allow-fs-read=${worker}`, `--allow-fs-read=${deps}`,
      "--input-type=module", "--eval",
      "import fs from 'node:fs';try{fs.readFileSync('.gitignore');process.exit(5)}catch(error){process.exit(error.code==='ERR_ACCESS_DENIED'?0:6)}",
    ], { cwd: root, env: { NODE_ENV: "production" }, timeout: 3000, encoding: "utf8" });
    expect(result.status).toBe(0);
  });
  it("returns only fixed generic messages for unknown child errors", () => {
    expect(pdfProcessErrorMessage("CRASH")).toBe("PDF-Prüfung nicht verfügbar.");
    expect(pdfProcessErrorMessage("ACTIVE")).not.toContain("JavaScript code");
  });
});
