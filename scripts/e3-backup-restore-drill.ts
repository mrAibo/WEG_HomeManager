/**
 * Destructive actions are limited to a UUID-named SCRATCH PostgreSQL database
 * and UUID-named temporary dump files. The source DB is never dropped/restored.
 * SYNTHETIC LOOPBACK ONLY. Never use this script against real tenants.
 *
 * Run with Next.js stopped:
 *   node --env-file=.env --import tsx scripts/e3-backup-restore-drill.ts
 *
 * This tests a quiescent coordinated DB + local file-store snapshot/restore.
 * It is NOT a production backup scheduler or an online-consistent backup method.
 */
import crypto from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { createLocalCase, submitLocalProposal, approveLocalCopy } from "../src/server/ai-case-workflow";
import { addCaseEvidence } from "../src/server/ai-evidence-workflow";
import { manifestHash } from "../src/server/ai-evidence-snapshot";
import { deleteFile } from "../src/lib/storage";

const DB_CONTAINER = "havewa-db";
const USER = "havewa";
const SOURCE_DB = "havewa";
const SYNTHETIC_TENANT = "WEG Demo – Sechs Wohnungen";
const ROOT = path.join(process.cwd(), "storage", "documents");

function requireCondition(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function sha256(data: Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}
function docker(...args: string[]): string {
  try {
    return execFileSync("docker", args, {
      encoding: "utf8", timeout: 120_000, maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    }).trim();
  } catch (error) {
    // Don't print source DB credentials or raw process environments.
    const err = error as { stderr?: Buffer | string };
    const stderr = String(err.stderr ?? "").slice(-400);
    throw new Error("Docker backup/restore command failed: " + stderr);
  }
}
async function portInUse(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const s = net.createConnection({ host: "127.0.0.1", port });
    s.once("connect", () => { s.destroy(); resolve(true); });
    s.once("error", () => { s.destroy(); resolve(false); });
    s.setTimeout(1400, () => { s.destroy(); resolve(true); });
  });
}
async function hashFiles(dir: string): Promise<Map<string, string>> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  requireCondition(entries.length <= 300, "Too many synthetic storage files");
  const result = new Map<string, string>();
  for (const entry of entries) {
    requireCondition(entry.isFile() && !entry.isSymbolicLink(),
      "Refusing storage symlink or directory inside storage/documents");
    const bytes = await fs.readFile(path.join(dir, entry.name));
    requireCondition(bytes.length <= 10 * 1024 * 1024, "Unexpected oversized synthetic storage file");
    result.set(entry.name, sha256(bytes));
  }
  return result;
}

