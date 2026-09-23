# 工作项 11 · artifact-lifecycle — 设计方案

> 版本：**v1.1（2026-09-24 已实现）**——P1–P4 经用户评审全部按建议定稿（~/.ddo / 移动 / 同址+dirs / 重置集合），plan 门通过；v1.0 定稿后完成实现与测试
> 需求依据：[requirement.md](./requirement.md)（需求输入 1–5 + Q1–Q4）
> 契约基线：[../02-index-structure/plan.md](../02-index-structure/plan.md) v1.4、[../04-cli-commands/plan.md](../04-cli-commands/plan.md) §2.2（_del 契约）、[../05-atom-tasks/plan.md](../05-atom-tasks/plan.md)（config output 声明 = 归档清单数据源）

## 1. 目录语义定版（需求 4）

三个目录，各有名分；state 显式携带，杜绝猜路径：

```text
┌─ projectRoot ──────────────────────────────────────────────┐
│  代码改动发生地（版控根）。worktree 场景下代码工作目录为      │
│  git.worktreePath（09-coding-worktree 线的判定，本轮对齐）   │
│                                                             │
│  .ddo/runs/<type>/<dirName>/  ← runDir（run 工作目录 =      │
│      流水线产物目录，二者同址，见 §1.1）                     │
│      .state.json     唯一事实源（活文件）                    │
│      spec.md / plan.md / …   流水线文档产物（随项目 VCS）    │
│      _del/rollback-<n>/      失效/回滚产物归档              │
└─────────────────────────────────────────────────────────────┘

~/.ddo/（DDO_HOME，用户主目录）
    index.json                    运行中指针（不变）
    history/runs.jsonl            结束摘要行（不变）
    history/<runId>/.state.json   ★ 新增：结束时的 state 归档副本
```

### 1.1 术语表（定版）

| 术语 | 定义 | 判定 |
|---|---|---|
| **projectRoot（项目根）** | 版控根，代码与 `.ddo/` 的家 | `run start --project`（缺省 cwd） |
| **代码工作目录** | 代码改动发生地 | `git.worktreePath` 非空 → worktree；否则 projectRoot（09-coding-worktree 线定义，本轮只引用） |
| **runDir（run 工作目录 = 流水线产物目录）** | `.state.json` 与流水线文档产物的唯一合法居所 | `projectRoot/.ddo/runs/<type>/<dirName>/`，dirName 缺省 = runId |

**设计取舍（P3）**：run 工作目录与产物目录**同址不分家**——现状即如此且运转良好（validate 以
`dirname(statePath)` 为锚）；分开成 `artifacts/` 子目录只会迁移锚点、无新收益。定版靠**命名 +
state 显式化 + 防线**，不靠搬家。

### 1.2 state 扩展：`dirs` 字段（02 基线 → v1.5）

```json
"dirs": {
  "projectRoot": "/abs/project",
  "runDir": "/abs/project/.ddo/runs/feat/20260924-…-xxxx"
}
```

- `run start` 物化时写入（runDir 即 state 所在目录，从此 first-class，不再靠 dirname 推导）；
- `assertState` 校验形态（两绝对路径，runDir 必须位于 projectRoot 之下）；历史 state（无 dirs）
  容错：缺失时各消费方回落 `dirname(statePath)`——向后兼容，不强制迁移；
- 消费约束：**文档产物只允许写进 runDir**（output 声明防逃逸，§4）；代码只允许写进代码工作目录
  （coding 语义，归 09-coding-worktree 线）。

## 2. `.state.json` 生命周期（需求 1）

```text
执行中      活文件驻留 runDir（唯一事实源，现行不变）
结束时      run finish 结束迁移新增一步（顺序见下）：copy state →
              ~/.ddo/history/<runId>/.state.json（递归建目录；幂等覆盖）
            原文件不动，随项目版控走
```

- 归档副本用途：per-run 追溯 + 10-O3「自我进化」的数据地基（自定义链频次分析读这里，
  不碰项目内文件）；
- 迁移顺序更新：① history/<runId>/ 归档 copy → ② runs.jsonl 追加行 → ③ index 移除 →
  ④ currentStage 清空。崩溃窗口分析：①② 重复执行幂等（copy 覆盖 / JSONL 重复行由读取方容忍），
  最坏残留均被惰性校验兜住——不丢记录的原则不变；
- `history/<runId>/` 目录内未来可放更多归档物（产物快照等），本轮只放 state。

## 3. 失效/回滚产物归档（需求 3，激活 04 §2.2 契约）

```text
触发:   rollback --stage <target>
清单:   重置集合（target + DAG 路径节点）内各阶段 config 声明的 output 文件
        （字符串产出 + {updates} 写回清单），存在才归档（缺失跳过）
动作:   移动（P2 推荐）→ <runDir>/_del/rollback-<n>/<原文件名>
        n = _del/ 下现有 rollback-* 最大编号 + 1（扫描目录推导，不加 state 字段——04 契约）
        一次 rollback 的全部文件进同一个 rollback-<n>/（多阶段重置汇总隔离）
输出:   rollback 返回值新增 archivedTo: "_del/rollback-<n>" 与 archived: [文件名…]
之后:   重做阶段重新生成本产物（新文件落 runDir，旧版留在 _del 可追溯）
```

- 语义细节：**移动**而非删除（保留历史）也非复制（原位留着会让重做新旧混淆——04 契约本意）；
- 「被标记为失效」（BQ 答案引发的 spec 改写等）**不进 _del**——那是相位内更新，原地改写并
  保留稳定 ID（spec prompt 语义）；_del 只收「整阶段作废重来」的产物。本轮不引入额外的
  失效标记命令（真实需求出现再立项）；
