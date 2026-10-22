// Synthetic single-PC worker packaging proof; no DB, secrets, network or host changes.
// Build a minimal TEMPORARY worker + recursive pdf-lib runtime dependency bundle,
// then run actual Node --permission PDF checks from that isolated temp directory.
import { mkdtemp, cp, mkdir, readFile, rm, rename, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceWorker = path.join(root, "src", "server", "workers", "pdf-inspect-worker.mjs");
const sourceNodeModules = path.join(root, "node_modules");
const rootRequire = createRequire(path.join(root, "package.json"));
const MAX_PACKAGE_COUNT = 32;

function assert(value, message) {
  if (!value) throw Error(message);
}
const copied = new Set();
async function copyRuntimePackage(name, stage, resolveFrom = rootRequire) {
  assert(/^(?:@[-a-z0-9_]+\/)?[-a-z0-9_.]+$/i.test(name), "Invalid dependency package name");
  if (copied.has(name)) return;
  assert(copied.size < MAX_PACKAGE_COUNT, "Unexpected PDF dependency count");
  let pkgPath;
  try {
    pkgPath = resolveFrom.resolve(name + "/package.json");
  } catch {
    // Dependencies such as tslib deliberately hide package.json via "exports".
    let dir = path.dirname(resolveFrom.resolve(name));
    for (;;) {
      const candidate = path.join(dir, "package.json");
      try {
        const metadata = JSON.parse(await readFile(candidate, "utf8"));
        if (metadata.name === name) { pkgPath = candidate; break; }
      } catch { /* ascend until the actual package root */ }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  assert(pkgPath, "Cannot identify dependency package root: " + name);
  const packageJson = JSON.parse(await readFile(pkgPath, "utf8"));
  copied.add(name);
  const dest = path.join(stage, "node_modules", ...name.split("/"));
  await mkdir(path.dirname(dest), { recursive: true });
  await cp(path.dirname(pkgPath), dest, { recursive: true });
  const pkgRequire = createRequire(pkgPath);
  for (const child of Object.keys(packageJson.dependencies ?? {})) {
    await copyRuntimePackage(child, stage, pkgRequire);
  }
}

function checkProcess(worker, stage, bytes) {
  const res = spawnSync(process.execPath, [
    "--permission",
    `--allow-fs-read=${worker}`,
    `--allow-fs-read=${path.join(stage, "node_modules")}`,
    "--max-old-space-size=128",
    worker,
  ], {
    input: bytes,
    cwd: stage,
    env: { NODE_ENV: "production" },
    timeout: 8000,
    maxBuffer: 1024,
    encoding: "utf8",
    windowsHide: true,
  });
  let verdict = null;
  try { verdict = JSON.parse(res.stdout); } catch { /* must fail closed */ }
  return { code: res.status, verdict, error: res.error?.code ?? null };
}

async function main() {
  assert(Number(process.versions.node.split(".")[0]) >= 24, "Node 24+ required");
  await access(sourceWorker);
  await access(sourceNodeModules);
  const stage = await mkdtemp(path.join(os.tmpdir(), "weg-pdf-bundle-"));
  const worker = path.join(stage, "src", "server", "workers", "pdf-inspect-worker.mjs");
  try {
    await mkdir(path.dirname(worker), { recursive: true });
    await cp(sourceWorker, worker);
    await copyRuntimePackage("pdf-lib", stage);
    const doc = await PDFDocument.create();
    doc.addPage([300, 300]);
    const original = Buffer.from(await doc.save());
    const checksum = crypto.createHash("sha256").update(original).digest("hex");
    const good = checkProcess(worker, stage, original);
    assert(good.code === 0 && good.verdict?.ok === true && good.verdict.code === "OK",
      "Bundled PDF worker failed to accept valid synthetic PDF");
    const bad = checkProcess(worker, stage, Buffer.from("%PDF-1.4\ninvalid\n%%EOF\n"));
    assert(bad.verdict?.ok === false || bad.code !== 0,
      "Bundled PDF worker accepted malformed PDF");
    const pdfFolder = path.join(stage, "node_modules", "pdf-lib");
    const missingFolder = path.join(stage, "node_modules", "pdf-lib.NOT_INSTALLED");
    await rename(pdfFolder, missingFolder);
    const withoutPackage = checkProcess(worker, stage, original);
    assert(withoutPackage.code !== 0 || withoutPackage.verdict?.ok !== true,
      "Worker did not fail closed when runtime pdf-lib package was missing");
    console.log("E6_WORKER_BUNDLE_PASS: staged worker, recursive deps, valid/invalid PDF, missing module fail-closed");
    console.log("Verified synthetic SHA256 " + checksum.slice(0, 12) +
      " and " + copied.size + " runtime packages; temporary bundle removed.");
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
main().catch(error => {
  console.error("E6_WORKER_BUNDLE_FAIL:", error instanceof Error ? error.message : "unknown");
  process.exitCode = 1;
});