async function main() {
  const conn = process.env.DATABASE_URL;
  requireCondition(conn, "Missing DATABASE_URL");
  const uri = new URL(conn);
  requireCondition(["127.0.0.1", "localhost"].includes(uri.hostname) &&
    uri.port === "5432" && uri.pathname === "/havewa",
    "Refusing any non-loopback or non-synthetic PostgreSQL database");
  requireCondition(!(await portInUse(3000)),
    "Stop the local Next.js server on port 3000 before a coordinated snapshot");

  const container = docker("ps", "--filter", "name=^/havewa-db$", "--format", "{{.Names}}");
  requireCondition(container === DB_CONTAINER, "Expected isolated havewa-db container only");
  requireCondition(docker("exec", DB_CONTAINER, "printenv", "POSTGRES_USER") === USER &&
    docker("exec", DB_CONTAINER, "printenv", "POSTGRES_DB") === SOURCE_DB,
    "Unexpected PostgreSQL database or owner");

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  requireCondition(tenants.length === 1 && tenants[0].name === SYNTHETIC_TENANT,
    "Refusing DB with any non-synthetic tenant");
  const users = await prisma.user.findMany({ select: { email: true } });
  requireCondition(users.length > 0 && users.every(u => u.email.endsWith(".invalid")),
    "Refusing DB containing real user email addresses");
  const manager = await prisma.user.findFirst({
    where: { tenantId: tenants[0].id, role: "ADMIN" },
    select: { id: true, role: true },
  });
  requireCondition(manager, "Synthetic admin not found");
  const actor = { id: manager.id, role: manager.role, tenantId: tenants[0].id };

  const root = await fs.lstat(ROOT).catch(() => null);
  if (root) requireCondition(root.isDirectory() && !root.isSymbolicLink(),
    "Refusing symlinked or non-directory storage root");
  else await fs.mkdir(ROOT, { recursive: true });

  const token = crypto.randomUUID().replaceAll("-", "");
  const scratchDb = "weg_restore_" + token;
  const containerDump = "/tmp/weg_backup_" + token + ".dump";
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "weg-recovery-" + token.slice(0, 8) + "-"));
  const dumpOnHost = path.join(scratch, "db.dump");
  const restoredFolder = path.join(scratch, "restored-documents");
  const copiedFolder = path.join(scratch, "saved-documents");
  const fixture = Buffer.from(await (async () => { const pdf = await PDFDocument.create(); pdf.addPage([300, 300]); return pdf.save(); })());
  let createdId: string | undefined;
  let evidenceKey: string | undefined;
  let restoredDb: PrismaClient | undefined;
  let dbCreated = false;
  try {
    // Write a fixture through real application workflows, then stop all fixture writes.
    const created = await createLocalCase(actor, {
      kind: "DOCUMENT",
      summary: "Synthetischer kombinierter Sicherungs- und Wiederherstellungstest",
      sourceText: "Wiederherstellungstest ohne echte Kontaktdaten oder Kundendokumente.",
      title: "Wiederherstellung prüfen",
      body: "Nur interner Probelauf; keine E-Mail, Bestellung oder Zahlung.",
    });
    createdId = created.caseId;
    const evidence = await addCaseEvidence(actor, created.caseId, "backup-fixture.pdf", fixture);
    const originalRow = await prisma.aiEvidence.findFirstOrThrow({
      where: { tenantId: actor.tenantId, caseId: created.caseId, id: evidence.id },
    });
    evidenceKey = originalRow.storageKey;
    await submitLocalProposal(actor, created.proposalId, 1);
    await approveLocalCopy(actor, created.proposalId, 1);

    // Quiescent window: Next.js must be stopped and no other writers allowed.
    const sourceFiles = await hashFiles(ROOT);
    requireCondition(sourceFiles.size >= 1, "Expected synthetic Evidence file");
    await fs.mkdir(copiedFolder, { recursive: true });
    for (const name of sourceFiles.keys()) {
      await fs.copyFile(path.join(ROOT, name), path.join(copiedFolder, name));
    }
    docker("exec", DB_CONTAINER, "pg_dump", "-U", USER, "-d", SOURCE_DB,
      "--format=custom", "--file=" + containerDump);
    docker("cp", DB_CONTAINER + ":" + containerDump, dumpOnHost);
    const dumpStat = await fs.stat(dumpOnHost);
    requireCondition(dumpStat.size > 1000, "Database dump too small or absent");
    const sourceFilesAfter = await hashFiles(ROOT);
    requireCondition(JSON.stringify([...sourceFiles]) === JSON.stringify([...sourceFilesAfter]),
      "Storage changed during backup: snapshot discarded");

    // Restore into a *new* scratch DB and disconnected scratch folder only.
    await fs.mkdir(restoredFolder, { recursive: true });
    for (const name of sourceFiles.keys()) {
      await fs.copyFile(path.join(copiedFolder, name), path.join(restoredFolder, name));
    }
    docker("exec", DB_CONTAINER, "createdb", "-U", USER, "--template=template0", scratchDb);
    dbCreated = true;
    docker("exec", DB_CONTAINER, "pg_restore", "-U", USER, "-d", scratchDb,
      "--no-owner", "--no-privileges", containerDump);
    const restoredUrl = new URL(conn);
    restoredUrl.pathname = "/" + scratchDb;
    restoredDb = new PrismaClient({ datasources: { db: { url: restoredUrl.toString() } } });
    const restoredTenants = await restoredDb.tenant.findMany({ select: { id: true, name: true } });
    requireCondition(restoredTenants.length === 1 && restoredTenants[0].id === actor.tenantId,
      "Restored database tenant identity mismatch");
    const [caseRow, restoredEvidence, restoredProposal, restoredApproval] = await Promise.all([
      restoredDb.aiCase.findFirst({ where: { tenantId: actor.tenantId, id: created.caseId } }),
      restoredDb.aiEvidence.findMany({ where: { tenantId: actor.tenantId, caseId: created.caseId },
        select: { id: true, name: true, mime: true, size: true, sha256: true, storageKey: true } }),
      restoredDb.aiProposal.findFirst({ where: { tenantId: actor.tenantId, id: created.proposalId } }),
      restoredDb.aiApproval.findFirst({ where: { tenantId: actor.tenantId, proposalId: created.proposalId } }),
    ]);
    requireCondition(caseRow && restoredEvidence.length === 1 && restoredProposal && restoredApproval,
      "Restored Case, Evidence, proposal or human approval missing");
    const savedManifest = manifestHash(restoredEvidence);
    requireCondition(restoredProposal.evidenceSha256 === savedManifest &&
      restoredApproval.evidenceSha256 === savedManifest && restoredApproval.scope === "COPY_ONLY",
      "Restored immutable human approval and Evidence manifest mismatch");
    const restoredFiles = await hashFiles(restoredFolder);
    requireCondition(restoredFiles.size === sourceFiles.size, "Restored file count mismatch");
    for (const [fileName, digest] of sourceFiles) {
      requireCondition(restoredFiles.get(fileName) === digest,
        "File restore checksum mismatch: " + fileName);
    }
    for (const item of restoredEvidence) {
      requireCondition(restoredFiles.get(item.storageKey) === item.sha256,
        "Restored DB Evidence/file crosscheck failed");
      const actual = await fs.readFile(path.join(restoredFolder, item.storageKey));
      requireCondition(actual.length === item.size && sha256(actual) === item.sha256,
        "Restored Evidence byte length or hash mismatch");
    }
    console.log("E3_COORDINATED_RESTORE_PASS: isolated database, stored files, Case, human approval, SHA256 manifest");
    console.log("Verified scratch restore only; no live DB or storage overwritten.");
  } finally {
    await restoredDb?.$disconnect();
    if (dbCreated) {
      try {
        docker("exec", DB_CONTAINER, "dropdb", "-U", USER, "--if-exists", scratchDb);
      } catch { console.error("WARNING: scratch DB cleanup requires manual review"); }
    }
    try { docker("exec", DB_CONTAINER, "rm", "-f", containerDump); }
    catch { console.error("WARNING: scratch container dump cleanup needs review"); }
    try { await fs.rm(scratch, { recursive: true, force: true }); }
    catch { console.error("WARNING: private temporary files require manual removal"); }
    if (createdId) {
      const scopedId = createdId;
      try {
        await prisma.$transaction(async tx => {
          const proposals = await tx.aiProposal.findMany({
            where: { tenantId: actor.tenantId, caseId: scopedId }, select: { id: true },
          });
          await tx.aiApproval.deleteMany({ where: {
            tenantId: actor.tenantId, proposalId: { in: proposals.map(p => p.id) },
          } });
          await tx.aiEvidence.deleteMany({ where: { tenantId: actor.tenantId, caseId: scopedId } });
          await tx.aiCaseEvent.deleteMany({ where: { tenantId: actor.tenantId, caseId: scopedId } });
          await tx.aiProposal.deleteMany({ where: { tenantId: actor.tenantId, caseId: scopedId } });
          await tx.aiCase.deleteMany({ where: { tenantId: actor.tenantId, id: scopedId } });
        });
        if (evidenceKey) await deleteFile(evidenceKey);
      } catch {
        console.error("WARNING: synthetic fixture cleanup requires manual review");
      }
    }
    await prisma.$disconnect();
  }
}
main().catch(error => {
  console.error("E3_COORDINATED_RESTORE_FAIL:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
