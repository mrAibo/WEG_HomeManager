// Browser/DB/Storage smoke on synthetic localhost only. No secrets or sample files in Git.
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const base = "http://127.0.0.1:3000";
const email = process.env.WEG_SMOKE_EMAIL;
const password = process.env.WEG_SMOKE_PASSWORD;
const raw = process.env.DATABASE_URL;
if (!email?.endsWith(".invalid") || !password || !raw) {
  throw new Error("Provide synthetic WEG_SMOKE_EMAIL (.invalid), WEG_SMOKE_PASSWORD and DATABASE_URL");
}
const database = new URL(raw);
if (!["127.0.0.1", "localhost"].includes(database.hostname) ||
    database.port !== "5432" || database.pathname !== "/havewa") {
  throw new Error("Refusing nonlocal database");
}

const buffer = Buffer.from(await (async () => { const pdf = await PDFDocument.create(); pdf.addPage([300, 300]); return pdf.save(); })());
const digest = crypto.createHash("sha256").update(buffer).digest("hex");
const prisma = new PrismaClient();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(25000);
let caseId = null, tenantId = null;
try {
  const user = await prisma.user.findUnique({
    where: { email }, select: { tenantId: true },
  });
  if (!user) throw new Error("Synthetic user not found");
  tenantId = user.tenantId;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }, select: { name: true },
  });
  if (tenant?.name !== "WEG Demo – Sechs Wohnungen") throw new Error("Not a synthetic tenant");
  await page.goto(base + "/de/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(url => !url.pathname.endsWith("/login"));
  await page.goto(base + "/de/dashboard");
  await page.locator("#weg-case-description").fill("Synthetischer Test: Ein PDF als Beweismittel sicher hinterlegen.");
  await page.getByLabel("Dokument für das Anliegen auswählen").setInputFiles({
    name: "Synthetisch.pdf", mimeType: "application/pdf", buffer,
  });
  await page.getByRole("button", { name: "Entwurf vorbereiten" }).click();
  await page.locator("section[aria-label='Entwurf überprüfen'] input[type=checkbox]").check();
  await page.getByRole("button", { name: "Vorgang speichern" }).click();
  const link = page.getByRole("link", { name: "Gespeicherten Vorgang öffnen" });
  await link.waitFor();
  const uploadStatus = await page.getByRole("status").last().innerText();
  if (!uploadStatus.includes("mit Entwurf und Beweismittel gespeichert")) {
    throw new Error("Dashboard did not finish Evidence upload: " + uploadStatus);
  }
  const href = await link.getAttribute("href");
  caseId = href?.split("/").pop();
  if (!caseId) throw new Error("Missing saved Case link");
  await link.click();
  await page.getByRole("heading", { name: "Beweismittel (1)" }).waitFor();
  const evidence = await prisma.aiEvidence.findFirst({
    where: { tenantId, caseId, sha256: digest },
  });
  if (!evidence || evidence.size !== buffer.length || evidence.mime !== "application/pdf") {
    throw new Error("Evidence row missing or invalid");
  }
  const download = await page.request.get(
    base + "/api/cases/" + caseId + "/evidence/" + evidence.id,
  );
  if (download.status() !== 200 || !(await download.body()).equals(buffer)) {
    throw new Error("Browser authorized download mismatch");
  }
  const secondFile = Buffer.from(await (async () => { const pdf = await PDFDocument.create(); pdf.addPage([600, 600]); return pdf.save(); })());
  await page.getByLabel("Beweismittel auswählen").setInputFiles({
    name: "Zweite-Anlage.pdf", mimeType: "application/pdf", buffer: secondFile,
  });
  await page.getByRole("button", { name: "Datei hinzufügen" }).click();
  await page.getByRole("heading", { name: "Beweismittel (2)" }).waitFor();
  const secondHash = crypto.createHash("sha256").update(secondFile).digest("hex");
  const secondEvidence = await prisma.aiEvidence.findFirst({
    where: { tenantId, caseId, sha256: secondHash },
  });
  if (!secondEvidence) throw new Error("Detail page upload failed");
  const unauthenticated = await browser.newContext();
  const noAccess = await unauthenticated.request.get(
    base + "/api/cases/" + caseId + "/evidence/" + evidence.id,
  );
  await unauthenticated.close();
  if (noAccess.status() !== 401) throw new Error("Unauthenticated download allowed");
  await page.getByRole("button", { name: "Zur Prüfung einreichen" }).click();
  await page.getByText("Zur Prüfung eingereicht", { exact: false }).first().waitFor();
  if (await page.getByRole("button", { name: "Datei hinzufügen" }).count()) {
    throw new Error("Evidence upload should be hidden after submission");
  }
  await page.setViewportSize({ width: 360, height: 800 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) throw new Error("Evidence page overflows mobile width");
  console.log("E3_EVIDENCE_BROWSER_PASS: authenticated upload, hash, download, no auth, review lock, mobile");
} finally {
  await browser.close();
  if (caseId && tenantId) {
    const rows = await prisma.aiEvidence.findMany({
      where: { tenantId, caseId }, select: { storageKey: true },
    });
    await prisma.$transaction(async tx => {
      await tx.aiEvidence.deleteMany({ where: { tenantId, caseId } });
      const proposals = await tx.aiProposal.findMany({ where: { tenantId, caseId }, select: { id: true } });
      await tx.aiApproval.deleteMany({
        where: { tenantId, proposalId: { in: proposals.map(p => p.id) } },
      });
      await tx.aiCaseEvent.deleteMany({ where: { tenantId, caseId } });
      await tx.aiProposal.deleteMany({ where: { tenantId, caseId } });
      await tx.aiCase.deleteMany({ where: { tenantId, id: caseId } });
    });
    for (const row of rows) {
      await fs.rm(path.join(process.cwd(), "storage", "documents", path.basename(row.storageKey)),
        { force: true });
    }
  }
  await prisma.$disconnect();
}
