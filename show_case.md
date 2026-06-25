# ddo-code-flow 执行全景 Show Case

> 本文档以一个**完整的端到端示例**，详细展示一个 AI Agent 理解 `SKILL.md` 后，
> 如何逐步加载配置、校验 DAG、执行每一条原子任务（含创建运行目录）、处理确认门、
> 应对失败与恢复，直到最终生成报告。

---

## 0. 场景设定

| 项目 | 值 |
|---|---|
| 用户输入 | `"使用 ddo-code-flow，为项目添加 dark mode 支持"` |
| 工作目录 | `/Users/djhhh/work_area/Ddo-Code-Flow` |
| 配置文件 | `config.json`（项目根目录） |
| 原子任务目录 | `atom-tasks/`（项目根目录） |

---

## 1. Step 1 — 加载与校验

### 1.1 读取配置

Agent 首先读取两个文件：

```
config.json          → 完整的流水线定义
config.schema.json   → JSON Schema 校验规则
```

Agent 将 `config.json` 的内容与 `config.schema.json` 做逐字段校验：
- 必需字段 `version`、`base`、`pipeline`、`atomTaskOverrides` 是否存在
- `base.targetDir` 是否非空字符串
- `base.confirmationGates` 中的 stage 名称是否符合 `[a-z0-9][a-z0-9-]*` 正则
- `base.metrics.enabled` 是否为布尔值
- 每个 pipeline stage 是否有 `stage`、`atomTasks`、`enabled` 字段

**如果校验失败**：Agent 直接报错并中止，不产生任何产物。

### 1.2 DAG 无环检查

对于每个 stage 的 `atomTasks`，Agent 构建有向图：

```
entry → node → next → ...
```

以 `requirement` stage 为例：

```
entry: ["requirement"]
requirement.next → ["git-worktree"]
git-worktree.next → ["spec"]
```

Agent 用 Kahn 拓扑排序算法检测是否有环。如果有环，报错中止。

### 1.3 旧版兼容（自动升级）

如果某个 stage 的 `atomTasks` 是旧版字符串数组（如 `["a", "b", "c"]`），
Agent 自动转换为 DAG 形式：

```json
// 旧版
"atomTasks": ["requirement", "git-worktree", "spec"]

// 自动升级为
"atomTasks": {
  "entry": ["requirement"],
  "nodes": {
    "requirement": { "next": ["git-worktree"], "parallelApprove": false, "parallelWith": [] },
    "git-worktree": { "next": ["spec"], "parallelApprove": false, "parallelWith": [] },
    "spec": { "next": [], "parallelApprove": false, "parallelWith": [] }
  }
}
```

并**持久化**回写 `config.json`，同时告知用户 schema 已自动升级。

---

## 2. Step 2 — 解析目标目录 & 初始化状态

> **重要设计决策**：Step 2 **不创建运行目录**。运行目录（即 worktree 目录）由流水线内的
> `git-worktree` 原子任务创建。这样可以确保所有产物（包括 context 阶段的输出）
> 统一写入同一个目录，避免产物分散在两个不同位置。

### 2.1 解析 targetDir

`config.base.targetDir = ".."` → 解析为绝对路径：
`/Users/djhhh/work_area`（项目根目录的上级）

### 2.2 检查是否有可恢复的运行

Agent 在 `targetDir` 下搜索已有的 `.state.json` 文件（路径模式 `*/docs/*/*/.state.json`），查找是否有中断的 run：

```
Ddo-Code-Flow-feat-2026-06-24-add-dark-mode/docs/feat/2026-06-24-add-dark-mode/.state.json  ← 找到了，恢复
```

如果找到，读取 `.state.json` 并从 `currentStage` 恢复。
如果没找到，**不创建任何目录**，仅在内存中初始化状态：

```json
{
  "runId": null,
  "createdAt": "2026-06-24T10:30:00Z",
  "userRequirement": "使用 ddo-code-flow，为项目添加 dark mode 支持",
  "currentStage": "context",
  "stages": {},
  "history": []
}
```

> 注意：`runId` 和 `worktreePath` 将在 `git-worktree` 原子任务执行后被填入。

### 2.3 Metrics 插件（runStart）

由于 `config.base.metrics.enabled = false`，Agent **跳过**此步骤。

如果 `enabled = true`，此步骤也会延迟到 `git-worktree` 创建目录后再执行
（因为需要一个 `--run-dir` 路径）。

---

## 3. Step 3 — 执行流水线

Agent 进入主循环，按 `config.pipeline` 的顺序逐 stage 执行：

```
context → requirement → spec → planning → test-plan →
tasking → coding → verification → review → reporting → reflection → done
```

> **关键流程**：`context` 先在内存中收集信息并暂存产出，等到 `git-worktree` 创建完
> worktree 目录后，再将 `context-summary.md` 持久化到 worktree 中。
> 这样所有阶段的产物都统一在同一个 worktree 目录下。

