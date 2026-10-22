// Reproducible local synthetic-only E3 browser smoke; no credentials or images committed.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

(async () => {
  const creds = { email: process.env.WEG_SMOKE_EMAIL, password: process.env.WEG_SMOKE_PASSWORD };
  if (!creds.email || !creds.password || !creds.email.endsWith(".invalid")) {
    throw Error("Set WEG_SMOKE_EMAIL (.invalid) and WEG_SMOKE_PASSWORD for a synthetic account");
  }
  const db = new URL(process.env.DATABASE_URL || "");
  if (!["localhost", "127.0.0.1"].includes(db.hostname) || db.port !== "5432" || db.pathname !== "/havewa") {
    throw Error("Refusing non-synthetic database");
  }
  const prisma = new PrismaClient();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 },
    permissions: ["clipboard-read", "clipboard-write"] });
  page.setDefaultTimeout(24000);
  let caseId = null;
  let tenantId = null;
  try {
    const admin = await prisma.user.findUnique({
      where: { email: creds.email }, select: { id: true, tenantId: true },
    });
    if (!admin) throw Error("Synthetic administrator missing");
    const tenant = await prisma.tenant.findUnique({ where: { id: admin.tenantId }, select: { name: true } });
    if (tenant?.name !== "WEG Demo – Sechs Wohnungen") throw Error("Refusing non-synthetic tenant");
    tenantId = admin.tenantId;
    await page.goto("http://127.0.0.1:3000/de/login");
    await page.locator("#email").fill(creds.email);
    await page.locator("#password").fill(creds.password);
    await page.locator("form button[type=submit]").click();
    await page.waitForURL((url) => !url.pathname.endsWith("/login"));
    await page.goto("http://127.0.0.1:3000/de/dashboard");
    await page.getByRole("heading", { name: "Was kann ich für Sie erledigen?" }).waitFor();
    await page.locator("#weg-case-description").fill("Im synthetischen Treppenhaus tropft Wasser aus der Decke.");
    await page.getByRole("button", { name: "Entwurf vorbereiten" }).click();
    await page.locator("section[aria-label='Entwurf überprüfen'] input[type=checkbox]").check();
    await page.getByRole("button", { name: "Vorgang speichern" }).click();
    await page.getByText("Vorgang mit Textentwurf gespeichert", { exact: false }).waitFor();
    const link = page.getByRole("link", { name: "Gespeicherten Vorgang öffnen" });
    const href = await link.getAttribute("href");
    if (!href) throw Error("No case link after save");
    caseId = href.split("/").pop();
    const before = await prisma.aiCase.findFirst({
      where: { id: caseId, tenantId }, include: { proposals: true, events: true },
    });
    if (!before || before.proposals.length !== 1 || before.proposals[0].state !== "DRAFT") {
      throw Error("First persisted case not in DRAFT");
    }
    await link.click();
    await page.locator("#case-proposal-title").waitFor();
    await page.locator("#case-proposal-title").fill("Geprüfte Meldung: Wasser im Treppenhaus");
    await page.getByRole("button", { name: "Änderungen speichern" }).click();
    await page.getByText("Version 2", { exact: false }).first().waitFor();
    await page.getByRole("button", { name: "Zur Prüfung einreichen" }).click();
    await page.getByText("Zur Prüfung eingereicht", { exact: false }).first().waitFor();
    console.log("DEBUG_AFTER_SUBMIT", page.url(), (await page.locator("body").innerText()).slice(-1200));
    await page.locator('section[aria-label="Freigabe"] input[type=checkbox]').check();
    await page.getByRole("button", { name: "Diese Version freigeben" }).click();
    await page.getByRole("button", { name: "Freigegebene Version kopieren" }).waitFor();
    await page.getByRole("button", { name: "Freigegebene Version kopieren" }).click();
    await page.getByText("Freigegebenen Text kopiert", { exact: false }).waitFor();
    const approved = await prisma.aiProposal.findFirst({
      where: { caseId, tenantId },
      include: { approvals: true },
    });
    if (!approved || approved.state !== "APPROVED" || approved.version !== 2 ||
        approved.approvals.length !== 1 || approved.approvals[0].scope !== "COPY_ONLY") {
      throw Error("Saved approval missing/version mismatch");
    }
    console.log("E3_UI_PERSISTENT_CASE_REVIEW_COPY_PASS");

    await page.setViewportSize({ width: 360, height: 800 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (overflow) throw Error("Mobile 360px horizontal overflow");
    console.log("E3_CASE_MOBILE_360_PASS");
  } finally {
    await browser.close();
    if (caseId && tenantId) {
      await prisma.$transaction(async (tx) => {
        const proposals = await tx.aiProposal.findMany({
          where: { caseId, tenantId }, select: { id: true },
        });
        await tx.aiApproval.deleteMany({ where: {
          tenantId, proposalId: { in: proposals.map(p => p.id) },
        } });
        await tx.aiCaseEvent.deleteMany({ where: { tenantId, caseId } });
        await tx.aiProposal.deleteMany({ where: { tenantId, caseId } });
        await tx.aiCase.deleteMany({ where: { tenantId, id: caseId } });
      });
    }
    await prisma.$disconnect();
  }
})().catch(e => { console.error("E3_BROWSER_SMOKE_FAILED", e.message); process.exitCode = 1; });
