#!/usr/bin/env node
// Run from frontend/: node ../scripts/assistant_ui_browser.mjs --base-url http://127.0.0.1:3000
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";

const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const args = process.argv.slice(2);
const flag = (name, fallback) => args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback;
const baseURL = flag("base-url", "http://127.0.0.1:3000");
const output = flag("output-dir", "/tmp/campus-assistant-ui");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
// Select the documented mock mode without changing the running server's configuration.
await context.addInitScript(() => localStorage.setItem("campus247_data_mode", "mock"));
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const steps = [];
const question = "Xin giấy xác nhận cần thông tin gì?";
const input = () => page.locator("#chatbot-question, #assistant-question").filter({ visible: true }).first();
const saved = () => page.evaluate(() => {
  const key = Object.keys(localStorage).find(key => key.startsWith("campus247_chat_ui_v2:mock:"));
  return JSON.parse(localStorage.getItem(key));
});
async function navigation(label) {
  const menu = page.getByRole("navigation", { name: "Điều hướng chính" });
  if (await menu.isVisible()) await menu.getByRole("link", { name: label, exact: true }).click();
  else {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.locator("#mobile-menu").getByRole("link", { name: label, exact: true }).click();
  }
  const paths = { "Dịch vụ sinh viên": "/student", "Trợ lý học vụ": "/student/assistant" };
  await page.waitForURL(url => url.pathname === paths[label]);
  if (label === "Dịch vụ sinh viên") await page.getByRole("heading", { name: "Bạn cần hỗ trợ việc gì?", exact: true }).waitFor();
}
async function welcome() {
  await page.getByRole("heading", { name: "Bạn cần hỗ trợ gì?", exact: true }).waitFor();
  assert.equal(await page.getByRole("log").locator("article").count(), 0);
  assert.equal(await input().inputValue(), "");
}
async function shot(name) {
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true, animations: "disabled" });
}
async function noOverflow() {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "horizontal page overflow");
  const box = await input().boundingBox();
  const height = page.viewportSize().height;
  assert.ok(box.x >= 0 && box.x + box.width <= page.viewportSize().width, "composer fits width");
  assert.ok(box.y >= 64 && box.y + box.height <= height, "composer visible within viewport");
}
async function pageGeometry() {
  return page.evaluate(() => {
    const selectors = [".thoughtstream-theme > header", ".thoughtstream-theme > header > div", ".thoughtstream-theme > header > div > a", '.thoughtstream-theme > header nav[aria-label="Điều hướng chính"]', 'button[aria-controls="account-panel"]', '#student-content', '#tasks-title', '#tasks-title + p', '[aria-labelledby="tasks-title"] a', '#requests-title'];
    return selectors.map(selector => {
      const el = document.querySelector(selector);
      const { x, y, width, height } = el.getBoundingClientRect();
      return { selector, x, y, width, height };
    });
  });
}
async function stableAssistantToggle(width, theme) {
  await page.setViewportSize({ width, height: 900 });
  await page.getByRole("heading", { name: "Bạn cần hỗ trợ việc gì?", exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const before = await pageGeometry();
  const scroll = await page.evaluate(() => scrollY);
  await page.getByRole("button", { name: "Hỏi trợ lý", exact: true }).click();
  await page.locator("#context-assistant").waitFor();
  assert.deepEqual(await pageGeometry(), before, `page stays fixed when assistant opens: ${width}px ${theme}`);
  assert.equal(await page.evaluate(() => scrollY), scroll);
  const panel = await page.locator("#context-assistant").boundingBox();
  if (width >= 1024) assert.ok(panel.y >= before[0].y + before[0].height + 8, "assistant does not cover navigation");
  if (width === 1920 || width === 390) await shot(`stable-assistant-${theme}-${width}-open`);
  await page.keyboard.press("Escape");
  await page.locator("#context-assistant").waitFor({ state: "hidden" });
  assert.deepEqual(await pageGeometry(), before, `page stays fixed when assistant closes: ${width}px ${theme}`);
  assert.equal(await page.evaluate(() => scrollY), scroll);
  assert.equal(await page.getByRole("button", { name: "Hỏi trợ lý", exact: true }).evaluate(el => el === document.activeElement), true);
  if (width === 1920 || width === 390) await shot(`stable-assistant-${theme}-${width}-closed`);
}
try {
  await page.goto(`${baseURL}/login`);
  const demo = page.getByRole("button", { name: /^(Tài khoản demo|Ẩn tài khoản demo|Tài khoản mẫu)$/ });
  await demo.click();
  await demo.locator("..").getByRole("button", { name: /Dùng tài khoản sinh viên/ }).click();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(/\/student$/);
  for (const width of [1920, 1440, 1280, 1024, 768, 390]) await stableAssistantToggle(width, "light");
  steps.push("assistant-toggle-keeps-header-content-and-scroll-position-at-six-widths");
  await page.setViewportSize({ width: 1440, height: 900 });
  await navigation("Trợ lý học vụ");
  await welcome();
  await noOverflow();
  await shot("desktop-light-new");
  await input().fill(question);
  await input().press("Enter");
  await page.getByRole("log").locator("article").waitFor();
  await page.getByRole("button", { name: "Sao chép phản hồi", exact: true }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(copied.length > 20);
  await shot("desktop-light-conversation");
  const original = (await saved()).activeId;
  steps.push("send-with-enter-and-copy-answer");

  await navigation("Dịch vụ sinh viên");
  await navigation("Trợ lý học vụ");
  await welcome();
  const fresh = (await saved()).activeId;
  assert.notEqual(fresh, original);
  await navigation("Dịch vụ sinh viên");
  await navigation("Trợ lý học vụ");
  await welcome();
  assert.equal((await saved()).activeId, fresh, "reuse untouched welcome screen");
  const sidebar = page.locator("#assistant-sidebar");
  assert.equal(await sidebar.isVisible(), true);
  assert.ok(await sidebar.locator("button[aria-current=true]").count());
  const newChatBox = await sidebar.getByRole("button", { name: "Trò chuyện mới", exact: true }).boundingBox();
  assert.ok(newChatBox.x < (await input().boundingBox()).x, "new chat sits in left sidebar");
  await sidebar.getByLabel("Tìm cuộc trò chuyện").fill("NO-MATCH-CONVERSATION");
  await sidebar.getByText("Không tìm thấy cuộc trò chuyện. Thử từ khóa khác.", { exact: true }).waitFor();
  await sidebar.getByLabel("Tìm cuộc trò chuyện").fill("xin giay xac nhan");
  await sidebar.getByRole("button", { name: question, exact: true }).waitFor();
  await sidebar.getByLabel("Tìm cuộc trò chuyện").fill("");
  await input().fill("Câu hỏi được giữ khi thu gọn thanh bên");
  await sidebar.getByRole("button", { name: "Thu gọn thanh bên", exact: true }).click();
  await sidebar.waitFor({ state: "hidden" });
  assert.equal(await input().inputValue(), "Câu hỏi được giữ khi thu gọn thanh bên");
  assert.equal((await saved()).activeId, fresh);
  assert.equal(await page.getByRole("button", { name: "Mở thanh bên hội thoại" }).evaluate(el => el === document.activeElement), true);
  await input().fill("");
  await noOverflow();
  await shot("desktop-light-collapsed");
  await page.getByRole("button", { name: "Mở thanh bên hội thoại" }).click();
  await sidebar.getByRole("button", { name: question, exact: true }).click();
  assert.equal((await saved()).activeId, original);
  await page.getByRole("log").locator("article").waitFor();
  await page.reload();
  await welcome();
  steps.push("desktop-sidebar-search-collapse-keeps-draft-and-history-selection");
  steps.push("new-chat-on-navigation-and-reload-history-kept");

  await input().fill("Bản nháp câu hỏi chưa gửi");
  await page.waitForFunction(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith("campus247_chat_ui_v2:mock:"));
    const state = JSON.parse(localStorage.getItem(key));
    return state.threads.find(thread => thread.id === state.activeId).input === "Bản nháp câu hỏi chưa gửi";
  });
  const unsent = (await saved()).activeId;
  await page.getByRole("button", { name: "Trò chuyện mới", exact: true }).click();
  await welcome();
  assert.equal((await saved()).threads.find(thread => thread.id === unsent).input, "Bản nháp câu hỏi chưa gửi");
  steps.push("new-chat-keeps-unsent-question");

  await navigation("Dịch vụ sinh viên");
  await page.getByRole("button", { name: "Hỏi trợ lý", exact: true }).click();
  await input().fill("Xin chào");
  await page.getByRole("button", { name: "Gửi câu hỏi" }).click();
  await page.getByRole("log").locator("article").waitFor();
  const continuation = (await saved()).activeId;
  await page.getByRole("link", { name: "Tiếp tục trong trang chatbot →" }).click();
  await page.waitForURL(/\/student\/assistant\?continue=1/);
  await page.getByRole("log").locator("article").waitFor();
  assert.equal((await saved()).activeId, continuation);
  steps.push("drawer-continues-same-conversation");

  for (let repeat = 0; repeat < 2; repeat++) {
    await navigation("Dịch vụ sinh viên");
    await page.getByRole("link", { name: /Xin giấy xác nhận/ }).first().click();
    await page.getByRole("heading", { name: "Yêu cầu tài liệu VinUni", exact: true }).waitFor();
  }
  await shot("desktop-form-and-chat");
  for (const width of [1280, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow();
    assert.equal(await page.locator("#workspace-form").evaluate(el => el.scrollWidth > el.clientWidth), false, `form fits beside sidebar at ${width}px`);
  }
  steps.push("form-intent-opens-on-repeated-entry");

  await page.setViewportSize({ width: 390, height: 844 });
  const chatTab = page.getByRole("tab", { name: /Hội thoại/ });
  await chatTab.click();
  await chatTab.press("ArrowRight");
  assert.equal(await page.getByRole("tab", { name: "Biểu mẫu", exact: true }).getAttribute("aria-selected"), "true");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await chatTab.getAttribute("aria-selected"), "true");
  await noOverflow();
  await shot("mobile-form-chat-tab");
  await page.getByRole("button", { name: "Mở lịch sử hội thoại" }).click();
  const dialog = page.getByRole("dialog");
  assert.ok((await dialog.boundingBox()).width <= 301, "mobile history remains a side drawer");
  assert.ok(await dialog.locator("button[aria-current=true]").count());
  await page.keyboard.press("Shift+Tab");
  assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true, "sidebar traps focus");
  await shot("mobile-light-history");
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("button", { name: "Mở lịch sử hội thoại" }).evaluate(el => el === document.activeElement), true);
  await page.getByRole("button", { name: "Mở lịch sử hội thoại" }).click();
  await dialog.getByRole("button", { name: "Trò chuyện mới", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  await welcome();
  assert.equal(await input().evaluate(el => el === document.activeElement), true, "new chat focuses composer after sidebar closes");
  await noOverflow();
  await shot("mobile-light-new");
  await input().fill("Xin chào");
  await input().press("Shift+Enter");
  assert.ok((await input().inputValue()).includes("\n"));
  await input().press("Enter");
  await page.getByRole("log").locator("article").waitFor();
  await noOverflow();
  await shot("mobile-light-conversation");
  steps.push("mobile-history-dialog-focus-escape-new-chat-form-tabs-and-multiline");

  await page.getByRole("button", { name: /Tài khoản/ }).click();
  await page.getByRole("button", { name: "Chuyển sang giao diện tối" }).click();
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
  await page.waitForFunction(() => {
    const composer = document.querySelector("#chatbot-question").closest("form");
    return getComputedStyle(composer).backgroundColor === "rgb(28, 25, 23)";
  });
  await shot("mobile-dark-conversation");
  await page.getByRole("button", { name: "Trò chuyện mới", exact: true }).click();
  await welcome();
  await noOverflow();
  await shot("mobile-dark-new");
  await page.setViewportSize({ width: 1440, height: 900 });
  await shot("desktop-dark-new");
  await page.setViewportSize({ width: 768, height: 1024 });
  await noOverflow();
  await shot("tablet-dark-new");
  steps.push("light-dark-desktop-tablet-mobile-fit");
  await navigation("Dịch vụ sinh viên");
  for (const width of [1920, 1280, 390]) await stableAssistantToggle(width, "dark");
  steps.push("assistant-toggle-keeps-layout-in-dark-mode");
  assert.deepEqual(errors, []);
  const report = { ok: true, mode: "mock", steps, screenshots: output, browserErrors: errors };
  writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error);
  try { await shot("failure"); } catch { /* Browser may have already closed. */ }
  console.error("Browser errors:", errors);

  process.exitCode = 1;
} finally {
  await browser.close();
}
