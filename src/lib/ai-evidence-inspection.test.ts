import { describe, expect, it } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import { deflateSync } from "node:zlib";
import { inspectEvidence, UnsafeEvidenceError } from "./ai-evidence-inspection";
import type { EvidenceFormat } from "./ai-evidence-policy";

const pdfFmt: EvidenceFormat = { mime: "application/pdf", ext: ".pdf" };
const pngFmt: EvidenceFormat = { mime: "image/png", ext: ".png" };
const jpegFmt: EvidenceFormat = { mime: "image/jpeg", ext: ".jpg" };

async function validPdf() {
  const doc = await PDFDocument.create();
  doc.addPage([300, 300]);
  return Buffer.from(await doc.save());
}
function crc(buf: Buffer) {
  let c = 0xffffffff;
  for (const n of buf) {
    c ^= n;
    for (let bit = 0; bit < 8; bit++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(name: string, bytes: Buffer) {
  const body = Buffer.concat([Buffer.from(name), bytes]);
  const length = Buffer.alloc(4); length.writeUInt32BE(bytes.length);
  const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
  return Buffer.concat([length, body, sum]);
}
function tinyPng(width = 1, height = 1) {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head[8] = 8; head[9] = 2; // 8-bit RGB, no interlace
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", head), chunk("IDAT", deflateSync(Buffer.from([0, 255, 0, 0]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
// Marker-valid minimal JPEG for structural gate tests; not a decoded-image test.
const tinyJpeg = Buffer.from([
  0xff, 0xd8,
  0xff, 0xe0, 0, 4, 0, 0,
  0xff, 0xc0, 0, 11, 8, 0, 1, 0, 1, 1, 1, 0x11, 0,
  0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0,
  0, 0xff, 0xd9,
]);

describe("E3 pre-storage structural evidence gate", () => {
  it("accepts a real, ordinary one-page PDF produced by existing pdf-lib", async () =>
    expect(inspectEvidence(await validPdf(), pdfFmt)).resolves.toBeUndefined());

  it("rejects fake PDF with only header and EOF", async () =>
    expect(inspectEvidence(Buffer.from("%PDF-1.4\n1 0 obj\n%%EOF\n"), pdfFmt))
      .rejects.toBeInstanceOf(UnsafeEvidenceError));

  it("rejects active PDF JavaScript controls and attachments before disk write", async () => {
    const pdf = await validPdf();
    for (const action of ["/OpenAction", "/JavaScript", "/AA", "/Launch", "/EmbeddedFile", "/XFA"]) {
      await expect(inspectEvidence(Buffer.concat([pdf, Buffer.from(action)]), pdfFmt))
        .rejects.toBeInstanceOf(UnsafeEvidenceError);
    }
  });
  it("rejects real PDF catalog action objects even when syntactically valid", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 300]);
    doc.catalog.set(PDFName.of("OpenAction"), PDFName.of("JavaScript"));
    await expect(inspectEvidence(Buffer.from(await doc.save()), pdfFmt))
      .rejects.toBeInstanceOf(UnsafeEvidenceError);
  });
  it("rejects oversized PDF page dimensions", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([20000, 50]);
    await expect(inspectEvidence(Buffer.from(await doc.save()), pdfFmt))
      .rejects.toBeInstanceOf(UnsafeEvidenceError);
  });
  it("accepts CRC-valid PNG with bounded dimensions", async () =>
    expect(inspectEvidence(tinyPng(), pngFmt)).resolves.toBeUndefined());
  it("rejects PNG with corrupt CRC", async () => {
    const png = tinyPng(); png[32] ^= 1;
    await expect(inspectEvidence(png, pngFmt)).rejects.toBeInstanceOf(UnsafeEvidenceError);
  });
  it("rejects a PNG decompression-bomb dimension claim without decoding it", async () =>
    expect(inspectEvidence(tinyPng(8192, 8192), pngFmt))
      .rejects.toBeInstanceOf(UnsafeEvidenceError));
  it("rejects PNG text metadata and trailing data", async () => {
    const png = tinyPng();
    const beforeIend = png.subarray(0, png.length - 12);
    const text = chunk("iTXt", Buffer.from("injected prompt"));
    await expect(inspectEvidence(Buffer.concat([beforeIend, text, png.subarray(png.length - 12)]), pngFmt))
      .rejects.toBeInstanceOf(UnsafeEvidenceError);
    await expect(inspectEvidence(Buffer.concat([png, Buffer.from("trailing")]), pngFmt))
      .rejects.toBeInstanceOf(UnsafeEvidenceError);
  });
  it("accepts marker-valid JPEG and rejects missing SOF", async () => {
    await expect(inspectEvidence(tinyJpeg, jpegFmt)).resolves.toBeUndefined();
    await expect(inspectEvidence(Buffer.from([0xff, 0xd8, 0xff, 0xda, 0, 2, 0xff, 0xd9]), jpegFmt))
      .rejects.toBeInstanceOf(UnsafeEvidenceError);
  });
  it("rejects JPEG absurd dimensions", async () => {
    const data = Buffer.from(tinyJpeg);
    data[13] = 0x20; data[14] = 0x00;
    data[15] = 0x20; data[16] = 0x00;
    await expect(inspectEvidence(data, jpegFmt)).rejects.toBeInstanceOf(UnsafeEvidenceError);
  });
});
