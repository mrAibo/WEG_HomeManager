// Separate process, PDF structural inspection ONLY. No DB, no filesystem,
// no network calls, no log of bytes. Node --permission must be enabled by host.
// Do not execute embedded PDF content or render documents.
import { PDFDocument } from "pdf-lib";

const MAX_BYTES = 10 * 1024 * 1024;
const ACTIVE_PDF = /\/(?:JavaScript|JS|OpenAction|AA|Launch|EmbeddedFiles?|RichMedia|XFA|AcroForm|GoToR|SubmitForm|ImportData|Rendition|Collection|Filespec)(?![A-Za-z0-9_])/i;
const verdict = (ok, code) => {
  process.stdout.write(JSON.stringify({ ok, code }));
};

async function examine(data) {
  if (data.length < 20 || data.length > MAX_BYTES ||
      !/^%PDF-1\.[0-7](?:\r|\n|\s)/.test(data.toString("latin1", 0, 12))) {
    return "FORMAT";
  }
  if (!/%%EOF\s*$/.test(data.toString("latin1", Math.max(0, data.length - 2048))))
    return "FORMAT";
  if (ACTIVE_PDF.test(data.toString("latin1"))) return "ACTIVE";
  let pdf;
  try {
    pdf = await PDFDocument.load(data, {
      ignoreEncryption: false, throwOnInvalidObject: true, updateMetadata: false,
    });
  } catch {
    return "STRUCTURE";
  }
  if (pdf.getPageCount() < 1 || pdf.getPageCount() > 120) return "PAGES";
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    if (!(width > 0 && height > 0 && width <= 15000 && height <= 15000))
      return "DIMENSIONS";
  }
  for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
    if (ACTIVE_PDF.test(obj.toString())) return "ACTIVE";
  }
  return "OK";
}

let bytes = 0;
const chunks = [];
let tooLarge = false;
process.stdin.on("data", chunk => {
  bytes += chunk.length;
  if (bytes > MAX_BYTES) {
    tooLarge = true;
    chunks.length = 0;
  } else if (!tooLarge) {
    chunks.push(chunk);
  }
});
process.stdin.on("end", async () => {
  if (tooLarge) return verdict(false, "SIZE");
  try {
    const code = await examine(Buffer.concat(chunks, bytes));
    verdict(code === "OK", code);
  } catch {
    verdict(false, "STRUCTURE");
  }
});
process.stdin.on("error", () => verdict(false, "INPUT"));
