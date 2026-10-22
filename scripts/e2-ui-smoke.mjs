// Requires a synthetic-only local account. No secrets are stored in this repository.
import { chromium } from "playwright";

const email = process.env.WEG_SMOKE_EMAIL;
const password = process.env.WEG_SMOKE_PASSWORD;
const base = process.env.WEG_SMOKE_BASE_URL ?? "http://127.0.0.1:3000";

if (!email || !password) {
  console.error("Set WEG_SMOKE_EMAIL and WEG_SMOKE_PASSWORD.");
  process.exit(2);
}
if (!/^http:\/\/127\.0\.0\.1(?::\d+)?$/.test(base)) {
  console.error("This test only permits a loopback-bound server.");
  process.exit(2);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  page.setDefaultTimeout(20000);
  await page.goto(base + "/de/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(u => !u.pathname.endsWith("/login"), { timeout: 30000 });

  await page.goto(base + "/de/dashboard");
  await page.getByRole("heading", { name: "Was kann ich für Sie erledigen?" }).waitFor();
  await page.locator("#weg-case-description").fill("Im Treppenhaus tropft Wasser aus der Decke.");
  await page.getByRole("button", { name: "Entwurf vorbereiten" }).click();
  await page.locator("#weg-case-body").waitFor();
  const review = page.locator('section[aria-label="Entwurf überprüfen"] input[type=checkbox]');
  const copy = page.getByRole("button", { name: "Geprüften Entwurf kopieren" });
  if (await copy.isEnabled()) throw new Error("Copy must require review.");
  await review.check();
  if (!(await copy.isEnabled())) throw new Error("Review should allow copy.");
  await page.locator("#weg-case-subject").fill("Geprüfter Betreff");
  if (await review.isChecked() || await copy.isEnabled()) throw new Error("Review must reset on edit.");
  await review.check();
  await copy.click();
  await page.getByText("Entwurf kopiert.", { exact: false }).waitFor();
  console.log("DESKTOP_REVIEW_COPY_PASS");

  await page.setViewportSize({ width: 360, height: 800 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) throw new Error("Horizontal scroll at 360px");
  console.log("MOBILE_360_NO_OVERFLOW_PASS");
} finally {
  await browser.close();
}
