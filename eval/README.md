# eval/ — 评测工作区

ddo-code-flow 的 dogfooding 与评测内容长期归档区：每次评测一个独立沙箱，版本定稿后整理成 showcase。

## 目录约定

| 目录 | 职责 | 生命周期 |
|---|---|---|
| `runs/` | 评测沙箱：每次评测一个独立 projectRoot（自含 `.ddo/runs/` 状态与任务代码产出，互不污染） | showcase 归档后可整体删除 |
| `verify/` | **版本锁定的 dogfooding 验证方法**（playbook）：每纪元一份，含输入清单、重点注意项、执行步骤与比较基准；旧版定稿后冻结，只作历史参照 | 随版控；**版本归属不可丢**——playbook 头部有版本锚定表 |
| `showcases/` | 版本级 showcase 归档：从沙箱与 `~/.ddo/history/` 整理的定稿材料 + 评估结论；被新纪元取代时在目录内加 `STATUS.md` 标注（归档正文零改动） | 长期保留，随仓库提交 |

**playbook 维护约定**：`verify/<纪元>.md` 定稿后冻结（只修笔误）；大迭代时由用户提示新建对应版本 playbook；新增 dogfooding 流程类型（worktree / 并行多门 / history 可视化等）同样由用户发起。当前版本：[verify/v2.1.md](verify/v2.1.md)（旧版 [verify/v2-beta.md](verify/v2-beta.md) 已冻结过期）。

**专项分期（P0 / P1）**：

- **P0（每轮必做）**：测试基线 + standard 全链回归 + 增量机制快验（交互闭环 / zip 归档 / `--no-archive` / `--ephemeral` / guide / exec 三级取值）——见 playbook P0 主链与专项 A/B。
- **P1（按需或里程碑）**：WTT worktree 专项、pr-delivery 交付链专项——涉及真实 Git 分支与 GitHub PR，成本高可延期，但里程碑评审前须补齐（延期规则见 playbook §5）。

## 沙箱规范

- **命名**：`runs/YYYYMMDD-<slug>`（如 `20260924-visualizer-v2beta`）
- **启动**：`run start --project <沙箱绝对路径> ...`——沙箱即 projectRoot，run 状态与任务产出全部落在沙箱内
- **隔离**：默认用真实 `~/.ddo`（注册全局索引，行为最真实）；需要干净环境时 `DDO_HOME=<临时目录>` 覆写

## 快速验证（版本回归用，约五分钟）

完整版见当前版本 playbook：[verify/v2.1.md](verify/v2.1.md)（输入清单 / 重点注意项 / 逐步断言 / 比较基准——版本锁定的详细方法）。最小冒烟：

1. `node --test tools/tests/*.test.js`——全绿（当前 119 用例）
2. `DDO_HOME=$(mktemp -d)` 隔离环境，`run start --project <新沙箱> --workflow basic`
3. 最小闭环：requirement → spec 两相位 + 一次门决议（先 `gate present`，再 `next --decision 同意`）+ 一次 `rollback` + `run finish`
4. 判定：推进/收口全 exit 0，无决议 `next` 与未呈现决议均被拦 exit 1，`~/.ddo/history/<runId>.zip` 归档存在且 `unzip -t` 通过

## 归档流程（run finish 后）

拷贝沙箱 `.ddo/runs/<type>/<runId>/` 全部产物 + `~/.ddo/history/<runId>.zip` 归档 zip（入 `state-archive/`）→ `showcases/<version>/`，附：

- `ASSESSMENT.md`——评估结论（如内测 → 转正式判定）；**开头必带基础信息**：执行主体（宿主 + 模型名）/ 被测工具版本与 commit 基线 / Node / OS / DDO_HOME / 执行窗口 / 测试基线（模板见当前版本 playbook §5）
- `timeline.md`——相位推进 / 门决议留痕 / 异常与中断事件时间线

## 索引

| 沙箱 | 版本 | showcase | 备注 |
|---|---|---|---|
| `runs/20260924-visualizer-v2beta` | v2 内测 | `showcases/v2-beta` | **完成**（2026-09-24，done）：工作流可视化工具，standard 全链 10 阶段 4 门；发现并修复阻断缺陷 D-1（契约占位符字面匹配）；评估结论：建议转正式——见 [showcases/v2-beta/ASSESSMENT.md](showcases/v2-beta/ASSESSMENT.md)。**评测方法已过期**（被 v2.1 纪元取代，见 [STATUS.md](showcases/v2-beta/STATUS.md)） |
| `runs/20260924-visualizer-v2beta-r2` | v2 内测（复验轮 1） | `showcases/v2-beta`（追加记录） | **完成**（2026-09-24，done）：同版本重跑，F5 专项（exec 硬约束，首跑 A-1/A-2 场景）+ 驳回注入（F8）+ D-1 复验全过，结论：通过，无断言失败——见 [showcases/v2-beta/reverify-1.md](showcases/v2-beta/reverify-1.md) |
| `runs/20260929-ddo-dashboard` | v2 内测（dashboard showcase） | `showcases/v2-beta-dashboard` | **完成**（2026-09-29，done）：基于 ~/.ddo/index.json 的开发中需求 dashboard，basic 全链 5 阶段 2 门 + WTT single 场景首次实战（前置建树 → `--project` 落位 → finish 归档）；快照自举两代（coding:01 / reporting:01）；结论：通过——见 [showcases/v2-beta-dashboard/ASSESSMENT.md](showcases/v2-beta-dashboard/ASSESSMENT.md) |
