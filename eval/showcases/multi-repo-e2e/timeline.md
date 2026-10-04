# E2E 时间线（2026-10-04 18:43–18:52，沙箱 /tmp/ddo-multi-e2e）

1. 沙箱搭建：svc-api（main）+ svc-web（develop）各一空提交；svc-web 显式 `init.defaultBranch=develop`。
2. git-worktree multi 前置：title「联动改造：API 与 Web 同步新增版本端点」→ 分支 `feat/api-web-version` → 容器 `svc-api-feat-api-web-version`（mkdir）→ 逐仓库 `git worktree add`（svc-api、svc-web 子目录）。
3. `run start --project <容器> --multi-repos svc-api,svc-web` → runId 20261004-184422-3906；state 见 artifacts/state-multirepo.json。
4. requirement:01 产出 requirement.md → validate ✅ → next（spec 点亮）。
5. spec:01 产出 spec.md → validate ✅ → next → gate present → 同意。
6. plan:01 产出 plan.md（14 必需节）→ validate ✅ → next → gate present → 同意。
7. coding:01 exec → **多仓库 ctx 映射注入**（artifacts/coding-ctx.md）→ 两工作树各落改动（version.txt / index.html）→ validate → next → gate present → 同意。
8. reporting:01 产出 execution-report.md → validate ✅ → next → `completed: true`。
9. `run finish --status done` → 归档 zip 至 <DDO_HOME>/history/，runs.jsonl 追加。
10. cleanup-worktree：`git worktree remove` 首次被拒（未提交改动——设计拦截生效）→ 两工作树各自提交 → 逐仓库移除成功 → 容器仅剩 `.ddo`（保留），分支保留。