### ═══════════════════════════════════════════════
### Stage 1: context（读取项目上下文 — 延迟写入）
### ═══════════════════════════════════════════════

**解析有效 DAG**：
- `entry: ["context"]`，`context` 的 `enabled = true`（无 override）→ 保留

**拓扑分层**：
- Layer 0: `["context"]`（唯一节点，无依赖）

**执行 context 原子任务**：

Agent 读取 `atom-tasks/context/context.json`：

```json
{
  "io": {
    "inputs": [
      { "ref": "run://../AGENTS.md", "required": false },
      { "ref": "run://../README.md", "required": false },
      { "ref": "run://../product.md", "required": false }
    ],
    "outputs": [
      { "ref": "run://docs/{type}/{dateDescription}/context-summary.md", "kind": "markdown" }
    ]
  }
}
```

**路径解析**（此时 worktree 尚未创建，`run://../` 仍然解析到项目根）：
- `run://../AGENTS.md` → `/Users/djhhh/work_area/Ddo-Code-Flow/AGENTS.md`（项目根）
- `run://../README.md` → `/Users/djhhh/work_area/Ddo-Code-Flow/README.md`
- `run://../product.md` → `/Users/djhhh/work_area/Ddo-Code-Flow/product.md`
- `run://docs/{type}/{dateDescription}/context-summary.md` → **暂不写入磁盘，保存在内存中**

**执行**：
1. 尝试读取每个 input 文件
2. `AGENTS.md` — ✅ 存在，读取并总结
3. `README.md` — ✅ 存在，读取并总结
4. `product.md` — ❌ 不存在，`required=false`，记录到缺失列表
5. 检查 `config.base.contextPaths` 中是否有额外路径，一并读取

**产出（内存中暂存）** `context-summary.md`：

```markdown
## Loaded sources
| File | Summary |
|---|---|
| AGENTS.md | 定义了 Agent 行为规范与协作模式 |
| README.md | 项目介绍，ddo-code-flow 是可定制的 AI 编码流水线 |

## Context missing
- product.md（声明但不存在）
```

**更新 .state.json**：
```json
{
  "stages": {
    "context": {
      "status": "done",
      "nodes": {
        "context": {
          "status": "done",
          "completedAt": "2026-06-24T10:31:15Z",
          "outputPending": true
        }
      }
    }
  }
}
```

> `outputPending: true` 标记此节点的产出尚未持久化到磁盘，
> 等待 git-worktree 创建目录后写入。

**确认门**：`context` 不在 `confirmationGates` 中 → 自动继续。

---

### ═══════════════════════════════════════════════
### Stage 2: requirement（需求验证 & 工作树创建）
### ═══════════════════════════════════════════════

**拓扑分层**：
- Layer 0: `["requirement"]`
- Layer 1: `["git-worktree"]`（依赖 requirement 完成）

**Layer 0 — 执行 requirement**：

Agent 读取 `atom-tasks/requirement/requirement.json`：

```
instruction: "检查用户的提示词是否包含清晰的需求描述..."
```

Agent 检查用户输入 `"使用 ddo-code-flow，为项目添加 dark mode 支持"`：
- 不为空 ✅
- 不只是激活短语 ✅
- 包含明确的功能需求（dark mode）✅

→ 需求清晰，记录到工作记忆，继续。

**Layer 1 — 执行 git-worktree** ⭐ 关键步骤：

Agent 读取 `atom-tasks/git-worktree/git-worktree.json`：

1. 读取 `skill://atom-tasks/git-worktree/branch-rules.json`，提取分支命名规则
2. 从用户提示词提取描述 slug → `add-dark-mode`
3. 生成分支名：`feat/2026-06-24-add-dark-mode`（模板 `{prefix}/{date}-{description}`）
4. 派生关键值：
   - `type` = `feat`（分支名第一个 `/` 前的部分）
   - `dateDescription` = `2026-06-24-add-dark-mode`（分支名第一个 `/` 后的部分）
5. 计算 worktree 目录名：`Ddo-Code-Flow-feat-2026-06-24-add-dark-mode`
   （项目名 + 分支名，`/` 替换为 `-`）
6. 创建 branch 和 worktree：

```bash
git branch feat/2026-06-24-add-dark-mode
git worktree add ../Ddo-Code-Flow-feat-2026-06-24-add-dark-mode feat/2026-06-24-add-dark-mode
```

> worktree 路径 = `<targetDir>/<projectName>-<branchName(/→-)>`，即项目根的同级目录。
> 所有流水线产物都写入此目录。

