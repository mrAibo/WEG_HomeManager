/** Synthetic-only browser smoke with LOOPBACK mocked OpenAI Responses endpoint.
 * Requires running Next on 127.0.0.1:3000 and WEG_SMOKE_EMAIL/PASSWORD from
 * ignored local credentials; never invokes a commercial external model.
 */
import { createServer } from "node:http";
import { once } from "node:events";
import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { chromium } from "playwright";

const prisma = new PrismaClient();
const base = "http://127.0.0.1:3000";
const port = 34173;
const expectedModel = "tiny-vision-demo";
const resultText = "Rechnung Nr. [unleserlich]\nSumme 47,20 EUR";
const expectedResult = JSON.stringify({
  text: resultText,
  unclear: ["Rechnungsnummer unleserlich"],
  triage: {
    category: "INVOICE", confidence: 0.82,
    explanation: "Im Dokument wird ein Geldbetrag genannt.",
    senderHint: null, propertyHint: "WEG Musterhaus (nur Vorschlag)",
    documentDate: null, dueDate: null,
    facts: [{label:"Summe",value:"47,20 EUR",evidence:"Summe 47,20 EUR"}],
    actions: [{code:"VERIFY_INVOICE",explanation:"Betrag prüfen, nicht bezahlen",priority:"NORMAL"}],
  },
});
const sourcePath = path.join(process.cwd(), "storage", "documents");
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
function check(value, msg) { if (!value) throw Error(msg); }

