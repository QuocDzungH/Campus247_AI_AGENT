# Prompt prototype — dán vào Antigravity

Copy khối dưới đây. Trước khi chạy, để Antigravity đọc `docs/Pipeline-L2-L3-L4.md` và `docs/Quy-trinh.md`.

```text
## Objective
Build a clickable React/Next.js prototype of Campus 24/7 that can demo the locked pipeline: student-certificate request (two human review gates) and L4 complaint handover. Mock data only. This prototype becomes the real frontend later.

## Before you write UI
1. Produce an Artifact first: screen list, route map, component map. Stop and wait for approval before scaffolding.
2. Load and apply these skills: ui-ux-pro-max, taste-skill, and glassmorphism (taste-skill Surfaces/Depth/Glass). Do not skip them.
3. Read docs/Pipeline-L2-L3-L4.md and docs/Quy-trinh.md. Ground every screen in that pipeline. Do not invent extra product flows.

## Context
- Product: 24/7 AI academic-ops assistant for a university (Vietnamese UI).
- Demo accounts: SV001 Nguyễn Văn An · OF001 Cán bộ hỗ trợ học vụ.
- Sample ticket: TKT-2026-0142.
- AI does almost the whole process. Humans only review immediately before each submit.
- Submit 1 (student): submit a REQUEST (ticket) into the school system. NEVER say the paper PDF was issued or signed.
- Submit 2 (officer): send a reply or complete the ticket. Reply MUST NOT auto-resolve. Only "Hoàn tất xử lý" sets resolved.
- AI on L3 prepares priority, summary, checklist, and a draft reply that is NOT sent until the officer reviews.
- L4: detect complaint/sensitive/over-permission → stop AI → handover ticket complaint + high + handover_reason.
- Ask-only regulation questions stay L1 (citation, no ticket).
- Room booking is OUT OF SCOPE. Do not add it.

Status labels (text + color, never color alone):
- open = Mới tiếp nhận
- pending_officer = Chờ cán bộ
- resolved = Đã hoàn tất
- priority Cao / Bình thường

## Target State
A Next.js App Router + TypeScript + Tailwind app with in-memory mock state covering these screens, all in Vietnamese:

1. Login — two cards: student SV001, officer OF001
2. Student chat — ask ≠ submit; citation card; CTA "Tạo yêu cầu cấp giấy"
3. Submit 1 modal — preview họ tên, MSSV (prefilled), loại giấy = Giấy xác nhận sinh viên, mục đích; Hủy / Xác nhận
4. After Submit 1 — success card with real-looking ticket code + Mới tiếp nhận; copy: đã nộp yêu cầu, not giấy đã cấp
5. L4 handover — amber banner, AI stopped, composer = "Gửi thông tin bổ sung cho cán bộ…", ticket Chờ cán bộ + Cao + handover_reason
6. Yêu cầu của tôi — only SV001 tickets; status matches officer portal
7. Officer dashboard — AI-sorted: high first; filters status/priority/type/code; one-row search for TKT-2026-0142; NO room-booking rows to approve
8. Ticket detail — AI dossier (summary, fields, checklist, unsent draft); Gửi phản hồi / Yêu cầu bổ sung / Hoàn tất xử lý; after reply status is still not Đã hoàn tất until Hoàn tất

Demo click-path MUST work:
Login SV → ask how to get the paper (no ticket) → create request → preview → confirm → see TKT code → Yêu cầu của tôi.
Login OF → see that ticket with AI summary, high-urgency row above a normal giấy row → open → send reply (not resolved) → complete.
Login SV → L4 complaint → AI silent → ticket on queue with handover_reason.

Banner on every screen: Bản mẫu · Dữ liệu giả lập

## Visual direction (MUST)
Apply ui-ux-pro-max + taste-skill + glassmorphism:
- Domain persona: calm campus academic ops, not a generic AI SaaS, not a lab LIMS, not purple-gradient AI slop.
- Glass: frosted panels (backdrop-blur), hairline borders white/8–12% opacity, inset top highlight, depth by surface lightness not heavy drop shadows.
- Accent as light: primary #2457D6. Success emerald, warning amber (handover), AI violet used sparingly on AI summary/draft chips only.
- Prefer a refined light campus field (#F5F7FB) with glass cards, or a tinted-slate dark campus if contrast is stronger — pick one system and stay consistent. NEVER pure #000 backgrounds. NEVER neon rainbow gradients. NEVER identical rounded-3xl cards everywhere.
- Inter (or Geist) for UI. Tabular nums on ticket codes and timestamps. 8px spacing grid.
- Every control: default, hover, active, focus-visible, disabled/loading.
- Badges: color + label text.
- Dashboard: compact density. Student chat: comfortable density.
- Desktop 1440 first; usable at 375.

## Scope
- Work only in a new frontend folder the Artifact proposes (prefer apps/web or frontend/). Do not modify src/ FastAPI, tests, .env, git hooks, or docs/guide.
- Mock store only. No real LLM, no database, no auth provider, no Stitch.
- Do not add dark-mode toggle, marketing landing, signup, room booking, PDF certificate generation, or extra roles.

## Constraints
- Vietnamese UI copy. Demo data only — no real student PII.
- Cancel on Submit 1 creates no ticket. Changing purpose after preview requires a new preview.
- Officer Send does not set resolved. AI never auto-sends the draft.
- Ask before installing any dependency beyond Next, React, TypeScript, Tailwind, Lucide.
- Ask before deleting files, running destructive git, or deploying.
- Do not commit or push.

## Acceptance Criteria
- [ ] Artifact (routes + screens) approved conceptually in the first reply, then code.
- [ ] All 8 screens exist and the two demo click-paths work with mock state.
- [ ] Submit 1 and Submit 2 review gates are visible and cannot be skipped.
- [ ] L4 stops the AI composer; officer sees handover_reason and Cao.
- [ ] No room-booking UI.
- [ ] Glass + campus taste applied; no generic purple AI template.
- [ ] After build, verify in the browser agent at 1440px and 375px: login, Submit 1, officer reply ≠ complete, L4 handover.

## Action Boundaries
Proceed with in-scope scaffold and mock UI after the Artifact.
Stop and ask before destructive commands, new SaaS services, or expanding past the 8 screens.
```
