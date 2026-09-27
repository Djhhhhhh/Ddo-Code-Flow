# 去 worktree-info 审计产物 Plan

> 基于已确认 spec（revision 1）生成的技术 Plan。文档模式：single（草稿约 6.5k 字符，≤ 12000 阈值）。

---

## 执行摘要

本 Plan 指导一次纯移除式变更：删除 git-worktree 任务的 worktree-info.json 登记产物机制（config `output` 声明、output schema 文件、prompt「后置登记」步骤），同步清理 SKILL.md 两处引用与 exec.test.js 断言。注册链路（`run start` 时 git-info 推断链第三档捕获 `state.git.branch` / `worktreePath`）已实现且正确，本次零改动、仅回归验证。机制核对确认 `output` 缺省在 tools 内核全部路径（契约注入 / validate / rollback 归档 / schema 加载）均有兜底，无需改内核。

---

## 范围与非目标

| 事项 | 说明 | AI 索引 |
|---|---|---|
| git-worktree 任务定义 | config 移除 `output` 声明并加版、删除 schema 文件、prompt 移除「后置登记」步骤与「登记产物」措辞 | FR-1、FR-3 |
| SKILL.md 文档 | 移除「审计登记」职责措辞与收尾节「审计登记产物」句 | FR-3 |
| 测试同步 | exec.test.js 的 git-worktree 用例断言翻转 | FR-4 |
| 注册链路回归 | state.git 捕获与消费方行为保持不变 | FR-2 |
| 非目标 | 不动 `state.git` 字段集、git-info 推断链、CLI 命令面、其他任务、workflow 预设、tools 内核、历史 run 产物 | spec Non-goals |

---

## 现有设计与复用基线

| 能力 | 文件路径 | 符号 | 证据类型 | 采用方式 | 适用边界 | AI 索引 |
|---|---|---|---|---|---|---|
| 契约注入守卫：`typeof decl === 'string'` 才注入 Output Contract，缺省自然跳过 | tools/lib/assemble.js | `assemble()` 内 contract 注入块 | Repository Fact | 复用现有实现 | 本次仅需移除声明，注入逻辑零改动 | DEC-3 |
| 产物校验定位：`entry.output \|\| cfg.output \|\| null`，null 即无产物校验 | tools/cli.js | validate 命令产物定位 | Repository Fact | 复用现有实现 | config 无 output 后 validate 对该任务自动跳过 | DEC-3 |
| 回滚归档收集：`cfg.output !== undefined` 才入声明集 | tools/cli.js | 阶段 output 声明文件全集 | Repository Fact | 复用现有实现 | 无声明即无归档动作 | DEC-3 |
| schema 惰性加载：文件不存在返回 null | tools/lib/output-schema.js | `loadTaskSchema()` | Repository Fact | 复用现有实现 | schema 文件删除后加载安全 | DEC-3 |
| config 契约：`output` 非必填（必填仅 name/version） | atom-tasks/_schema/task-config.schema.json | `required: [name, version]` | Repository Fact | 复用现有实现 | 移除声明后 config 仍合规 | DEC-3 |
| 注册链路：worktree 探测捕获 branch/worktreePath | tools/lib/git-info.js | `gitInfo()` 第三档 | Repository Fact | 复用现有实现 | 本次回归锚点 | FR-2 |
| 消费方读 state：工作目录解析与两收尾任务 | tools/lib/workdir.js、atom-tasks/cleanup-worktree/prompt.md、atom-tasks/closeout-worktree/prompt.md | `resolveWorkDir()` 等 | Repository Fact | 复用现有实现 | 均不读 worktree-info.json，零影响 | FR-2 |

---

## 整体架构与流程

变更后 worktree 注册链路（唯一路径，无任务侧登记产物）：

```mermaid
flowchart LR
    A[冷启动问答<br/>title + mode=single] --> B[git-worktree 前置动作<br/>建分支 + 工作树]
    B --> C[run start --project 工作树]
    C --> D[git-info 推断链第三档<br/>git-dir ≠ common-dir]
    D --> E[state.git 捕获<br/>branch + worktreePath]
    E --> F[消费方读 state<br/>workdir / cleanup / closeout]
    B -.x. G[worktree-info.json<br/>登记产物——本次移除]
```

异常路径不变：任何 git 失败在 `run start` 之前 fail-fast（无半截 state）；`branch` 探测失败置空串不阻断启动。

---

## 技术选型与方案对比

| 方案 | 来源 | 仓库适配性 | 代价与风险 | 状态 | 结论 | AI 索引 |
|---|---|---|---|---|---|---|
| 纯移除（config + schema + prompt + 文档 + 测试同步） | 初始 Plan | 高——内核兜底齐全，零消费方 | 低——需保证测试同步否则 CI 红 | accepted | 采用 | DEC-3 |
| 保留 output 声明、标记 deprecated | 初始 Plan | 低——违背「全收敛」目标 | 留死代码与误导文档 | rejected | 不采用 | DEC-3 |
| 审计字段迁移进 state.git | 初始 Plan | 低——推断链零参数、无法携带 createdAt 等创建时点信息 | 扩字段集 + 改推断链，范围失控 | rejected | spec 已定 Non-goal，不采用 | DEC-3 |
| 测试断言翻转（doesNotMatch 契约块） | 初始 Plan | 高——保留用例即保留回归护栏 | 无 | accepted | PD-1 答案 | DEC-2 |
| config 加版 2.1.0 → 2.2.0 | 初始 Plan | 高——任务契约变更用 minor 表达 | 无 | accepted | PD-2 答案 | DEC-1 |