7. 创建产物子目录并写入 `worktree-info.json`：
```bash
mkdir -p ../Ddo-Code-Flow-feat-2026-06-24-add-dark-mode/docs/feat/2026-06-24-add-dark-mode/
```
写入 `<worktreePath>/docs/feat/2026-06-24-add-dark-mode/worktree-info.json`：
```json
{
  "branchName": "feat/2026-06-24-add-dark-mode",
  "worktreePath": "/Users/djhhh/work_area/Ddo-Code-Flow-feat-2026-06-24-add-dark-mode",
  "targetDir": "/Users/djhhh/work_area",
  "type": "feat",
  "dateDescription": "2026-06-24-add-dark-mode",
  "baseRef": "HEAD",
  "createdAt": "2026-06-24T10:32:00Z"
}
```

8. **更新 `.state.json`** — 写入 `<worktreePath>/docs/feat/2026-06-24-add-dark-mode/.state.json`：
```json
{
  "runId": "2026-06-24-add-dark-mode",
  "worktreePath": "/Users/djhhh/work_area/Ddo-Code-Flow-feat-2026-06-24-add-dark-mode",
  "type": "feat",
  "dateDescription": "2026-06-24-add-dark-mode"
}
```

**9. 刷写延迟产物**：

此时 worktree 目录已存在，Agent 将 context 阶段暂存在内存中的
`context-summary.md` 写入 worktree：

```
/Users/djhhh/work_area/Ddo-Code-Flow-feat-2026-06-24-add-dark-mode/docs/feat/2026-06-24-add-dark-mode/context-summary.md  ← 从内存刷写到磁盘
```

清除 `context` 节点的 `outputPending` 标记。

> **从此刻起**，所有 `run://` 路径解析统一指向 worktree 目录：
> - `run://<path>` → `worktreePath/<path>`
> - `run://docs/{type}/{dateDescription}/<path>` → `worktreePath/docs/<type>/<dateDescription>/<path>`（MD 产物路径）
> - `run://../<path>` → 项目根 `/Users/djhhh/work_area/Ddo-Code-Flow/<path>`

---

### ═══════════════════════════════════════════════
### Stage 3: spec（生成 spec.md）⭐ 确认门
### ═══════════════════════════════════════════════

**拓扑分层**：Layer 0: `["spec"]`

**执行 spec 原子任务**：

Agent 读取 `atom-tasks/spec/spec.json`，解析输入：

- `skill://atom-tasks/spec/spec_template.md` → `atom-tasks/spec/spec_template.md`（只读模板）
- `run://docs/{type}/{dateDescription}/context-summary.md` → `worktreePath/docs/feat/2026-06-24-add-dark-mode/context-summary.md`（由 context 阶段延迟写入）

Agent 套用模板，结合用户需求和上下文，生成 `spec.md`：

```markdown
# Dark Mode 支持 — 规格说明

## 背景
用户希望为 ddo-code-flow 的 UI 界面添加深色模式支持...

## 功能需求
- FR-DM-1: 系统应提供 light / dark / system 三种主题选项
- FR-DM-2: 切换主题后，所有 UI 组件的颜色应即时更新
- FR-DM-3: 主题偏好应持久化到 localStorage
- FR-DM-4: system 模式应跟随操作系统的 prefers-color-scheme

## 开放问题
- Q1: 是否需要支持自定义主题色？
- Q2: CSS 变量方案还是 class 切换方案？

## 用户确认
> 请确认以上规格是否满足需求。如有修改意见，请回复。
```

**写入** `worktreePath/docs/feat/2026-06-24-add-dark-mode/spec.md`（即 `/Users/djhhh/work_area/Ddo-Code-Flow-feat-2026-06-24-add-dark-mode/docs/feat/2026-06-24-add-dark-mode/spec.md`）

**确认门检查**：
- `spec` 所属 stage `spec` 在 `confirmationGates` 中 ✅
- `spec.confirmation.required = true` ✅

Agent 向用户展示 spec.md 内容并等待确认：

```
📋 spec 阶段确认

已生成 spec.md，请审阅：

[展示 spec.md 内容]

是否批准？
```

**场景 A — 用户批准**：
→ `.state.json.stages.spec.status = "done"`，继续下一 stage。

**场景 B — 用户拒绝并反馈**：
用户回复：*"FR-DM-4 不需要，先只做手动切换。另外 Q1 的答案是不需要自定义主题色。"*

Agent 将反馈**追加**到 `prompt.instruction`，重新执行 spec 原子任务：
- 移除 FR-DM-4
- 关闭 Q1（答案：不需要）
- 更新 spec.md
- 再次展示给用户确认
- 循环直到批准

---

### ═══════════════════════════════════════════════
### Stage 4: planning（生成 plan.md）⭐ 确认门
### ═══════════════════════════════════════════════

Agent 读取 `atom-tasks/plan/plan.json`，输入包括：
- 已确认的 `spec.md`
- 项目源码上下文

产出 `plan.md`（技术方案）：

