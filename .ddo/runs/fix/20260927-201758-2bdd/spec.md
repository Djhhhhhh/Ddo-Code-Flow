# 去 worktree-info 审计产物 Spec

> 本文档用于确认 agent 是否正确理解用户关于「去掉 worktree-info.json 审计产物、注册信息全收敛进 state.git」的需求。

---

## 对齐摘要

- 用户目标：删除 git-worktree 任务的 worktree-info.json 登记产物机制，worktree 注册信息唯一来源收敛为 `.state.json` 的 `state.git`。
- 期望交付：任务定义（config / prompt / schema）、SKILL.md 文档、相关测试同步去除此机制，全套测试通过。
- 关键边界：注册链路本身（run start 时 git-info 推断链自动捕获 `branch` / `worktreePath`）已实现且正确，本次不改动——只移除多余的审计产物层。
- 当前状态：无阻塞问题，等待用户批准。

---

## 用户目标

- 去掉 worktree-info.json 这个审计登记产物机制。
- worktree 注册信息全收敛进 state（`state.git`），不再有任务侧登记文件。

---

## 范围与非目标

### In Scope

- git-worktree 任务不再声明与产出 worktree-info.json：config 的 `output` 声明移除、`git-worktree.output.schema.json` 删除、prompt 的「后置登记」步骤及相关表述移除。
- SKILL.md 中对 worktree-info.json 的描述（职责分层「审计登记」措辞、收尾节「审计登记产物」句）同步移除。
- 测试同步：exec.test.js 中断言该产出契约存在的用例改为断言不存在。
- 保持注册链路与全部消费方行为不变（回归验证）。

### Non-goals

- 不改动 `state.git` 字段集（保持 `mainBranch` / `branch` / `worktreePath` 三字段），不把 worktree-info.json 中的 `type` / `baseRef` / `createdAt` / `worktreeDir` 迁移进 state。
- 不改动 git-info 推断链（`tools/lib/git-info.js`）与 CLI 命令面。
- 不改动其他原子任务、workflow 预设与 tools 内核逻辑（机制核对确认 `output` 缺省路径均有兜底，无需改内核）。
- 不修改历史 run 产物（`.ddo/runs/` 下旧 run 的文档与 state 是历史记录，其中的 worktree-info.json 引用不动）。

---

## 需求对齐

| ID | Agent 对需求的理解 | 来源 | 成功结果 |
|---|---|---|---|
| FR-1 | git-worktree 任务不再产出 worktree-info.json：config 移除 `output` 声明、删除对应 output schema 文件、prompt 移除「后置登记」步骤。 | 用户原始要求 | AC-2 |
| FR-2 | worktree 注册信息唯一来源为 `state.git`（run start 时 git-info 推断链捕获），本次变更不得破坏该链路与其消费方（workdir 解析、cleanup-worktree、closeout-worktree）。 | 用户原始要求 + 项目事实 | AC-5 |
| FR-3 | 任务与文档中不再残留 worktree-info.json 机制描述：prompt 误用条款改为纯报告误用、约束条款去掉「登记产物」措辞、SKILL.md 两处引用移除。 | 用户原始要求 | AC-3 |
| FR-4 | 测试同步更新：原断言「产出契约存在」的 exec 用例改为断言不存在，全套测试通过。 | 用户原始要求 | AC-1、AC-4 |

---

## 约束与保留术语

- 保留用户术语：`worktree-info.json`、`注册`、`state.git`、`审计登记产物`（作为被移除对象的指称）。
- 项目硬边界（事实约束）：运行期不写 skillRoot；产物改动发生在代码工作目录（本 run 的 worktree 分支）；不修改 `.gitignore`。

---

## 解释与假设

| 类型 | 内容 | 依据或原因 | 若错误的影响 |
|---|---|---|---|
| Interpretation | 「注册信息全收敛进 state」指 `state.git` 现有三字段（`mainBranch` / `branch` / `worktreePath`）即构成全部注册信息；worktree-info.json 独有的 `type` / `baseRef` / `createdAt` / `worktreeDir` 四个审计字段随产物一并消失，不迁移进 state。 | 用户采用的表述源自检查轮结论——该表述明确以 state.git 现有字段集定义「注册信息」；且注册由零参数推断链产出，结构上无法携带创建时点信息。 | 若用户实际希望审计字段也进 state，则 `state.git` 字段集需扩展、推断链需引入新信息源，交付范围显著扩大。 |

---

## 留给 Planning

- **PD-1**：测试用例的改写形式——保留用例改为 `doesNotMatch` 断言，还是拆分/合并断言点。
- **PD-2**：git-worktree config 的 `version` 是否随契约变更加版（如 2.1.0 → 2.2.0）及具体版本号。

---

## 成功结果

| ID | 用户可观察的结果 | Validates | 来源 |
|---|---|---|---|
| AC-1 | `exec --task git-worktree` 组装出的 prompt 不再包含「Output Contract（产出契约：worktree-info.json）」块。 | FR-4 | 用户原始要求 |
| AC-2 | `atom-tasks/git-worktree/` 下：config.json 无 `output` 声明，目录内无 `git-worktree.output.schema.json`，prompt.md 无「后置登记」步骤。 | FR-1 | 用户原始要求 |
| AC-3 | SKILL.md 与 git-worktree prompt.md 全文检索不到 `worktree-info` 引用。 | FR-3 | 用户原始要求 |
| AC-4 | `node --test tools/tests/*.test.js` 全部通过。 | FR-4 | 用户原始要求 |
| AC-5 | worktree 场景下 `run start --project <工作树>` 产出的 state 仍自动含 `git.branch` 与 `git.worktreePath`（本 run 自身即为在跑的回归证据）。 | FR-2 | 项目事实 + agent 解释 |

---

## 用户确认

当前无待确认的阻塞问题，用户可以：

- ✅ **同意**：批准当前 spec，进入 Planning。
- ❌ **修改：<反馈>**：修改本 spec，展示变化后重新确认。
- ❓ **提问：<问题>**：仅答疑；如需据此改动，必须随后明确选择 `修改`。
