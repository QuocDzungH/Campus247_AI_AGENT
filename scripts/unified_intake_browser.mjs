#!/usr/bin/env node
/**
 * Browser E2E: complaint + certificate in the same student chat.
 *
 *   node scripts/unified_intake_browser.mjs --base-url http://127.0.0.1:3000
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
function flag(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
}
const baseUrl = flag("base-url", "http://127.0.0.1:3000").replace(/\/$/, "");
const marker = `UNI-${Date.now().toString(36)}`;
const shotDir = "/tmp/unified-intake";

async function loadPlaywright() {
  try {
    return await import("playwright-core");
  } catch {
    const require = createRequire(pathToFileURL(`${process.cwd()}/package.json`));
    return require("playwright-core");
  }
}

async function login(page, role) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.getByRole("heading", { name: /Đăng nhập/ }).waitFor({ timeout: 15000 });
  const label = role === "officer" ? /Dùng tài khoản cán bộ/ : /Dùng tài khoản sinh viên/;
  // Select the demo section explicitly: operational fill buttons have the same labels.
  const demoToggle = page.getByRole("button", { name: /^(Tài khoản demo|Ẩn tài khoản demo|Tài khoản mẫu)$/ });
  await demoToggle.waitFor({ timeout: 15000 });
  if ((await demoToggle.getAttribute("aria-expanded")) !== "true") await demoToggle.click();
  const demoSection = demoToggle.locator("..");
  await demoSection.getByRole("button", { name: label }).click();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(role === "officer" ? /\/dashboard/ : /\/student/, { timeout: 25000 });
}

async function logout(page) {
  await page.getByRole("button", { name: /Tài khoản/ }).click();
  await page.getByRole("link", { name: "Đăng xuất" }).click();
  await page.waitForURL(/\/login/, { timeout: 15000 });
}

async function sendAssistant(page, text) {
  const box = page.locator("#assistant-question, #chatbot-question").first();
  await box.fill(text);
  await page.getByRole("button", { name: "Gửi câu hỏi" }).click();
}

async function newThread(page) {
  await page.getByRole("button", { name: "Mở lịch sử hội thoại" }).click();
  await page.getByRole("button", { name: "Trò chuyện mới", exact: true }).click();
}

async function screenshot(page, name) {
  mkdirSync(shotDir, { recursive: true });
  const path = `${shotDir}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function run(page) {
  const report = { marker, steps: [], screenshots: [] };

  await login(page, "student");
  await page.goto(`${baseUrl}/student/complaint`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/student\/assistant/, { timeout: 15000 });
  report.steps.push("old-complaint-url-redirects");

  await page.getByText("Bạn muốn khiếu nại về vấn đề gì?", { exact: false }).waitFor({ timeout: 40000 });
  if (await page.getByText("Trợ lý AI đã khóa", { exact: false }).count()) {
    throw new Error("vague complaint locked AI");
  }
  if (await page.getByText(/Mã hồ sơ:\s*TKT-/).count()) {
    throw new Error("vague complaint created a ticket");
  }
  report.screenshots.push(await screenshot(page, "01-vague-complaint-ask"));
  report.steps.push("vague-asks-topic");

  await newThread(page);
  await sendAssistant(page, "Tôi muốn khiếu nại điểm môn Cơ sở dữ liệu vì điểm bài thi chưa đúng.");
  await page.getByLabel("Môn học / học phần").waitFor({ timeout: 40000 });
  if (await page.getByText("Trợ lý AI đã khóa", { exact: false }).count()) {
    throw new Error("grade complaint locked AI before confirm");
  }
  const course = await page.locator("#intake-course").inputValue();
  if (!course.includes("Cơ sở dữ liệu")) throw new Error(`course not prefilled: ${course}`);
  report.screenshots.push(await screenshot(page, "02-grade-form-in-chat"));
  report.steps.push("grade-form-opens");

  const description = page.locator("#intake-description");
  if (!(await description.inputValue()).trim()) {
    await description.fill(`Điểm bài thi chưa đúng so với bài đã nộp ${marker}`);
  }
  await page.getByRole("button", { name: "Nộp yêu cầu (Submit 1)" }).click();
  await page.getByRole("button", { name: "Xác nhận gửi" }).click();
  await page.getByText(/Mã hồ sơ:\s*TKT-/).first().waitFor({ timeout: 20000 });
  await page.getByRole("heading", { name: /Chờ cán bộ xử lý|Đã gửi cán bộ xử lý/ }).waitFor({ timeout: 10000 });
  const ticketHeader = page.getByText(/Mã hồ sơ:\s*TKT-/).first();
  const ticketCode = (await ticketHeader.innerText()).replace(/^.*Mã hồ sơ:\s*/, "").trim();
  if (!/^TKT-\d{4}-\d+$/.test(ticketCode)) throw new Error(`missing ticket code: ${ticketCode}`);
  report.ticketCode = ticketCode;
  report.screenshots.push(await screenshot(page, "03-complaint-submitted"));
  report.steps.push("complaint-submit1");

  await newThread(page);
  await sendAssistant(page, "Quy trình khiếu nại điểm?");
  await page.getByText(/tài liệu|quy trình|phúc khảo|chưa đủ căn cứ/i).first().waitFor({ timeout: 40000 });
  if (await page.locator("#intake-course").count()) {
    throw new Error("procedure question opened a complaint form");
  }
  report.steps.push("procedure-is-not-submit");

  await newThread(page);
  await page.getByRole("button", { name: "Xin giấy xác nhận", exact: true }).click();
  await page.getByRole("button", { name: "Nộp yêu cầu (Submit 1)" }).waitFor({ timeout: 40000 });
  await page.getByLabel("Mục đích").waitFor({ timeout: 10000 });
  report.screenshots.push(await screenshot(page, "04-certificate-form-same-chat"));
  await page.getByRole("button", { name: "Nộp yêu cầu (Submit 1)" }).click();
  await page.getByRole("button", { name: "Xác nhận gửi" }).click();
  await page.getByText(/Mã hồ sơ:\s*TKT-/).first().waitFor({ timeout: 20000 });
  report.steps.push("certificate-submit1");
  report.screenshots.push(await screenshot(page, "05-certificate-submitted"));

  await logout(page);
  await login(page, "officer");
  await page.getByRole("heading", { name: "Hàng chờ hồ sơ" }).waitFor({ timeout: 20000 });
  await page.getByPlaceholder("Mã hồ sơ, tên, mã sinh viên…").fill(ticketCode);
  await page.getByRole("link", { name: ticketCode, exact: true }).click();
  await page.waitForURL(/\/tickets\//, { timeout: 15000 });
  await page.getByText(/Khiếu nại/i).first().waitFor({ timeout: 10000 });
  await page.getByText(/Điểm học phần/i).first().waitFor({ timeout: 10000 });
  if (await page.getByRole("button", { name: "Bản giấy xác nhận" }).count()) {
    throw new Error("complaint ticket showed certificate issuance tab");
  }
  report.screenshots.push(await screenshot(page, "06-officer-complaint-ticket"));
  report.steps.push("officer-sees-complaint");
  report.finalUrl = page.url();
  return report;
}

async function main() {
  const playwright = await loadPlaywright();
  if (!playwright?.chromium) {
    console.error("playwright-core is required");
    process.exit(2);
  }
  const browser = await playwright.chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    const result = await run(page);
    console.log(JSON.stringify({ ok: true, baseUrl, ...result }, null, 2));
  } catch (error) {
    mkdirSync(shotDir, { recursive: true });
    const stamp = Date.now();
    try {
      await page.screenshot({ path: `${shotDir}/fail-${stamp}.png`, fullPage: true });
      writeFileSync(`${shotDir}/fail-${stamp}.html`, await page.content());
    } catch {
      /* dump best-effort */
    }
    console.error(error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
