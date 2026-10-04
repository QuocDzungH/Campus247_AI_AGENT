# Pull requests — Gate 2

Snapshot GitHub ngày 04/10/2026, Asia/Phnom_Penh. Có **9 PR merged**, cần ít nhất **10**, còn thiếu **1**.

| PR | Nội dung | Nhánh đích | Merged at (UTC) |
| --- | --- | --- | --- |
| [#1](https://github.com/AI20K-Build-Phase-Cohort-4/P-120/pull/1) | docs: add EDU-14 Gate 1 project documentation | `main` | 2026-09-18T16:48:44Z |
| [#2](https://github.com/AI20K-Build-Phase-Cohort-4/P-120/pull/2) | docs: add Gate 1 business requirements | `main` | 2026-09-18T16:49:08Z |
| [#4](https://github.com/AI20K-Build-Phase-Cohort-4/P-120/pull/4) | refactor: move backend into campus247 monorepo layout | `develop` | 2026-09-29T09:06:42Z |
| [#5](https://github.com/AI20K-Build-Phase-Cohort-4/P-120/pull/5) | ci: use self-hosted runners for backend and frontend jobs | `develop` | 2026-10-03T04:20:43Z |
| [#6](https://github.com/AI20K-Build-Phase-Cohort-4/P-120/pull/6) | feat(frontend): rebuild student and staff workspaces with audited mock flows | `develop` | 2026-10-03T04:20:22Z |
| [#7](https://github.com/AI20K-Build-Phase-Cohort-4/P-120/pull/7) | ci: isolate self-hosted jobs with Postgres and frontend tests | `develop` | 2026-10-04T09:31:21Z |
| [#8](https://github.com/AI20K-Build-Phase-Cohort-4/P-120/pull/8) | fix(frontend): rename test loader variable to satisfy eslint | `develop` | 2026-10-04T09:35:23Z |
| [#9](https://github.com/AI20K-Build-Phase-Cohort-4/P-120/pull/9) | ci: add frontend test:regression script for required CI job | `develop` | 2026-10-04T09:39:13Z |
| [#10](https://github.com/AI20K-Build-Phase-Cohort-4/P-120/pull/10) | feat: wire Campus 24/7 frontend to P0 API, agent, and officer workflow | `develop` | 2026-10-04T10:37:08Z |

PR #10 đã tích hợp frontend/backend/agent vào `develop`. Nhánh Gate 2 hoàn
thiện tài liệu nộp và regression/evidence, là phần việc có nội dung riêng để
review. [PR description chuẩn bị sẵn](pr-description.md).

Khi PR Gate 2 được review và merge, lấy snapshot lại:

```bash
gh pr list --repo AI20K-Build-Phase-Cohort-4/P-120 --state merged --limit 1000 --json number,title,mergedAt,baseRefName,headRefName,url > docs/gate-2/merged-prs.json
```

Đếm `mergedAt` từ GitHub, không thay bằng số commit/merge nhánh local. Không
merge PR prototype cũ chỉ để tăng số lượng nếu không phù hợp bản MVP hiện tại.