```markdown
# Dark Mode 实现方案

## 技术决策
- T1: 采用 CSS 自定义属性（CSS Variables）方案
- T2: 在 :root 上定义 --color-* 变量，通过 [data-theme] 属性切换
- T3: 使用 JavaScript 的 matchMedia 监听系统主题变化

## 文件变更计划
| 文件 | 变更类型 | 说明 |
|---|---|---|
| ui/css/theme.css | 新建 | 定义 light/dark 两套 CSS 变量 |
| ui/js/theme.js | 新建 | 主题切换逻辑 + localStorage 持久化 |
| ui/index.html | 修改 | 引入 theme.css 和 theme.js |
```

**确认门** → 用户审阅 plan.md → 批准/拒绝循环。

---

### ═══════════════════════════════════════════════
### Stage 5: test-plan（生成 test-plan.md）⭐ 确认门
### ═══════════════════════════════════════════════

Agent 读取 `atom-tasks/test-plan/test-plan.json`，基于 `test-plan_template.md` 和
已确认的 `spec.md` 生成验收测试计划。

#### Phase 1 — 生成 test-plan.md

两类检查项的区分原则：
- `cmd:` = **自动化测试**：单元测试、接口测试、shell 命令验证。机器自动执行。
- `human:` = **功能测试**：在页面上实际操作（点击、输入、切换等），用户手动执行。

```markdown
# Dark Mode 验收测试计划

## G1. 主题切换 — 自动化测试

> 对应 spec FR-DM-1, FR-DM-2。

- [ ] cmd: node tests/theme.test.js --grep "switchTheme sets data-theme attribute"
- [ ] cmd: node tests/theme.test.js --grep "switchTheme updates CSS variables"
- [ ] cmd: node tests/theme.test.js --grep "toggle dispatches theme-changed event"

**Pass criterion**：主题切换单元测试全部通过。

## G2. 主题切换 — 功能测试

> 对应 spec FR-DM-1, FR-DM-2。

- [ ] human: 打开页面，点击右上角主题切换按钮，确认从 light 切换为 dark，背景变为深色、文字变为浅色
- [ ] human: 再次点击切换按钮，确认从 dark 切回 light，界面恢复正常配色
- [ ] human: 切换到 system 模式，修改操作系统深色设置，确认页面自动跟随切换

**Pass criterion**：三种主题模式的视觉效果和交互均正确。

## G3. 持久化

> 对应 spec FR-DM-3。

- [ ] cmd: node tests/theme.test.js --grep "persists theme to localStorage"
- [ ] cmd: node tests/theme.test.js --grep "reads theme from localStorage on init"
- [ ] human: 选择 dark 主题后刷新页面，确认主题偏好保持为 dark

**Pass criterion**：localStorage 读写逻辑测试通过，刷新后偏好不丢失。

## G4. CSS 变量完整性

> 对应 spec FR-DM-1。

- [ ] cmd: node tests/css-vars.test.js --grep "defines all required CSS variables"
- [ ] cmd: tail -n 1 verification.log | grep -q "ALL PASSED"

**Pass criterion**：CSS 变量定义完整，最终验证日志标记 ALL PASSED。
```

**确认门** → 用户审阅测试计划 → 批准/拒绝循环。

#### Phase 2 — TDD 模式（可选）

当 `atomTaskOverrides.test-plan.tdd == true` 且用户确认 test-plan.md 后：

1. 检测项目的测试框架（JUnit / Mocha / pytest 等）和测试目录约定
2. 为每个 `cmd:` 检查项生成对应的测试方法骨架（Red 状态）：
   - 方法名匹配检查项 ID（如 `testG1_cmd1_dataThemeExists`）
   - 包含 Arrange / Act / Assert 注释
   - 标记为 pending / skip / throw（Red 状态）
3. 写入 test-plan.md 末尾的 `## TDD 测试文件` 表格

```markdown
## TDD 测试文件

| Checklist ID | 测试文件 | 测试方法 | 状态 |
|---|---|---|---|
| G1/cmd-1 | tests/theme.test.js | testG1_cmd1_switchSetsDataTheme() | 🔴 Red |
| G1/cmd-2 | tests/theme.test.js | testG1_cmd2_switchUpdatesCssVars() | 🔴 Red |
| G1/cmd-3 | tests/theme.test.js | testG1_cmd3_toggleDispatchesEvent() | 🔴 Red |
| G3/cmd-1 | tests/theme.test.js | testG3_cmd1_persistsToLocalStorage() | 🔴 Red |
| G3/cmd-2 | tests/theme.test.js | testG3_cmd2_readsFromLocalStorage() | 🔴 Red |
| G4/cmd-1 | tests/css-vars.test.js | testG4_cmd1_allVarsDefined() | 🔴 Red |
```

当 `tdd == false`（默认）时：跳过 Phase 2，Phase 1 确认后任务即完成。