---

## 数据模型设计

### 实体与字段

不适用——本次不新增实体。`state.git` 保持 `{ mainBranch, branch, worktreePath }` 三字段（worktree 场景后两字段非空），字段集冻结为 spec Non-goal。

### schema 与 DDL（如适用）

不适用——无数据库。唯一「schema」变更是删除 `git-worktree.output.schema.json` 文件本身；`task-config.schema.json` 对 `output` 本就可选，无需改动。

### 状态与不变量

不变量：`.state.json` 是 worktree 注册的唯一事实源；`runDir ⊂ projectRoot(= worktreePath)`；git-worktree 任务在 state 物化前执行、不写 state。

### 迁移、兼容与回滚

无存量数据需迁移——worktree-info.json 从未被任何代码读取。已存在的旧登记文件（历史 run 产物）按 Non-goal 不清理。回滚即 git revert 单提交。

---

## API 接口设计

| 接口/入口 | 请求 | 响应 | 错误与幂等 | 复用标准 | 实现职责 | AI 索引 |
|---|---|---|---|---|---|---|
| 不适用（无对外接口变更） | 不适用 | 不适用 | 不适用 | CLI 命令面零新增/零修改，`run start --project` 形态不变 | 无 | DEC-3 |

---

## 算法设计

不适用——无非平凡算法变更。分支名提取、基线推断、目录计算逻辑均不变。

---

## 文件变更计划

| 文件/目录 | 变更职责 | 复用或依赖 | AI 索引 |
|---|---|---|---|
| atom-tasks/git-worktree/config.json | 移除 `"output": "worktree-info.json"` 行；version 2.1.0 → 2.2.0 | task-config.schema（output 可选） | FR-1、DEC-1 |
| atom-tasks/git-worktree/git-worktree.output.schema.json | 整文件删除 | loadTaskSchema 缺文件返回 null | FR-1 |
| atom-tasks/git-worktree/prompt.md | 首部误用条款「仅按 Output Contract 补登记」改为「不执行动作、报告误用」；删除步骤 6「后置登记」；约束条款「只做 Git 层动作与登记产物」改为「只做 Git 层动作，不产出任何登记文件」 | — | FR-1、FR-3 |
| SKILL.md | 职责分层「分支名提取 / git 建库 / 审计登记」去「审计登记」；收尾节删「worktree-info.json 为审计登记产物，state 不读取。」句 | — | FR-3 |
| tools/tests/exec.test.js | git-worktree 用例：标题去「产出契约」表述、末条断言改为 `doesNotMatch /## Output Contract/`（注释说明注册收敛进 state） | 现有 sandbox/cli 测试设施 | FR-4、DEC-2 |

---

## 兼容、稳定性与回滚

| 关注点 | 适用性 | 设计/理由 | 回滚信号 | AI 索引 |
|---|---|---|---|---|
| 内核兼容 | 适用 | output 缺省在契约注入/validate/归档/schema 加载四路均有兜底（复用基线） | 测试套红 | DEC-3 |
| 消费方兼容 | 适用 | workdir/cleanup/closeout 全部读 state.git，零读取登记文件 | 同上 | FR-2 |
| 文档一致性 | 适用 | SKILL.md 与 prompt 同 PR 内同步，不留悬空引用 | grep `worktree-info` 命中源码/文档 | FR-3 |
| 回滚 | 适用 | 单 commit 纯移除，revert 即恢复 | 需恢复登记产物机制时 | DEC-3 |

---

## Verification Anchor

| 需验证契约 | 可观察结果 | 证据位置 | AI 索引 |
|---|---|---|---|
| AC-2 | git-worktree 目录无 schema 文件、config 无 output、prompt 无步骤 6 | atom-tasks/git-worktree/ | FR-1 |
| AC-3 | 全文检索 `worktree-info` 仅历史 run 产物命中 | grep 于源码与文档 | FR-3 |
| AC-1 + AC-4 | exec git-worktree 无契约块断言通过；全套 node --test 绿 | tools/tests/exec.test.js | FR-4 |
| AC-5 | 本 run state 含 git.branch=fix/drop-worktree-info 与 worktreePath | 本 run .state.json | FR-2 |

---

## 开放问题与 Spec 对应

| 问题 | 确定答案或阻塞原因 | 解决位置 | AI 索引 |
|---|---|---|---|
| PD-1 测试改写形式 | 保留用例、断言翻转为 doesNotMatch——保留回归护栏 | DEC-2 / 文件变更计划 | PD-1 |
| PD-2 config 加版 | 2.1.0 → 2.2.0（任务契约变更，minor） | DEC-1 / 文件变更计划 | PD-2 |

无阻塞项。

---

## 风险与下游交接

- 风险与缓解：唯一实质风险是测试与任务定义不同步导致 CI 红——Coding 阶段五文件同批落盘后立即跑全套测试。
- Tasking/Coding 读取范围：本 plan.md（single 模式，无分册）；spec 的 FR-1～FR-4 为验收锚点。
- 事实失效处理：若 Coding 时发现内核存在未列的 output 强依赖路径（与复用基线矛盾），停止并报告，不得自行改已批准契约。

---

## 用户确认

- 同意
- 修改：<反馈>
- 提问：<问题>
- 归档
- 归档：<模板名>
