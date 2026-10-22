import { spawn } from "node:child_process";
import path from "node:path";
import { MAX_EVIDENCE_SIZE } from "./ai-evidence-policy";

// Application-local bounded child process. This is NOT an OS-level sandbox:
// network controls and process account permissions must be applied at deployment.
const WORKER = path.resolve(process.cwd(), "src/server/workers/pdf-inspect-worker.mjs");
const DEPS = path.resolve(process.cwd(), "node_modules");
const TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 1024;
const MAX_ACTIVE_PDF_INSPECTORS = 2;

let active = 0;
export class PdfProcessRejected extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "PdfProcessRejected";
  }
}
const workerErrors: Record<string, string> = {
  SIZE: "Datei zu groß.",
  FORMAT: "PDF-Format ungültig.",
  ACTIVE: "PDF enthält aktive Inhalte oder eingebettete Dateien.",
  STRUCTURE: "PDF-Struktur nicht lesbar oder verschlüsselt.",
  PAGES: "PDF-Seitenzahl ungültig.",
  DIMENSIONS: "PDF-Seitengröße ungültig.",
  INPUT: "PDF-Eingabe nicht lesbar.",
};
export function pdfProcessErrorMessage(code: string): string {
  return workerErrors[code] ?? "PDF-Prüfung nicht verfügbar.";
}

export async function inspectPdfInChild(data: Buffer): Promise<void> {
  if (data.length === 0 || data.length > MAX_EVIDENCE_SIZE) throw new PdfProcessRejected("SIZE");
  // Never silently fall back to an in-process parser if isolated execution
  // permissions are unavailable on a host.
  if (Number(process.versions.node.split(".")[0]) < 24) {
    throw new PdfProcessRejected("RUNTIME");
  }
  if (active >= MAX_ACTIVE_PDF_INSPECTORS) throw new PdfProcessRejected("BUSY");
  active++;
  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let expired = false;
      let output = "";
      const child = spawn(process.execPath, [
        "--permission",
        `--allow-fs-read=${WORKER}`,
        `--allow-fs-read=${DEPS}`,
        "--max-old-space-size=128",
        WORKER,
      ], {
        cwd: process.cwd(),
        // Prevent inherited DATABASE_URL, AUTH_SECRET, API keys and ambient secrets.
        env: { NODE_ENV: "production" },
        stdio: ["pipe", "pipe", "ignore"],
        windowsHide: true,
      });
      const fail = (code: string) => {
        if (!settled) { settled = true; reject(new PdfProcessRejected(code)); }
      };
      const timer = setTimeout(() => {
        expired = true;
        // Keep the concurrency slot until the worker has actually exited.
        if (!child.kill("SIGKILL")) fail("TIMEOUT");
      }, TIMEOUT_MS);
      child.stdout?.on("data", (chunk: Buffer) => {
        output += chunk.toString("utf8");
        if (Buffer.byteLength(output) > MAX_RESPONSE_BYTES) {
          child.kill();
          fail("PROTOCOL");
        }
      });
      child.stdin?.on("error", () => { /* EPIPE after crash: close handler rejects */ });
      child.on("error", () => { clearTimeout(timer); fail("START"); });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (settled) return;
        if (expired || code !== 0) return fail(expired ? "TIMEOUT" : "CRASH");
        let result: { ok?: unknown; code?: unknown };
        try { result = JSON.parse(output); }
        catch { return fail("PROTOCOL"); }
        if (result.ok === true && result.code === "OK") {
          settled = true;
          resolve();
        } else if (result.ok === false && typeof result.code === "string" &&
                   Object.hasOwn(workerErrors, result.code)) {
          fail(result.code);
        } else {
          fail("PROTOCOL");
        }
      });
      try { child.stdin?.end(data); } catch { child.kill(); fail("INPUT"); }
    });
  } finally {
    active--;
  }
}