---

### ═══════════════════════════════════════════════
### Stage 6: tasking（拆分任务）
### ═══════════════════════════════════════════════

Agent 基于 plan.md 和 test-plan.md 拆分出具体任务：

产出 `tasks/task-group.json`：

```json
{
  "tasks": [
    {
      "id": "task-01",
      "name": "创建 CSS 变量定义",
      "file": "tasks/task-01.md",
      "dependsOn": [],
      "description": "新建 ui/css/theme.css，定义 light/dark 两套 CSS 变量"
    },
    {
      "id": "task-02",
      "name": "实现主题切换 JS",
      "file": "tasks/task-02.md",
      "dependsOn": ["task-01"],
      "description": "新建 ui/js/theme.js，实现切换逻辑和 localStorage 持久化"
    },
    {
      "id": "task-03",
      "name": "集成到 HTML",
      "file": "tasks/task-03.md",
      "dependsOn": ["task-01", "task-02"],
      "description": "修改 ui/index.html，引入 theme.css 和 theme.js"
    }
  ],
  "parallelGroups": [["task-01"], ["task-02"], ["task-03"]]
}
```

同时产出每个 `tasks/task-NN.md` 文件，包含具体编码指令。

---

### ═══════════════════════════════════════════════
### Stage 7: coding（编码实现）
### ═══════════════════════════════════════════════

Agent 解析 `task-group.json`，按拓扑顺序执行：

**Batch 1 — task-01**（无依赖）：
- 读取 `worktreePath/tasks/task-01.md`
- 在 worktree 中创建 `worktreePath/ui/css/theme.css`
- 写入 CSS 变量定义
- 更新 `.state.json`：task-01 → done

**Batch 2 — task-02**（依赖 task-01 ✅）：
- 读取 `worktreePath/tasks/task-02.md`
- 创建 `worktreePath/ui/js/theme.js`
- 实现主题切换逻辑
- 更新 `.state.json`：task-02 → done

**Batch 3 — task-03**（依赖 task-01 ✅, task-02 ✅）：
- 读取 `worktreePath/tasks/task-03.md`
- 修改 `worktreePath/ui/index.html`
- 引入新文件
- 更新 `.state.json`：task-03 → done

**编码阶段无确认门** → 自动继续。

---

### ═══════════════════════════════════════════════
### Stage 8: verification（验收测试）🔄 可能回跳
### ═══════════════════════════════════════════════

Agent 逐行解析 `test-plan.md`：

**G1. 主题切换 — 自动化测试**：

```
[cmd] node tests/theme.test.js --grep "switchTheme sets data-theme attribute"
→ exit code 0 ✅ [PASS]

[cmd] node tests/theme.test.js --grep "switchTheme updates CSS variables"
→ exit code 0 ✅ [PASS]

[cmd] node tests/theme.test.js --grep "toggle dispatches theme-changed event"
→ exit code 0 ✅ [PASS]

GROUP G1 PASSED
```

**G2. 主题切换 — 功能测试**：

```
[human] 打开页面，点击右上角主题切换按钮，确认从 light 切换为 dark
→ 向用户展示此条目，等待用户在浏览器中操作
→ 用户回复 "通过" ✅ [PASS]

[human] 再次点击切换按钮，确认从 dark 切回 light
→ 用户回复 "通过" ✅ [PASS]

[human] 切换到 system 模式，修改操作系统深色设置，确认页面自动跟随
→ 用户回复 "通过" ✅ [PASS]

GROUP G2 PASSED
```

**G3. 持久化**：

```
[cmd] node tests/theme.test.js --grep "persists theme to localStorage"
→ exit code 0 ✅ [PASS]

[cmd] node tests/theme.test.js --grep "reads theme from localStorage on init"
→ exit code 0 ✅ [PASS]

[human] 选择 dark 主题后刷新页面，确认主题偏好保持为 dark
→ 用户回复 "通过" ✅ [PASS]

GROUP G3 PASSED
```

**G4. CSS 变量完整性**：

```
[cmd] node tests/css-vars.test.js --grep "defines all required CSS variables"
→ exit code 1 ❌ [FAIL]（6 个变量未定义，要求全部定义）

GROUP G4 FAILED: 1 failing
```

**失败恢复**：

由于 verification 定义了恢复逻辑（"任一失败回到 Coding 重做"），
Agent 不写 `ALL PASSED`，而是：

1. 在 `.state.json` 中记录失败详情
2. **跳回 coding stage**，针对 G4 的失败原因（CSS 变量定义不完整）补充编码
3. 补充缺失的 CSS 变量定义后，重新进入 verification
4. 再次执行 G4 的 cmd 测试

第二次运行：

