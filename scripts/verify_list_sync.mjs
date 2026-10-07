import { createRequire } from "node:module";
import { mkdirSync } from "fs";

const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { chromium } = require("playwright-core");

const output = "/tmp/sync-verification";
mkdirSync(output, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });

async function verifyScreens() {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  await context.addInitScript(() => localStorage.setItem("campus247_data_mode", "mock"));
  const page = await context.newPage();

  // Login as student
  await page.goto("http://127.0.0.1:3000/login");
  await page.locator("#identifier").fill("SV001");
  await page.locator("#password").fill("demo1234");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(/\/student$/);

  // Student Home
  await page.waitForSelector("#student-content");
  await page.screenshot({ path: `${output}/1-student-home-1920.png`, fullPage: false });

  // Student Requests
  await page.goto("http://127.0.0.1:3000/my-requests");
  await page.waitForSelector("#requests-main");
  await page.screenshot({ path: `${output}/2-student-requests-1920.png`, fullPage: false });

  // Student Assistant
  await page.goto("http://127.0.0.1:3000/student/assistant");
  await page.waitForSelector(".assistant-workspace");
  await page.screenshot({ path: `${output}/3-student-assistant-1920.png`, fullPage: false });

  // Student Lookup
  await page.goto("http://127.0.0.1:3000/student/lookup");
  await page.waitForSelector("h1");
  await page.screenshot({ path: `${output}/4-student-lookup-1920.png`, fullPage: false });

  // Login as officer
  await page.goto("http://127.0.0.1:3000/login");
  await page.locator("#identifier").fill("OF001");
  await page.locator("#password").fill("demo1234");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(/\/dashboard$/);

  // Staff Queue
  await page.waitForSelector("table");
  await page.screenshot({ path: `${output}/5-staff-queue-1920.png`, fullPage: false });

  // Staff Reviews
  await page.goto("http://127.0.0.1:3000/reviews");
  await page.waitForSelector("table");
  await page.screenshot({ path: `${output}/6-staff-reviews-1920.png`, fullPage: false });

  await browser.close();
  console.log("Screenshots captured in", output);
}

verifyScreens().catch((err) => {
  console.error(err);
  process.exit(1);
});

