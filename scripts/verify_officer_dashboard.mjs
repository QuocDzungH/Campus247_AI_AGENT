import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const { chromium } = createRequire(new URL("../frontend/package.json", import.meta.url))("playwright-core");
const baseUrl = process.argv[2] || "http://127.0.0.1:3000";
const outDir = process.env.VERIFICATION_OUTPUT_DIR || "/tmp/campus247-officer-dashboard";

async function main() {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.addInitScript(() => {
    localStorage.setItem("campus247_data_mode", "mock");
    localStorage.setItem("campus247_current_user_v1", "OF001");
  });
  const page = await context.newPage();

  console.log("1. Navigating to /dashboard as Officer...");
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1", { timeout: 15000 });
  await page.screenshot({ path: `${outDir}/officer-dashboard-new.png`, fullPage: true });
  console.log("Saved officer-dashboard-new.png");

  console.log("2. Navigating to /queue...");
  await page.goto(`${baseUrl}/queue`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1", { timeout: 15000 });
  await page.screenshot({ path: `${outDir}/officer-queue-new.png`, fullPage: true });
  console.log("Saved officer-queue-new.png");

  console.log("3. Navigating to /reviews...");
  await page.goto(`${baseUrl}/reviews`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1", { timeout: 15000 });
  await page.screenshot({ path: `${outDir}/officer-reviews-new.png`, fullPage: true });
  console.log("Saved officer-reviews-new.png");

  console.log("4. Navigating to Student Assistant /student/assistant (Full Bleed Check)...");
  const studentContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await studentContext.addInitScript(() => {
    localStorage.setItem("campus247_data_mode", "mock");
    localStorage.setItem("campus247_current_user_v1", "SV001");
  });
  const studentPage = await studentContext.newPage();
  await studentPage.goto(`${baseUrl}/student/assistant`, { waitUntil: "networkidle" });
  await studentPage.waitForSelector(".assistant-workspace", { timeout: 15000 });
  await studentPage.screenshot({ path: `${outDir}/student-assistant-fullbleed.png` });
  console.log("Saved student-assistant-fullbleed.png");

  await browser.close();
  console.log("ALL TESTS COMPLETED SUCCESSFULLY!");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