async function main() {
  const uri = new URL(process.env.DATABASE_URL ?? "");
  check(["127.0.0.1", "localhost"].includes(uri.hostname) &&
    uri.port === "5432" && uri.pathname === "/havewa", "synthetic DB required");
  const tenants = await prisma.tenant.findMany({ select: {
    id: true, name: true, aiProvider: true, aiModel: true, aiApiKey: true, aiBaseUrl: true,
  } });
  check(tenants.length === 1 && tenants[0].name === "WEG Demo – Sechs Wohnungen", "demo tenant only");
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
  check(users.length > 0 && users.every(u => u.email.endsWith(".invalid")), "synthetic user emails only");
  const email = process.env.WEG_SMOKE_EMAIL;
  const password = process.env.WEG_SMOKE_PASSWORD;
  check(email && password && email.endsWith(".invalid"), "local synthetic login required");
  const admin = users.find(u => u.role === "ADMIN" && u.email === email);
  check(admin, "synthetic admin not found");

  let caseId;
  let storageKey;
  let browser;
  let invoked = 0;
  const mock = createServer(async (req, res) => {
    if (req.url !== "/v1/responses" || req.method !== "POST") {
      res.writeHead(404).end(); return;
    }
    let raw = "";
    for await (const part of req) {
      raw += part.toString("utf8");
      if (raw.length > 2_000_000) { res.writeHead(413).end(); return; }
    }
    try {
      const body = JSON.parse(raw);
      check(body.model === expectedModel, "wrong user-selected model");
      check(body.input?.[0]?.content?.[1]?.file_data?.startsWith("data:application/pdf;base64,"),
        "model did not receive original PDF");
      invoked++;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        id: "synthetic-response", object: "response", model: expectedModel,
        status: "completed", created_at: Math.trunc(Date.now() / 1000),
        output_text: expectedResult,
        output: [{ type: "message", role: "assistant", status: "completed",
          content: [{ type: "output_text", text: expectedResult, annotations: [] }] }],
      }));
    } catch {
      res.writeHead(400).end();
    }
  });
  try {
    mock.listen(port, "127.0.0.1");
    await once(mock, "listening");
    await prisma.tenant.update({ where: { id: tenants[0].id },
      data: { aiProvider: "openai", aiBaseUrl: `http://127.0.0.1:${port}/v1`,
        aiModel: expectedModel, aiApiKey: "LOCAL_SYNTHETIC_STUB_NOT_EXTERNAL" } });
    const pdf = await PDFDocument.create(); pdf.addPage([300, 300]);
    const bytes = Buffer.from(await pdf.save());
    const title = "Synthetische Testanlage";
    const description = "Erkennungstest ohne persönliche Angaben oder echte Rechnung.";
    const created = await prisma.aiCase.create({ data: {
      tenantId: tenants[0].id, createdById: admin.id, kind: "DOCUMENT",
      summary: title, sourceText: description, sourceSha256: digest(description),
    } });
    caseId = created.id;
    await prisma.aiProposal.create({ data: {
      tenantId: tenants[0].id, caseId, origin: "TEMPLATE", title, body: "Nur Testtext",
      contentSha256: digest(title + "\n" + "Nur Testtext"),
    } });
    await fs.mkdir(sourcePath, { recursive: true });
    storageKey = crypto.randomUUID() + ".pdf";
    await fs.writeFile(path.join(sourcePath, storageKey), bytes);
    const evidence = await prisma.aiEvidence.create({ data: {
      tenantId: tenants[0].id, caseId, name: "synthetic.pdf", mime: "application/pdf",
      size: bytes.length, sha256: digest(bytes), storageKey, uploadedById: admin.id,
    } });

    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: 1150, height: 820 } });
    await page.goto(base + "/de/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.locator("form button[type=submit]").click();
    await page.waitForURL(url => !url.pathname.endsWith("/login"));
    await page.goto(base + "/de/cases/" + caseId);
    await page.getByText("Dokument verstehen lassen (KI, optional)").waitFor();
    await page.getByText("Gewähltes Modell: openai / " + expectedModel).waitFor();
    await page.getByRole("checkbox", { name: /Ich stimme zu, dass dieses Dokument/ }).check();
    await page.getByRole("button", { name: "Dokument mit KI analysieren" }).click();
    await page.getByText(/KI-Erkennung · ungeprüfter Entwurf/).waitFor({ timeout: 30000 });
    await page.getByRole("heading",{name:"Rechnung"}).waitFor({timeout:10000});
    await page.getByText("Rechnungsdaten gegen Original prüfen").waitFor();
    const id = evidence.id;
    const field = page.locator("#recognition-" + id);
    await field.waitFor();
    check((await field.inputValue()).includes("[unleserlich]"), "mock transcription not visible");
    await field.fill("Rechnung Nr. [unleserlich]\nSumme 47,20 EUR — geprüft");
    await page.getByRole("checkbox", { name: /Ich habe den Text mit der Originaldatei verglichen/ }).check();
    await page.getByRole("button", { name: "Geprüfte Transkription speichern" }).click();
    await page.getByText(/KI-Erkennung · menschlich geprüft/).waitFor({ timeout: 30000 });
    const row = await prisma.aiRecognition.findUniqueOrThrow({ where: { evidenceId: id } });
    check(row.status === "REVIEWED" && row.provider === "openai" &&
      row.model === expectedModel && row.reviewedById === admin.id &&
      row.sourceSha256 === digest(bytes) &&
      row.triage?.category === "INVOICE" &&
      row.editedText?.includes("— geprüft"), "recognized and reviewed persistent state mismatch");
    const proposal = await prisma.aiProposal.findFirstOrThrow({ where: { caseId } });
    check(proposal.state === "DRAFT" && proposal.origin === "TEMPLATE" && proposal.body === "Nur Testtext",
      "model changed unrelated Case proposal");
    check(invoked === 1, "only one local provider call permitted");
    console.log("E10_TRIAGE_CHROME_PASS: one local-only model call, document class + suggested actions + human correction, unchanged proposal");
  } finally {
    await browser?.close();
    await new Promise(resolve => mock.close(resolve));
    if (caseId) {
      const id = caseId;
      await prisma.$transaction(async tx => {
        await tx.aiRecognition.deleteMany({ where: { tenantId: tenants[0].id, caseId: id } });
        await tx.aiCaseEvent.deleteMany({ where: { tenantId: tenants[0].id, caseId: id } });
        await tx.aiEvidence.deleteMany({ where: { tenantId: tenants[0].id, caseId: id } });
        await tx.aiProposal.deleteMany({ where: { tenantId: tenants[0].id, caseId: id } });
        await tx.aiCase.deleteMany({ where: { tenantId: tenants[0].id, id } });
      });
    }
    if (storageKey) await fs.rm(path.join(sourcePath, storageKey), { force: true });
    await prisma.tenant.update({ where: { id: tenants[0].id },
      data: { aiProvider: tenants[0].aiProvider, aiModel: tenants[0].aiModel,
        aiApiKey: tenants[0].aiApiKey, aiBaseUrl: tenants[0].aiBaseUrl } });
    await prisma.$disconnect();
  }
}
main().catch(e => { console.error("E7_RECOGNITION_CHROME_FAIL:", e.message); process.exitCode = 1; });
