#!/usr/bin/env node
/**
 * Browser smoke / P0 E2E for G2.
 *
 *   npm run test:browser:mock --prefix frontend
 *   npm run test:browser:api --prefix frontend
 *
 * Mock: login + student/staff pages with backend/worker off.
 * API: Submit 1 → Claim → Prepare (new revision) → Submit 2 → student reread.
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
function flag(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
}
const mode = flag("mode", "mock");
const baseUrl = flag("base-url", mode === "api" ? "http://127.0.0.1:3101" : "http://127.0.0.1:3100").replace(/\/$/, "");
const marker = `G2B-${Date.now().toString(36)}`;

async function loadPlaywright() {
  try {
    return await import("playwright-core");
  } catch {
    const require = createRequire(pathToFileURL(`${process.cwd()}/package.json`));
    try {
      return require("playwright-core");
    } catch {
      return null;
    }
  }
}

async function login(page, role) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.getByRole("heading", { name: /Đăng nhập/ }).waitFor({ timeout: 15000 });
  const label = role === "officer" ? /Dùng tài khoản cán bộ/ : /Dùng tài khoản sinh viên/;
  const fillBtn = page.getByRole("button", { name: label });
  if (!(await fillBtn.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /^Tài khoản mẫu$/ }).click();
  }
  await fillBtn.click();
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

async function runMockStudent(page) {
  await login(page, "student");
  await page.getByRole("heading", { name: /Bạn cần hỗ trợ việc gì/ }).waitFor({ timeout: 15000 });
  await page.getByRole("link", { name: /Xin giấy xác nhận/ }).first().click();
  await page.getByRole("heading", { name: /Yêu cầu tài liệu VinUni|Xin giấy xác nhận sinh viên/ }).waitFor({ timeout: 15000 });
  await page.goto(`${baseUrl}/student/assistant`, { waitUntil: "domcontentloaded" });
  await sendAssistant(page, "Xin giấy xác nhận cần thông tin gì?");
  await page.getByText(/tài liệu học vụ|bản điện tử \(PDF\)|Registrar/i).first().waitFor({ timeout: 20000 });
  await page.goto(`${baseUrl}/my-requests`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Hồ sơ của tôi" }).waitFor({ timeout: 15000 });
  await page.getByText("TKT-2026-0098").first().waitFor({ timeout: 10000 });
  await logout(page);
}

async function runMockOfficer(page) {
  await login(page, "officer");
  await page.getByRole("heading", { name: "Hàng chờ hồ sơ" }).waitFor({ timeout: 20000 });
  await page.getByRole("link", { name: "TKT-2026-0098", exact: true }).click();
  await page.waitForURL(/\/tickets\//, { timeout: 15000 });
  await page.getByText("TKT-2026-0098").first().waitFor({ timeout: 10000 });
  await page.getByRole("heading", { name: /Khiếu nại điểm/ }).waitFor({ timeout: 10000 });
  await page.goto(`${baseUrl}/reviews`, { waitUntil: "domcontentloaded" });
  await page.getByText(/Rà soát/i).first().waitFor({ timeout: 15000 });
  await logout(page);
}

async function runMock(page, requests) {
  await runMockStudent(page);
  await runMockOfficer(page);
  if (requests.length) {
    throw new Error(`mock offline smoke saw backend requests: ${requests.join(", ")}`);
  }
  return { roles: ["student", "officer"], backendRequests: requests.length, finalUrl: page.url() };
}

async function runApi(page) {
  const report = { marker, steps: [] };
  let submit2Body = null;
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/officer\/tickets\/[^/]+\/actions/.test(request.url())) {
      try {
        submit2Body = request.postDataJSON();
      } catch {
        submit2Body = null;
      }
    }
  });

  await login(page, "student");
  await page.goto(`${baseUrl}/student/assistant`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Xin giấy xác nhận", exact: true }).click();
  const submit1 = page.getByRole("button", { name: "Nộp yêu cầu (Submit 1)" });
  await submit1.waitFor({ timeout: 40000 });
  report.steps.push("preview-ready");

  await page.getByRole("button", { name: "Trở về" }).click();
  const resume = page.getByRole("button", { name: "Tiếp tục hồ sơ" });
  await resume.waitFor({ timeout: 10000 });
  await resume.click();
  await submit1.waitFor({ timeout: 10000 });
  report.steps.push("return-keeps-preview");

  await page.getByLabel("Mục đích").fill(`nộp hồ sơ vay vốn ngân hàng ${marker} (giữ PATCH)`);
  let releasePatch = () => {};
  const holdPatch = new Promise((resolve) => {
    releasePatch = resolve;
  });
  const patchRoute = "**/api/v1/previews/**";
  await page.route(patchRoute, async (route) => {
    if (route.request().method() === "PATCH") await holdPatch;
    await route.continue();
  });
  await page.getByRole("button", { name: "Cập nhật preview" }).click();
  await page.getByRole("button", { name: "Mở lịch sử hội thoại" }).click();
  const previewThread = page.locator("nav[aria-label='Lịch sử hội thoại'] button[aria-current='true']");
  const previewTitle = ((await previewThread.innerText()) || "").split("\n")[0].trim();
  await page.getByRole("button", { name: "Trò chuyện mới" }).click();
  const patchDone = page.waitForResponse((response) => response.request().method() === "PATCH" && /\/previews\//.test(response.url()), { timeout: 20000 });
  releasePatch();
  await patchDone;
  await page.unroute(patchRoute);
  if ((await page.getByRole("button", { name: "Nộp yêu cầu (Submit 1)" }).count()) > 0) {
    throw new Error("delayed PATCH preview leaked onto the new thread");
  }
  report.steps.push("delayed-patch-stays-on-origin");
  await sendAssistant(page, "Tôi muốn khiếu nại điểm thi học phần Cấu trúc Dữ liệu.");
  await page.getByText("Trợ lý AI đã khóa", { exact: false }).first().waitFor({ timeout: 40000 });
  report.steps.push("second-thread-l4");
  await page.getByRole("button", { name: "Mở lịch sử hội thoại" }).click();
  const historyNav = page.locator("nav[aria-label='Lịch sử hội thoại']");
  const match = historyNav.getByRole("button", { name: previewTitle ? new RegExp(previewTitle.slice(0, 24)) : /Tôi muốn xin giấy xác nhận sinh viên/ });
  await match.first().click();
  await submit1.waitFor({ timeout: 10000 });
  if (await page.getByRole("button", { name: "Nộp yêu cầu (Submit 1)" }).count() === 0) {
    throw new Error("switched thread lost Submit 1 preview");
  }
  report.steps.push("switch-back-keeps-preview");

  await page.getByLabel("Mục đích").fill(`nộp hồ sơ vay vốn ngân hàng ${marker}`);
  await submit1.click();
  const ticketHeader = page.getByText(/Mã hồ sơ:\s*TKT-/);
  await ticketHeader.first().waitFor({ timeout: 20000 });
  await page.getByRole("heading", { name: "Đã nộp yêu cầu" }).waitFor({ timeout: 10000 });
  const ticketCode = (await ticketHeader.first().innerText()).replace(/^.*Mã hồ sơ:\s*/, "").trim();
  if (!/^TKT-\d{4}-\d+$/.test(ticketCode)) throw new Error(`missing ticket code: ${ticketCode}`);
  report.ticketCode = ticketCode;
  report.steps.push("submit1");

  await page.getByRole("link", { name: "Mở Yêu cầu của tôi" }).click();
  await page.waitForURL(/\/my-requests/, { timeout: 15000 });
  await page.getByRole("button", { name: new RegExp(ticketCode) }).first().click();
  await page.getByText("Đang tải chi tiết hồ sơ…").waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
  let failDetailAfterMessage = false;
  const ticketRoute = "**/api/v1/tickets/**";
  await page.route(ticketRoute, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && /\/tickets\/[^/]+\/messages$/.test(path)) {
      failDetailAfterMessage = true;
      await route.continue();
      return;
    }
    if (failDetailAfterMessage && request.method() === "GET" && /^\/api\/v1\/tickets\/[^/]+$/.test(path)) {
      failDetailAfterMessage = false;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "INTERNAL", message: "forced-refetch-fail", retryable: true, request_id: "smoke" },
        }),
      });
      return;
    }
    await route.continue();
  });
  const followUp = `Bổ sung thông tin hồ sơ ${marker}`;
  await page.locator("#request-message").fill(followUp);
  await page.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await page.getByText("Đã gửi tin nhắn. Bạn có thể theo dõi phản hồi tại đây.").first().waitFor({ timeout: 15000 });
  await page.getByText(followUp, { exact: false }).first().waitFor({ timeout: 10000 });
  await page.unroute(ticketRoute);
  report.steps.push("message-commit-refetch-fail");

  await logout(page);
  await login(page, "officer");
  await page.getByRole("heading", { name: "Hàng chờ hồ sơ" }).waitFor({ timeout: 20000 });
  await page.getByPlaceholder("Mã hồ sơ, tên, mã sinh viên…").fill(ticketCode);
  await page.getByRole("link", { name: ticketCode, exact: true }).click();
  await page.waitForURL(/\/tickets\//, { timeout: 15000 });
  await page.getByRole("button", { name: "Nhận ca" }).click();
  await page.getByText("Đã nhận ca", { exact: false }).waitFor({ timeout: 15000 });
  report.steps.push("claim");
  await page.getByRole("button", { name: /AI chuẩn bị hồ sơ|Chuẩn bị L3|Chạy lại AI/ }).click();
  await page.getByTestId("officer-fact-sheet").waitFor({ timeout: 45000 });
  await page.getByText("Bản tóm tắt hồ sơ đã sẵn sàng", { exact: false }).waitFor({ timeout: 10000 });
  report.steps.push("prepare-ready");

  const resolveText = `Đã hoàn tất xử lý yêu cầu giấy xác nhận (${marker}). Không phát hành giấy.`;
  await page.locator("#staff-response").fill(resolveText);
  await page.getByRole("button", { name: "Hoàn tất xử lý" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Hoàn tất xử lý" }).click();
  await page.getByText("Đã hoàn tất xử lý hồ sơ", { exact: false }).waitFor({ timeout: 20000 });
  if (!submit2Body || typeof submit2Body.reviewed_brief_version !== "number") {
    throw new Error(`Submit 2 missing current reviewed_brief_version: ${JSON.stringify(submit2Body)}`);
  }
  report.reviewedBriefVersion = submit2Body.reviewed_brief_version;
  report.steps.push("submit2");

  await logout(page);
  await login(page, "student");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.goto(`${baseUrl}/my-requests`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Tìm theo mã hoặc nội dung yêu cầu").fill(ticketCode);
  await page.getByRole("button", { name: "Tìm hồ sơ" }).click();
  await page.getByRole("button", { name: new RegExp(ticketCode) }).first().click();
  await page.getByText("Đang tải chi tiết hồ sơ…").waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
  await page.getByText(resolveText, { exact: false }).first().waitFor({ timeout: 20000 });
  await page.getByText("Hoàn tất", { exact: false }).first().waitFor({ timeout: 10000 });
  report.steps.push("student-reread");
  report.finalUrl = page.url();
  return report;
}

async function dumpFailure(page, error) {
  const stamp = Date.now();
  const screenshot = `/tmp/g2-browser-smoke-${mode}-${stamp}.png`;
  const htmlPath = `/tmp/g2-browser-smoke-${mode}-${stamp}.html`;
  try {
    await page.screenshot({ path: screenshot, fullPage: true });
    writeFileSync(htmlPath, await page.content());
    console.error(`smoke failed at ${page.url()}: ${error?.message || error}`);
    console.error(`screenshot: ${screenshot}`);
    console.error(`html: ${htmlPath}`);
  } catch (dumpError) {
    console.error(`failed to dump page: ${dumpError?.message || dumpError}`);
  }
}

async function main() {
  const playwright = await loadPlaywright();
  if (!playwright?.chromium) {
    console.error("playwright-core is required. Install with: npm install --save-dev playwright-core");
    process.exit(2);
  }
  const browser = await playwright.chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const requests = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/api/v1/") || url.includes(":8000") || url.includes(":8010")) requests.push(url);
  });
  try {
    const result = mode === "api" ? await runApi(page) : await runMock(page, requests);
    console.log(JSON.stringify({ ok: true, mode, baseUrl, backendRequests: requests.length, ...result }, null, 2));
  } catch (error) {
    await dumpFailure(page, error);
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