```
[cmd] node tests/css-vars.test.js --grep "defines all required CSS variables"
→ exit code 0 ✅ [PASS]

[cmd] tail -n 1 verification.log | grep -q "ALL PASSED"
→ exit code 0 ✅ [PASS]

GROUP G4 PASSED
ALL PASSED
```

→ verification.log 末尾出现 `ALL PASSED`，验收通过。

---

### ═══════════════════════════════════════════════
### Stage 9: review（代码复审 — 占位扩展点）
### ═══════════════════════════════════════════════

`atom-tasks/review/review.json` 中 `enabled: false`（默认禁用），
配置中 `atomTaskOverrides.review.enabled: true` 覆盖为启用。

但由于 config 中 `atomTasks.entry` 为空数组，即使 review 原子任务本身
`enabled=true`，DAG 中没有入口节点可执行 → Agent 将其标记为 `skipped`。

> **扩展方式**：在 `atom-tasks/review/check-list.md` 中编写复审清单，
> 然后在 config 的 review stage 的 `atomTasks` 中添加 entry 和 nodes。
> review 原子任务会以 sub-agent 方式逐条核对，产出 `review-report.md`。

---

### ═══════════════════════════════════════════════
### Stage 10: reporting（生成执行报告）
### ═══════════════════════════════════════════════

Agent 读取 `atom-tasks/reporting/reporting.json`，基于 `execution-report_template.md`
和 `.state.json` 汇总生成 `execution-report.md`。

输入：`.state.json`、`verification.log`、`spec.md`、`plan.md`、`test-plan.md`、
`context-summary.md`（用于填充 "Context missing" 列表）。

```markdown
# Execution Report — 2026-06-24-add-dark-mode

## Run metadata
- runId: `2026-06-24-add-dark-mode`
- createdAt: `2026-06-24T10:30:00Z`
- currentStage: `done`

## Requirement (verbatim)
> 使用 ddo-code-flow，为项目添加 dark mode 支持

## Per-stage artifacts

| Stage | Status | Outputs |
|---|---|---|
| context | ✅ done | context-summary.md |
| requirement | ✅ done | worktree-info.json |
| spec | ✅ done | spec.md |
| planning | ✅ done | plan.md |
| test-plan | ✅ done | test-plan.md |
| tasking | ✅ done | tasks/task-group.json, tasks/task-01~03.md |
| coding | ✅ done | ui/css/theme.css, ui/js/theme.js, ui/index.html |
| verification | ✅ done | verification.log |
| review | ⏭ skipped | — |
| reporting | ✅ done | this file |
| reflection | ✅ done | reflection-report.md |

## Verification summary
10 passed / 1 failed (later fixed) of 11 checklist items.

- G4/cmd-1: 首次失败（CSS 变量定义不完整），补充后通过。

## Context missing
- product.md（声明但不存在）

## Decisions log
- 2026-06-24T10:30:00Z — created
- 2026-06-24T10:31:15Z — context completed (output held in memory)
- 2026-06-24T10:32:00Z — worktree created
- 2026-06-24T10:32:01Z — context output flushed
- 2026-06-24T10:35:00Z — spec rejected (round 1: "移除 FR-DM-4")
- 2026-06-24T10:38:00Z — spec approved (round 2)
- 2026-06-24T11:05:00Z — verification failed (G3)
- 2026-06-24T11:05:05Z — recovery: verification → coding
- 2026-06-24T11:10:00Z — verification passed (ALL PASSED)
- 2026-06-24T11:15:00Z — run completed

## Core documents
- Specification: [spec.md](spec.md)
- Plan: [plan.md](plan.md)
- Test plan: [test-plan.md](test-plan.md)
```

---

### ═══════════════════════════════════════════════
### Stage 11: reflection（反思与后续）⭐ 确认门
### ═══════════════════════════════════════════════

Agent 读取 `atom-tasks/reflection/reflection.json`，基于 `reflection-report_template.md`
和 `execution-report.md` 生成反思报告。扫描 worktree 中的 TODO/FIXME/XXX 标记。

```markdown
# Reflection Report — 2026-06-24-add-dark-mode

## 1. 未完结项（Open items）

- [ ] ui/js/theme.js:23 — TODO: 考虑添加 prefers-reduced-motion 支持

## 2. 推荐后续动作（Follow-ups）

- 添加主题切换动画过渡（transition: background-color 0.3s）
- 考虑支持自定义主题色（spec.md 中已排除，可作为独立需求）

## 3. 本次 run 经验（Lessons learned）

- CSS 变量方案比 class 切换更灵活，后续扩展成本低
- 验收测试中 cmd 类检查项应覆盖更多边界（首次 G3 未通过）

## 4. 与原始 requirement 的偏差

无。所有 FR 均已实现并通过验收。

---

## 5. 用户确认

- ✅ **同意**：本 reflection 符合预期，可标记本次 run 为 **Done**。
- ❌ **修改**：请列出需要调整的条目与意见。
```

