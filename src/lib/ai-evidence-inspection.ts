// Conservative pre-storage structure checks, NOT an antivirus scanner.
// No decompression of images, no PDF rendering and no execution of file content.
// The file is retained unchanged for its original SHA-256 provenance.
import { inspectPdfInChild, PdfProcessRejected, pdfProcessErrorMessage } from "./ai-pdf-process";
import type { EvidenceFormat } from "./ai-evidence-policy";

export class UnsafeEvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeEvidenceError";
  }
}
const MAX_PIXELS = 24_000_000;
const MAX_DIMENSION = 8192;

function dimensions(width: number, height: number) {
  if (!width || !height || width > MAX_DIMENSION || height > MAX_DIMENSION ||
      width * height > MAX_PIXELS) {
    throw new UnsafeEvidenceError("Bildabmessungen unzulässig oder zu groß.");
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  return c >>> 0;
});
function crc32(data: Buffer, from: number, to: number): number {
  let crc = 0xffffffff;
  for (let i = from; i < to; i++) crc = CRC_TABLE[(crc ^ data[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function inspectPng(data: Buffer) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (data.length < 45 || !data.subarray(0, 8).equals(sig))
    throw new UnsafeEvidenceError("PNG-Signatur ungültig.");
  let offset = 8;
  let chunks = 0;
  let haveHeader = false;
  let haveData = false;
  let done = false;
  let seenPlte = false;
  let color = -1;
  const allowed = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "sRGB", "gAMA", "pHYs", "cHRM"]);
  while (offset < data.length) {
    if (++chunks > 256 || offset + 12 > data.length)
      throw new UnsafeEvidenceError("PNG-Chunks ungültig oder zu zahlreich.");
    const len = data.readUInt32BE(offset);
    if (len > data.length - offset - 12)
      throw new UnsafeEvidenceError("PNG-Chunk-Länge ungültig.");
    const type = data.toString("ascii", offset + 4, offset + 8);
    if (!allowed.has(type))
      throw new UnsafeEvidenceError("PNG mit nicht unterstützten Metadaten oder Erweiterungen.");
    const end = offset + 12 + len;
    if (crc32(data, offset + 4, end - 4) !== data.readUInt32BE(end - 4))
      throw new UnsafeEvidenceError("PNG-Prüfsumme ungültig.");
    if (!haveHeader && (type !== "IHDR" || len !== 13))
      throw new UnsafeEvidenceError("PNG-Header fehlt.");
    if (type === "IHDR") {
      if (haveHeader || len !== 13) throw new UnsafeEvidenceError("PNG-Header doppelt oder fehlerhaft.");
      dimensions(data.readUInt32BE(offset + 8), data.readUInt32BE(offset + 12));
      const depth = data[offset + 16];
      color = data[offset + 17];
      const supportedDepths: Record<number, readonly number[]> = {
        0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16],
      };
      if (!supportedDepths[color]?.includes(depth) || data[offset + 18] !== 0 ||
          data[offset + 19] !== 0 || data[offset + 20] > 1)
        throw new UnsafeEvidenceError("PNG-Farbformat ungültig.");
      haveHeader = true;
    } else if (type === "PLTE") {
      if (haveData || seenPlte || len === 0 || len % 3 !== 0 || len > 768)
        throw new UnsafeEvidenceError("PNG-Palette ungültig.");
      seenPlte = true;
    } else if (type === "IDAT") {
      if (!haveHeader || len === 0) throw new UnsafeEvidenceError("PNG-Bilddaten fehlen.");
      haveData = true;
    } else if (type === "IEND") {
      if (len !== 0 || !haveData || (color === 3 && !seenPlte) || end !== data.length)
        throw new UnsafeEvidenceError("PNG-Ende ungültig oder Zusatzdaten angehängt.");
      done = true;
    } else if (haveData) {
      throw new UnsafeEvidenceError("PNG-Metadaten nach Bilddaten sind nicht zugelassen.");
    }
    offset = end;
    if (done) break;
  }
  if (!done) throw new UnsafeEvidenceError("PNG-Datei unvollständig.");
}

function inspectJpeg(data: Buffer) {
  if (data.length < 18 || data[0] !== 255 || data[1] !== 216 ||
      data[data.length - 2] !== 255 || data[data.length - 1] !== 217) {
    throw new UnsafeEvidenceError("JPEG-Signatur oder Dateiende ungültig.");
  }
  let offset = 2;
  let foundSof = false;
  let foundSos = false;
  let segments = 0;
  while (offset + 4 <= data.length) {
    if (++segments > 256 || data[offset++] !== 255)
      throw new UnsafeEvidenceError("JPEG-Marker ungültig.");
    while (data[offset] === 255 && offset < data.length) offset++;
    const marker = data[offset++];
    if (marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7))
      throw new UnsafeEvidenceError("JPEG-Marker außerhalb von Bilddaten.");
    if (offset + 2 > data.length) throw new UnsafeEvidenceError("JPEG-Segment unvollständig.");
    const len = data.readUInt16BE(offset);
    if (len < 2 || offset + len > data.length - 2)
      throw new UnsafeEvidenceError("JPEG-Segmentlänge ungültig.");
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      if (foundSof || len < 8) throw new UnsafeEvidenceError("JPEG-Bildkopf ungültig.");
      dimensions(data.readUInt16BE(offset + 3), data.readUInt16BE(offset + 5));
      foundSof = true;
    }
    if (marker === 0xda) {
      if (!foundSof) throw new UnsafeEvidenceError("JPEG-Scandaten ohne Bildkopf.");
      foundSos = true;
      // Bounded marker-level validation; does not decode JPEG entropy/MCUs.
      break;
    }
    offset += len;
  }
  if (!foundSof || !foundSos)
    throw new UnsafeEvidenceError("JPEG-Bildkopf oder Scandaten fehlen.");
}

async function inspectPdf(data: Buffer) {
  try {
    await inspectPdfInChild(data);
  } catch (error) {
    if (error instanceof PdfProcessRejected) {
      throw new UnsafeEvidenceError(pdfProcessErrorMessage(error.code));
    }
    throw new UnsafeEvidenceError("PDF-Prüfung nicht verfügbar.");
  }
}

/** Reject before any storage write; returning means structural-policy pass only. */
export async function inspectEvidence(
  data: Buffer, format: EvidenceFormat,
): Promise<void> {
  if (format.mime === "image/png") inspectPng(data);
  else if (format.mime === "image/jpeg") inspectJpeg(data);
  else await inspectPdf(data);
}
