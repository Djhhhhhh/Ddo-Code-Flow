# 执行报告 — 20260927-203522-3f01

> 汇总各阶段产物与验证结果的完整执行报告。

---

## 运行元数据

- runId: 20260927-203522-3f01
- title: runId 目录创建可配与 state 居所设计
- startedAt: 2026-09-27T20:35:22.216+08:00
- workflow: basic（requirement → spec → plan → coding → reporting）
- git: branch `feat/runid-dir-config-state-home`，worktree `/Users/djhhh/work_area/Ddo-Code-Flow-feat-runid-dir-config-state-home`（基线 main @ f24475c）

---

## 用户需求（原文）

> 现在 pr的 workflow 存在问题啊，每次生成这个都会额外创建一个 runId 的目录，这个增量太快了，而且这个信息本质上不应该要保留这个runs信息，这个问题该怎么解决

冷启动澄清（BQ 问答原话）：

> 我的期望时正常入版控的，期望需要可以配置是否要创建，但是这也存在问题，因为本质上.state.json这个是必须要创建的，这个需要设计一下

---

## 各阶段产物

| 阶段 | 状态 | 产物 |
|---|---|---|
| requirement | ✅ done | requirement.md |
| spec | ✅ done | spec.md（BQ-1~3 解决写回，revision 2 语义） |
| plan | ✅ done | plan.md（single 模式，revision 1，DEC-1~5） |
| coding | ✅ done | 代码变更（见下「实施清单」） |
| reporting | 🔄 running | execution-report.md（本文件） |

实施清单（coding 产物 = 代码变更本身）：

- `tools/cli.js`：runStart 旗标解析 + runDir 居所分叉 + `state.ephemeral` 标记 + `--dir-name` 互斥；runFinish 临时分支（免归档 → 删 runDir → index 移除）；runGuide 第四问（home）+ hint；runMeta 改优先 `state.dirs`；resume `--project` 过滤增 dirs 归属（`resumeRow` 抽取）；BOOLEAN_FLAGS 追加；命令表 desc 更新
- `tools/lib/state.js`：assertState 增 `ephemeral` 可选布尔校验；assertDirs 增居所例外参数
- `tools/lib/workdir.js`：resolveWorkdir 优先 `state.dirs.projectRoot`（tmp 布局下 statePath 上溯失效）
- `tools/lib/index-registry.js`：新增 `tmpRunsHome()`（`<home>/tmp/ddo`）
- `atom-tasks/closeout-worktree/prompt.md`：产物入库/终态入库按 `state.ephemeral` 条件化；收口指引增临时语义
- `SKILL.md` / `README.md`：临时模式文档（运行位置例外、生命周期、guide 四问、命令表、目录语义）
- 测试：start.test.js（+3 用例：tmp 布局零创建 / 互斥 exit 2 / 缺省回归）、lifecycle.test.js（+1：finish 零残留三断言 + 成功后重跑不可入）、resume.test.js（+1：dirs 归属与全局元数据）、present.test.js（guide 四问断言升级）

---

## 验证摘要

### 统计

验证日志产物缺失（basic 链无 verification 阶段）；coding 自检循环实测 `node --test tools/tests/*.test.js` **两轮 118/118 通过**（含 5 项临时模式新增用例与全量既有回归——AC-1「正常模式零变化」由既有套件背书）。冒烟另证：沙箱 HOME 下 `run start --ephemeral` → exec 照常 → `run finish` 返回 `{ephemeral:true, deleted:true}`，项目内无 `.ddo` 创建、tmp runId 目录消亡。

### 修复记录

- 无失败条目（两轮自检均一次通过）。
- 实施偏差记录（对 plan 的诚实修正）：plan 算法节「幂等：目录已不存在时 force: true 静默通过，重跑 finish 直接完成 ③」表述不准——成功收口后 state 随 runDir 消亡，重跑 finish 因 state 不可读 exit 1（ENOENT）。rmSync force 的幂等仅服务半失败流（删除成功而 unregister 失败的罕见场景，此时 index 残条目被 resume 惰性淘汰兜底）。行为符合 DEC-3 的顺序不变量与失败语义，测试断言按真实行为落笔。

---

## 决策日志

state 无 `history` 字段（v2 留痕位于 `stages[k].gate`），门决议留痕原样引用：

- spec 门 in-phase 交互 ×3（2026-09-27T20:42:16+08:00）：
  - `回答BQ-1` note:「这个是否可以落到用户根目录下的tmp里面，然后执行完成后直接删掉临时文件」
  - `回答BQ-2` note:「保持现状，只是针对这种case我理解需要做特殊配置」
  - `回答BQ-3` note:「理解我刚才说的，现在我理解你理解的方向有问题」
- spec 门决议 `同意`，closedAt 2026-09-27T20:43:41.533+08:00（方向修正后 revision 重写送审）
- plan 门决议 `同意`，closedAt 2026-09-27T20:49:53.633+08:00（revision 1 一次通过）

---

## 核心文档

- [spec.md](spec.md)——对齐 spec（FR-1~4 / AC-1~5 / BQ 全解决）
- [plan.md](plan.md)——技术 plan（DEC-1~5 / 文件变更计划 / Verification Anchor）
- test-plan.md：不适用（basic 链无 test-plan 阶段；验证锚点见 plan.md Verification Anchor 节）