**确认门** → 用户审阅 → 批准。

---

## 4. Step 4 — 终结

所有 stage 完成后，Agent 进入终结流程：

### 4.1 Metrics 插件（runFinish）

`config.base.metrics.enabled = false` → 跳过。

### 4.2 通知用户

Agent 输出：

```
✅ 流水线执行完成！

运行目录（worktree）: Ddo-Code-Flow-feat-2026-06-24-add-dark-mode/
产物目录: Ddo-Code-Flow-feat-2026-06-24-add-dark-mode/docs/feat/2026-06-24-add-dark-mode/
分支: feat/2026-06-24-add-dark-mode
执行报告: Ddo-Code-Flow-feat-2026-06-24-add-dark-mode/docs/feat/2026-06-24-add-dark-mode/execution-report.md

感谢使用 ddo-code-flow。
```

---

## 5. 关键机制详解

### 5.1 路径解析规则

> 由于运行目录由 git-worktree 创建，且在 requirement 阶段就已完成，
> 后续所有阶段的 `run://` 路径都统一指向 worktree 目录。
> context 阶段的 `run://` 输出先暂存内存，待 worktree 创建后刷写。

| 前缀 | 解析目标 | 说明 |
|---|---|---|
| `skill://<path>` | `./<path>`（只读） | 技能自身的模板/配置文件 |
| `run://<path>` | `<worktreePath>/<path>` | worktree 目录（git-worktree 创建后） |
| `run://docs/{type}/{dateDescription}/<path>` | `<worktreePath>/docs/<type>/<dateDescription>/<path>` | MD 产物目录（`{type}` 为分支前缀，`{dateDescription}` 为日期-描述） |
| `run://../<path>` | `<target>/<path>` | 项目根目录（始终不变） |

**特殊处理**：当 context 阶段执行时 worktree 尚未存在，
`run://docs/{type}/{dateDescription}/` 输出路径暂存内存，待 git-worktree 完成后统一刷写到 `worktreePath/docs/<type>/<dateDescription>/`。

### 5.2 确认门循环

```
执行原子任务 → 产出文件 → 展示给用户
                          ↓
                   用户批准？──是──→ 继续下一节点/阶段
                      │
                      否（附反馈）
                      ↓
              反馈追加到 prompt.instruction
                      ↓
                 重新执行该原子任务
                      ↓
                 再次展示给用户 → 循环
```

### 5.3 拓扑分层执行（Kahn 算法）

以一个更复杂的 DAG 为例：

```
A → B → D
A → C → D
         ↗
E ──────
```

分层结果：
- Layer 0: `[A, E]`（无依赖，可并行）
- Layer 1: `[B, C]`（依赖 A 完成，可并行）
- Layer 2: `[D]`（依赖 B, C, E 全部完成）

### 5.4 状态持久化与恢复

`.state.json` 在**每个状态转换时**写入磁盘：
- 节点开始 → 写入
- 节点完成 → 写入
- Layer 完成 → 写入
- Stage 完成 → 写入

如果 Agent 会话中断，下次启动时 Step 2 读取 `.state.json`，从 `currentStage` 恢复，
跳过已完成的 stage（`status == "done"`）。

### 5.5 并行确认合并

当一个 Layer 中有多个节点设置了 `parallelApprove: true` 时，
Agent 不会逐个询问用户，而是**合并为一个确认请求**：

```
📋 Layer 2 确认

以下节点已完成，请审阅：

1. node-a 产出: output-a.md
2. node-b 产出: output-b.md

是否全部批准？
```

用户可以：
- 全部批准
- 选择性拒绝（指定哪些节点需要重做并附反馈）

---

## 6. .state.json 完整生命周期示例