- 已知边界（记录不改）：重置阶段若有不在重置路径上的已完成并行分支曾消费其产物，
  产物仍会被归档——该分支产物已生成，消费已完成，不影响其 done 状态。

## 4. 产物落点防线（需求 4 的「保证」部分）

1. **output 声明防逃逸**：validate / exec（Output Contract 注入）/ rollback 归档清单——
   声明的文件名一律拒绝绝对路径与 `..` 逃逸（校验点：validateTaskConfig 的语义层 + 运行时
   拼路径前断言 `resolve(runDir, file)` 仍在 runDir 内）；
2. **runDir 显式化**（§1.2）后，hook 拿到的锚点从「statePath 推导」升级为「state 声明」，
   写错目录属于可检出的契约违约；
3. 本轮不改 hook 签名（statePath 仍在），dirs 是加强不是替换。

## 5. 实现清单（plan 门通过后执行）

| 文件 | 动作 | 内容 |
|---|---|---|
| `tools/cli.js` | 扩展 | run start 写 `dirs`；run finish 增归档 copy 步骤；rollback 激活 `_del` 归档（archivedTo/archived）；validate/exec/归档的防逃逸断言 |
| `tools/lib/state.js` | 扩展 | assertState 校验 `dirs` 形态（可选字段：缺失容错历史 state） |
| `tools/lib/history.js` | 扩展 | `archiveState(runId, statePath)`：copy 到 `~/.ddo/history/<runId>/.state.json` |
| `tools/lib/workflow.js` | 扩展 | validateTaskConfig 语义层：output 声明文件名禁绝对路径/`..` |
| `tools/tests/{lifecycle,rollback}_test` | 新增 | §6 用例；rollback 既有用例补归档断言 |
| `SKILL.md` / `README.md` | 更新 | 术语表 + 生命周期图 + 命令行为变化 |

## 6. 测试计划

| 对象 | 用例 |
|---|---|
| dirs | run start 写入两绝对路径且 runDir ⊂ projectRoot；手写 state 缺 dirs → 各命令容错（回落 dirname）不炸 |
| state 归档 | run finish 后 `~/.ddo/history/<runId>/.state.json` 存在且内容等于原文件；原文件仍在；重复 finish 幂等覆盖；runs.jsonl 行不变（既有断言回归） |
| _del 归档 | rollback spec（spec.md 存在）→ 移动至 `_del/rollback-1/spec.md`、原位消失、输出含 archivedTo；二次 rollback → rollback-2；多阶段重置（plan+spec）汇总同一 rollback-n；产物缺失 → 跳过不报错；重做后新 spec.md 落 runDir |
| 防逃逸 | output 声明 `../evil.md` → validateTaskConfig 拒绝；绝对路径拒绝 |
| 回归 | 68 用例全绿 |

## 7. 开放问题

| # | 问题 | 状态 |
|---|---|---|
| O1 | 失效标记命令（非 rollback 的显式作废） | 真实需求出现再立项 |
| O2 | history/<runId>/ 内归档更多产物（产物快照） | 后续 |
| O3 | 自定义链频次 → 预设自我进化（读归档 state 分析） | 后续（数据地基本轮就位） |

## 8. 评审要点（本轮强制 plan 门）

| # | 问题 | 建议 |
|---|---|---|
| P1 | 「根目录 .ddo/history」位置：用户主目录 `~/.ddo`（与 runs.jsonl 同址，自我进化分析有全局视野）vs 项目根 `.ddo`（随项目走但多项目会散落） | `~/.ddo`（= DDO_HOME，可用 DDO_HOME 覆写测试） |
| P2 | `_del` 归档：移动（原位消失，重做产新文件——04 契约「清理的文档归档」本意）vs 复制（原位保留，新旧混放） | 移动 |
| P3 | 目录定版方式：术语表 + `dirs: {projectRoot, runDir}` 进 state（run 工作目录与产物目录同址不分家）vs 另设 `artifacts/` 子目录分家 | 前者（分家只迁锚点无收益） |
| P4 | rollback 归档范围：重置集合全部阶段的产物（一次 rollback-n 汇总）vs 仅 target 阶段 | 重置集合（路径上的都作废了） |

## 变更记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.9 | 2026-09-24 | 初稿待评审：目录术语定版（§1）、dirs 字段、state 结束归档（~/.ddo/history/<runId>/）、_del 归档激活（移动语义）、防逃逸防线、实现清单与测试计划、P1–P4 评审点 |
| **v1.0** | 2026-09-24 | **定版**：P1（~/.ddo 即 DDO_HOME）/ P2（移动）/ P3（同址 + dirs 字段，不分家）/ P4（重置集合汇总同一 rollback-n）全部定稿，进入实现 |
| **v1.1** | 2026-09-24 | **实现完成**：`cli.js`（artifactPath / nextDelDir / stageOutputFiles 助手；run start 写 dirs；run finish 归档先行；rollback `_del` 移动归档 + `--tasks-dir`；validate 运行时防逃逸）+ `state.js` assertDirs（可选字段，历史 state 容错）+ `history.js` archiveState + `workflow.js` safeOutputFiles（validateTaskConfig 语义层）。测试：新增 `tools/tests/lifecycle.test.js` 6 用例（dirs / 归档 / _del / 防逃逸），全量 77 用例全绿；真实 atom-tasks E2E 冒烟通过（start → 产物 → rollback `_del/rollback-1` → finish 归档保留收束前位置）。台账联动：02 → v1.5、04 → v1.2 |
