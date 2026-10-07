#!/usr/bin/env node
// API responses are intercepted: this never submits to a real backend.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const { chromium } = createRequire(new URL("../frontend/package.json", import.meta.url))("playwright-core");
const args = process.argv.slice(2);
const flag = (name, fallback) => args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback;
const baseURL = flag("base-url", "http://127.0.0.1:3100");
const output = flag("output-dir", "/tmp/campus-submitted-request");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
const pageShape = items => ({ items, total: items.length, page: 1, page_size: 100 });
const created = "2026-10-06T10:00:00+07:00";
const user = { id: "SV-DEMO-001", name: "Nguyễn Văn An", role: "student" };
const profile = { user_id: user.id, full_name: user.name, mssv: "20210018", email: "an.test@example.test", major: "Kỹ thuật phần mềm", class_year: "K18", verification_status: "verified" };

async function scenario(kind) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => localStorage.setItem("campus247_data_mode", "api"));
  const page = await context.newPage();
  const errors = [], unexpected = [];
  page.on("pageerror", error => errors.push(error.message));
  const complaint = kind === "complaint";
  let submitted = false, failDetail = kind === "pending", writes = 0, messages = 0;
  const preview = {
    id: `prv_${kind}`, version: 1, can_submit: true, expires_at: "2030-01-01T00:00:00Z",
    service_type: "student_certificate", fields: {
      purpose: "Xin miễn điểm danh do đang đi làm", destination_org: "Phòng Đào tạo",
      receive_method: "paper_stamped", complaint_subtype: null, course: null, course_code: null,
      assessment: null, description: null, requested_outcome: null, evidence: null,
    }, missing_fields: [], invalid_fields: [],
  };
  const ticket = {
    id: `tkt_${kind}`, code: complaint ? "TKT-2026-0527" : "TKT-2026-0526",
    status: complaint ? "pending_officer" : "open", priority: complaint ? "high" : "normal",
    conversation_id: `conv_${kind}`, student_id: user.id, student_name: user.name, student_mssv: profile.mssv,
    category: complaint ? "complaint" : "action", service_type: complaint ? "academic_complaint" : "student_certificate",
    priority_reasons: [], summary: complaint ? "Khiếu nại điểm môn Cơ sở dữ liệu" : "Xin giấy xác nhận sinh viên để miễn điểm danh",
    request_data: complaint ? { complaint_subtype: "grade_appeal", course: "Cơ sở dữ liệu", description: "Đề nghị kiểm tra lại điểm thi", evidence: "Bảng điểm đã công bố", requested_outcome: "Đối chiếu kết quả" } : preview.fields,
    handover_reason: complaint ? "Cần cán bộ kiểm tra" : null, assigned_officer_id: null, revision: 1,
    created_at: created, updated_at: created,
  };
  const conversation = () => ({ id: ticket.conversation_id, revision: 1, ticket_id: submitted ? ticket.id : null, status: complaint && submitted ? "handover" : "active", ai_response_locked: complaint && submitted, handover_status: complaint && submitted ? "completed" : "none", created_at: created, updated_at: created });
  await context.route("**/api/v1/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, POST, PATCH, OPTIONS" };
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });
    if (method === "OPTIONS") return json({});
    if (path === "/api/v1/status") return json({ demo_auth_enabled: true });
    if (path.startsWith("/api/v1/auth/") && method === "POST") return json({ access_token: "fixture-only-token", expires_at: "2030-01-01T00:00:00Z", token_type: "Bearer", user });
    if (path === "/api/v1/me") return json(user);
    if (path === "/api/v1/me/profile") return json(profile);
    if (path === "/api/v1/reviews") return json(pageShape([]));
    if (path === "/api/v1/tickets" && method === "GET") return json(pageShape(submitted && !failDetail ? [ticket] : []));
    if (path === "/api/v1/conversations" && method === "GET") return json(pageShape(submitted ? [conversation()] : []));
    if (path === "/api/v1/conversations" && method === "POST") return json(conversation(), 201);
    if (path === `/api/v1/previews/${preview.id}` && method === "PATCH") return json(preview);
    if (path === "/api/v1/tickets" && method === "POST") {
      writes++; submitted = true;
      if (kind === "pending") return json({ error: { code: "PREVIEW_ALREADY_SUBMITTED", message: "Đã nộp", details: { ticket_id: ticket.id } } }, 409);
      return json({ ticket }, 201);
    }
    if (path === `/api/v1/tickets/${ticket.id}`) {
      if (failDetail) return json({ error: { code: "TEMPORARY_FAILURE", message: "Chưa đồng bộ" } }, 503);
      return json({ ticket, messages: pageShape([]), student_profile: profile });
    }
    if (path === `/api/v1/tickets/${ticket.id}/messages`) return json(pageShape([]));
    if (path === `/api/v1/conversations/${ticket.conversation_id}/messages` && method === "GET") return json(pageShape([]));
    if (path === `/api/v1/conversations/${ticket.conversation_id}/messages` && method === "POST") {
      messages++;
      if (complaint) submitted = true;
      const forwarded = complaint && submitted;
      return json({ conversation_id: ticket.conversation_id, user_message_id: `msg_u${messages}`,
        route: forwarded ? "L4" : submitted ? "L1" : "L2", outcome: forwarded ? "handover_completed" : submitted ? "answered" : "preview_ready",
        reply: { id: `msg_a${messages}`, sender: "assistant", content: forwarded ? "Đã gửi khiếu nại đến cán bộ." : submitted ? "Bạn hãy theo dõi phản hồi của cán bộ." : "Bạn hãy kiểm tra thông tin trước khi gửi.", created_at: created },
        citations: [], preview: submitted ? null : preview, ticket: forwarded ? ticket : null,
        conversation_state: { status: forwarded ? "handover" : "active", ai_response_locked: forwarded, handover_status: forwarded ? "completed" : "none" },
      });
    }
    unexpected.push(`${method} ${path}`);
    return json({ error: { code: "FIXTURE_MISSING", message: "Missing intercepted fixture" } }, 500);
  });
  const card = () => page.getByRole("region", { name: "Đơn đã gửi trong hội thoại" });
  const shot = async name => {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${output}/${kind}-${name}.png`, fullPage: true, animations: "disabled" });
  };
  const fit = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const view = async () => {
    await card().getByRole("button", { name: "Xem đơn đã gửi" }).click();
    await page.getByRole("dialog").waitFor();
    return page.getByRole("dialog");
  };
  try {
    await page.goto(`${baseURL}/login`);
    await page.locator("#identifier").fill("20210018");
    await page.locator("#password").fill("fixture-password");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.waitForURL(/\/student$/);
    await page.goto(`${baseURL}/student/assistant`);
    await page.locator("#chatbot-question").fill(complaint ? "Tôi muốn khiếu nại điểm thi" : "Xin giấy xác nhận để miễn điểm danh");
    await page.locator("#chatbot-question").press("Enter");
    if (!complaint) {
      await page.getByRole("button", { name: "Nộp yêu cầu (Submit 1)", exact: true }).click();
      assert.equal(writes, 0, "preview check cannot submit without confirmation");
      await page.getByRole("button", { name: "Xác nhận gửi", exact: true }).click();
    }
    await card().waitFor();
    await page.locator("#workspace-form").waitFor({ state: "hidden" });
    assert.equal(await page.getByRole("tab", { name: "Biểu mẫu", exact: true }).count(), 0);
    await fit();
    if (kind === "pending") {
      assert.ok((await card().innerText()).includes("Đang đồng bộ mã hồ sơ"));
      assert.equal((await card().innerText()).includes(ticket.id), false, "internal ID is never shown as a display code");
      const dialog = await view();
      await dialog.getByRole("button", { name: "Thử tải lại đơn" }).waitFor();
      failDetail = false;
      await dialog.getByRole("button", { name: "Thử tải lại đơn" }).click();
      await dialog.getByText(ticket.code, { exact: true }).waitFor();
      await page.keyboard.press("Escape");
    } else await card().getByText(ticket.code, { exact: true }).waitFor();
    await shot("desktop-card");
    let dialog = await view();
    await dialog.getByText(profile.mssv, { exact: true }).waitFor();
    await dialog.getByText(complaint ? "Đề nghị kiểm tra lại điểm thi" : preview.fields.purpose, { exact: true }).waitFor();
    if (!complaint) await dialog.getByText("Bản giấy có đóng dấu", { exact: true }).waitFor();
    else await dialog.getByText("Điểm học phần", { exact: true }).waitFor();
    assert.equal(await dialog.locator("input, textarea, select").count(), 0, "submitted form is read-only");
    await shot("desktop-popup");
    await page.keyboard.press("Escape");
    assert.equal(await card().getByRole("button", { name: "Xem đơn đã gửi" }).evaluate(el => el === document.activeElement), true);
    const baselineWrites = writes;
    await page.locator("#chatbot-question").fill("Đơn hiện đang ở trạng thái nào?");
    await page.locator("#chatbot-question").press("Enter");
    await page.getByRole("log").locator("article").nth(1).waitFor();
    assert.equal(await card().count(), 1);
    assert.equal(await page.getByRole("log").evaluate(el => {
      const children = [...el.children];
      return children.findIndex(child => child.getAttribute("aria-label") === "Đơn đã gửi trong hội thoại") < children.map(child => child.tagName).lastIndexOf("ARTICLE");
    }), true, "submission stays before later chat replies");
    await page.getByRole("button", { name: "Trò chuyện mới", exact: true }).click();
    assert.equal(await card().count(), 0, "new thread has no unrelated submitted card");
    await page.getByRole("navigation", { name: "Lịch sử hội thoại" }).getByRole("button", { name: complaint ? "Tôi muốn khiếu nại điểm thi Có hồ sơ" : "Xin giấy xác nhận để miễn điểm danh Có hồ sơ", exact: true }).click();
    await card().waitFor();
    assert.equal(await page.locator("#workspace-form").isVisible(), false);
    await page.reload();
    await page.getByRole("navigation", { name: "Lịch sử hội thoại" }).getByRole("button", { name: complaint ? "Tôi muốn khiếu nại điểm thi Có hồ sơ" : "Xin giấy xác nhận để miễn điểm danh Có hồ sơ", exact: true }).click();
    await card().waitFor();
    if (kind === "certificate") {
      for (const width of [1024, 768, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await fit();
        dialog = await view();
        await dialog.getByText(profile.mssv, { exact: true }).waitFor();
        assert.ok((await dialog.boundingBox()).width <= width);
        await fit();
        if (width === 390) await shot("mobile-popup");
        await page.getByRole("button", { name: "Đóng đơn đã gửi" }).click();
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole("button", { name: /Tài khoản/ }).click();
      await page.getByRole("button", { name: "Chuyển sang giao diện tối" }).click();
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
      await shot("dark-card");
      await view();
      await shot("dark-popup");
      await page.keyboard.press("Escape");
    }
    assert.equal(writes, baselineWrites, "viewing, retrying and follow-up chat never resubmit the request");
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, []);
    results.push({ scenario: kind, ok: true, ticketWrites: writes, backend: "intercepted API fixtures", browserErrors: errors });
  } catch (error) {
    console.error(kind, error);
    try { await shot("failure"); } catch { /* Browser may already be closed. */ }
    throw error;
  } finally { await context.close(); }
}
try {
  for (const kind of ["certificate", "pending", "complaint"]) await scenario(kind);
  const report = { ok: true, results, screenshots: output };
  writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