```json
{
  "runId": "2026-06-24-add-dark-mode",
  "createdAt": "2026-06-24T10:30:00Z",
  "worktreePath": "/Users/djhhh/work_area/feat/2026-06-24-add-dark-mode",
  "type": "feat",
  "currentStage": "done",
  "stages": {
    "context": { "status": "done", "nodes": { "context": { "status": "done", "outputPending": false } } },
    "requirement": { "status": "done", "nodes": { "requirement": { "status": "done" }, "git-worktree": { "status": "done" } } },
    "spec": { "status": "done", "nodes": { "spec": { "status": "done", "confirmations": [{ "round": 1, "result": "rejected", "feedback": "移除 FR-DM-4" }, { "round": 2, "result": "approved" }] } } },
    "planning": { "status": "done", "nodes": { "plan": { "status": "done" } } },
    "test-plan": { "status": "done", "nodes": { "test-plan": { "status": "done" } } },
    "tasking": { "status": "done", "nodes": { "tasking": { "status": "done" } } },
    "coding": { "status": "done", "nodes": { "coding": { "status": "done", "tasks": { "task-01": "done", "task-02": "done", "task-03": "done" } } } },
    "verification": { "status": "done", "nodes": { "verification": { "status": "done", "retries": 1 } } },
    "review": { "status": "skipped" },
    "reporting": { "status": "done", "nodes": { "reporting": { "status": "done" } } },
    "reflection": { "status": "done", "nodes": { "reflection": { "status": "done" } } },
    "done": { "status": "done" }
  },
  "history": [
    { "event": "created", "at": "2026-06-24T10:30:00Z" },
    { "event": "stage_started", "stage": "context", "at": "2026-06-24T10:30:05Z" },
    { "event": "stage_completed", "stage": "context", "at": "2026-06-24T10:31:15Z", "note": "output held in memory" },
    { "event": "worktree_created", "at": "2026-06-24T10:32:00Z", "worktreePath": "/Users/djhhh/work_area/Ddo-Code-Flow-feat-2026-06-24-add-dark-mode" },
    { "event": "context_output_flushed", "at": "2026-06-24T10:32:01Z", "file": "context-summary.md" },
    { "event": "confirmation_rejected", "stage": "spec", "node": "spec", "round": 1, "at": "2026-06-24T10:35:00Z" },
    { "event": "confirmation_approved", "stage": "spec", "node": "spec", "round": 2, "at": "2026-06-24T10:38:00Z" },
    { "event": "verification_failed", "stage": "verification", "group": "G4", "at": "2026-06-24T11:05:00Z" },
    { "event": "recovery_jump", "from": "verification", "to": "coding", "at": "2026-06-24T11:05:05Z" },
    { "event": "verification_passed", "stage": "verification", "at": "2026-06-24T11:10:00Z" },
    { "event": "run_completed", "at": "2026-06-24T11:15:00Z" }
  ]
}
```

---

## 7. Agent 行为约束速查

| 约束 | 来源 | 说明 |
|---|---|---|
| 不修改原子任务 JSON | SKILL.md "What NOT do" | 开关只通过 `atomTaskOverrides` |
| 不发明 metrics 值 | SKILL.md Metrics 插件 | 只有 plugin.js 写入 metrics |
| 不内嵌业务逻辑 | SKILL.md 核心原则 | 所有 "做什么" 在原子任务 JSON 中 |
| guardrails 全程生效 | 原子任务 JSON | 如 "不执行 human: 行"、"不 sudo" |
| 每次转换写 state | Step 3.4 | 保证中断可恢复 |
| 确认门必须等待用户 | Step 3.2.b / 3.3 | 不可自动跳过 |
| 选项 ≠ 确认 | Step 3.2.b | 用户在选项中做选择是反馈，不是隐式批准 |
| 运行目录由 git-worktree 创建 | Step 2 设计决策 | Step 2 不创建目录，所有产物统一在 worktree |

---

## 8. 总结：Agent 的执行心智模型

```
┌──────────────────────────────────────────────────────────────┐
│                    SKILL.md                                   │
│  "我是执行器，不是业务逻辑的实现者"                             │
│                                                              │
│  1. 加载 config → 校验 schema → 检查 DAG                      │
│  2. 解析 targetDir → 检查可恢复的 run                         │
│     （不创建运行目录！）                                       │
│  3. 遍历 pipeline stages:                                    │
│     ├── 解析有效 DAG（过滤 disabled）                         │
│     ├── Kahn 分层 → 逐层执行                                  │
│     │   ├── 加载原子任务 JSON                                 │
│     │   ├── 解析路径（skill:// / run://）                     │
│     │   ├── 执行 prompt.instruction（含 options 合并）        │
│     │   ├── 写入产出文件（或延迟写入）                         │
│     │   └── 并行确认合并（如有）                              │
│     ├── Stage 确认门（如在 gates 中）                         │
│     └── 持久化 state                                         │
│                                                              │
│  关键流程：                                                   │
│  ┌─────────┐    ┌────────────────┐    ┌───────────────────┐ │
│  │ context │───→│ git-worktree   │───→│ spec / plan       │ │
│  │ (内存)  │    │ 创建目录       │    │ test-plan (TDD?)  │ │
│  │         │    │ 刷写 context   │    │ tasking / coding  │ │
│  └─────────┘    │ metrics start  │    │ verification      │ │
│                 └────────────────┘    │ review (disabled) │ │
│                                       │ reporting (模板)  │ │
│                                       │ reflection (模板) │ │
│                                       └───────────────────┘ │
│  所有产物统一写入 worktree 目录                               │
│                                                              │
│  4. 失败恢复：遵循原子任务中的 recovery 指令                   │
│  5. 终结：Metrics 插件 + 通知用户                             │
└──────────────────────────────────────────────────────────────┘
```

Agent 的核心信条：**配置驱动，指令忠实执行，状态始终持久化，用户确认不可跳过。**
