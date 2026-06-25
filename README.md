# ddo-code-flow

> **ddo-code-flow** 是一款**可定制化的 AI 编程流水线 skill**：把「AI 写代码」拆成 12 个有序阶段（context → … → done），每个阶段由可配置的 **atom-task** 承担实际工作；通过编辑 `config.json` 即可重新编排流水线，无需改动 skill 本体。配套 **Ddo-Code-Flow Studio**——纯本地、零依赖的可视化配置页，用于编辑 DAG、管理 atom-task 开关，以及配置 Run 级成本统计。

![](assets/image.png)

## ✨ 项目亮点

- **流程标准化**：需求 → 规约 → 方案 → 测试计划 → 任务拆分 → 编码 → 验收 → 复盘，关键阶段强制用户确认（human-in-the-loop）
- **流程与能力解耦**：流水线只编排顺序，「做什么」由 atom-task 提供；新增 / 替换 atom-task **不需要改 skill 本体一行代码**
- **DAG 拓扑编排**：同一 stage 内可挂多个 atom-task，支持依赖图、并行批次与「合并审批」
- **指令型 runtime**：无自研执行器、无后台进程——执行 agent 就是引擎，文件系统 + `.state.json` 就是状态机
- **MD 原子任务定义**：atom-task 使用 `.md` 文件（YAML frontmatter + markdown body），agent 友好、人类可读
- **结构化产物规范**：每个产物通过 `.output.schema.json` 定义 sections、rules、example，保证输出格式稳定
- **Run 级 Metrics Plugin**：可选统计整次 Workflow 的真实 Token 消耗与成本估算；**不是 atom-task、不在 DAG 中**，Workflow 前后 snapshot 差分 + 可插拔 Provider（详见 `[docs/metrics.md](docs/metrics.md)`）
- **零依赖 Studio UI**：原生 HTML + CSS + JS，`studio.js` 单文件驱动；File System Access API 直读写 `config.json`，无 node_modules、无打包
- **完全本机**：产物落在 `<target>/YYYY-MM-DD-<desp>/`，可 git track；Metrics 默认关闭，不依赖在线服务

## 🚀 核心能力

- **12 阶段流水线**：Context → Requirement → Specification → Planning → Test-Planning → Tasking → Coding → Verification → Review → Reporting → Reflection → Done
- **4 个内置确认门**：Specification / Planning / Test-Planning / Reflection；否决可带反馈重生
- **两段式 Verification**：`test-plan.md` 中 `cmd:` 由 agent 执行核对 exit code，`human:` 由用户勾选
- **失败自动回退**：Verification 失败回到 Coding 重做；会话中断后续跑读 `.state.json`
- **Studio 可视化编辑**：左侧 atom-task 注册表、中间 Pipeline DAG 画布、右侧 Inspector；支持节点注入、连线、合并审批、无环校验
- **原子任务热插拔**：扫描 `atom-tasks/`，ENABLED/DISABLED 走 `atomTaskOverrides`；注册表内可打开 atom-task 详细配置弹窗
- **Metrics Runtime Plugin**（可选）：Run Start / Run Finish 调用 `scripts/metrics/plugin.js`；支持 4 种 Provider；可选生成 `metrics-report.md`

## 🎯 适用场景

- 中大型 AI 编程任务，需要先把 spec / plan 落到文档再开干
- 团队希望过程可审计、可回退、可复盘，并可选追踪单次 run 的 Token / 成本
- 想把 review、测试规划、文档生成等子流程抽成 atom-task 复用
- 需按项目定制流水线（纯文档跳过 Coding、纯重构跳过 Specification 等）

## 📦 发版与文档

| 版本 | 说明 |
|---|---|
| **2.0.0** | **MD 化改造**：atom-task 定义从 JSON 迁移为 `.md` 文件（YAML frontmatter + markdown body），agent 输入更友好。**产物规范**：新增 `.output.schema.json`（sections / rules / example / fieldDocs），定义输出 MD 的结构、格式与校验规则，取代旧的 `_template.md` 文件。**UI 适配**：Studio 解析 YAML frontmatter 展示 atom-task 信息，配置弹窗改为只读查看，开关修改保留。**精简**：删除旧 JSON 定义文件、模板文件，`_schema` 仅保留 `atom-task-md.schema.json` + `output-schema.schema.json`。 |
| 1.0.1 | Metrics Runtime Plugin；Studio 三栏 DAG 编辑器；顶栏输出目录 / 运行成本统计 pill；中英切换。 |
| 1.0.0 | 首版；12 阶段流水线、11 个默认 atom-task、Studio UI、零运行时依赖。 |

## ⚡ 快速开始

ddo-code-flow 是 **Agent Skill**，无 CLI、无需安装。

### 1. 获取 skill

将本项目 clone 或复制到 agent 可读的 skills 目录，例如：

```text
<skills-root>/ddo-code-flow/
```

具体路径取决于你使用的 IDE / agent 环境；安装后确保 agent 能加载 `SKILL.md` 与 `config.json`。

### 2. 在目标项目里触发

在对话中说：

```
用 ddo-code-flow 跑一遍流水线，需求是：实现一个 reverseString(s: string): string 的纯函数模块。
```

agent 按 `[SKILL.md](SKILL.md)` 执行：

1. 读 `config.json`，校验 schema 与 DAG 无环
2. 在 `targetDir` 下创建 / 恢复 `YYYY-MM-DD-<desp>/` 工作目录
3. （可选）若 `base.metrics.enabled`，Run Start 调用 Metrics Plugin 记录 `snapshotBefore`
4. 依次跑各 stage；确认门处等待 `同意` 或 `修改：<意见>`
5. Coding 后跑 Verification；失败则回到 Coding
6. reflection 确认通过后标记 `done`；若 Metrics 已启用，Run Finish 写入 `runTotal` 与可选 `metrics-report.md`

### 3. 打开 Studio 编辑配置

浏览器（Chromium 系最佳）打开：

```text
<skill-root>/ui/index.html
```

**Open folder** 选中 skill 根目录后：

| 区域 | 作用 |
|---|---|
| 左栏 Capabilities | 扫描 atom-task，拖入 DAG；点击条目打开配置弹窗 |
| 中栏 Pipeline DAG | stage 顺序、节点、连线、合并审批 |
| 右栏 Inspector | 选中 stage / 节点 / atom 后的字段编辑与信息查看 |

### 4. （可选）启用 Run 级 Metrics

默认 `base.metrics.enabled: false`。编辑 `config.json`：

```jsonc
"metrics": {
  "enabled": true,
  "provider": "tokscale",
  "failurePolicy": "warn",
  "report": { "enabled": true, "path": "metrics-report.md" },
  "pricing": {
    "model": "",
    "inputPerMillionUsd": 0,
    "outputPerMillionUsd": 0
  }
}
```

| Provider | 说明 | 额外依赖 |
|---|---|---|
| `tokscale` | 读本地 IDE 累积 token 用量 | [tokscale](https://github.com/junhoyeo/tokscale) CLI |
| `custom-command` | 自定义 capture 脚本 | `metrics.customCommand`（支持 `skill://` URI） |
| `cursor-session-counter` | 读 `<run>/.metrics/session-counter.json` | Hook / 外部计数器写入 |
| `cursor-sdk` | 读 `<run>/.metrics/sdk-usage.json` | SDK runner 或外部工具写入 |

- **tokscale** 非硬依赖；未安装时 Metrics 失败但不影响 Workflow 成功（`failurePolicy: warn`）
- 启用 Metrics 时需要本机 **Node.js**（跑 `plugin.js`）与 **bash**（Provider 脚本）；Workflow 本身仍只依赖执行 agent
- 详见 `[docs/metrics.md](docs/metrics.md)`

### 5. 查看产物

每次 run 落在 `<targetDir>/<projectName>-<branchName(/→-)>/` 下：

```text
<targetDir>/
├── <projectName>/                                      # 项目本体
└── <projectName>-feat-2026-06-06-reverse-string/       # worktree 目录
    ├── docs/
    │   └── feat/
    │       └── 2026-06-06-reverse-string/
    │           ├── .state.json                         # 状态机（JSON）
    │           ├── worktree-info.json                  # 工作树信息（JSON + MD 双写）
    │           ├── context-summary.md
    │           ├── requirement.md
    │           ├── spec.md
    │           ├── plan.md
    │           ├── test-plan.md
    │           ├── tasks/
    │           │   ├── task-01.md
    │           │   ├── task-group.json                 # 任务分组（JSON + MD 双写）
    │           │   └── task-group.md
    │           ├── verification.log
    │           ├── execution-report.md
    │           ├── reflection-report.md
    │           └── metrics-report.md                   # 可选
    └── (源代码文件)
```

## ⚙️ 配置说明

### `config.json` — 流水线编排

`[config.json](config.json)` 是唯一真相源：

```jsonc
{
  "version": "2.0.0",
  "base": {
    "targetDir": "..",
    "contextPaths": [],
    "contextOptional": true,
    "respGenerator": { "maxLength": 32, "case": "kebab", "stripStopwords": true },
    "confirmationGates": ["specification", "planning", "test-planning", "reflection"],
    "metrics": {
      "enabled": false,
      "provider": "tokscale",
      "failurePolicy": "warn",
      "report": { "enabled": true, "path": "metrics-report.md" },
      "pricing": { "model": "", "inputPerMillionUsd": 0, "outputPerMillionUsd": 0 }
    }
  },
  "pipeline": [ /* 12 stages，每 stage 一个 atomTasks DAG */ ],
  "atomTaskOverrides": { "review": { "enabled": false } }
}
```

完整 schema：`[config.schema.json](config.schema.json)`。

### `atom-tasks/` — 可插拔原子任务

12 个默认 atom-task，每个子目录含 `.md` 定义与 `.output.schema.json` 产物规范：

```text
atom-tasks/
├── _schema/
│   ├── atom-task-md.schema.json       # MD frontmatter schema
│   └── output-schema.schema.json      # 产物输出 schema 元规范
├── context/
│   ├── context.md                     # 原子任务定义（YAML frontmatter + markdown body）
│   └── context.output.schema.json     # context-summary.md 的结构规范
├── requirement/
│   ├── requirement.md
│   └── requirement.output.schema.json
├── git-worktree/
│   ├── git-worktree.md
│   ├── branch-rules.json              # 分支命名规则（配置文件）
│   └── worktree-info.output.schema.json
├── spec/
│   ├── spec.md
│   └── spec.output.schema.json
├── plan/
│   ├── plan.md
│   └── plan.output.schema.json
├── test-plan/
│   ├── test-plan.md
│   └── test-plan.output.schema.json
├── tasking/
│   ├── tasking.md
│   └── task-group.output.schema.json
├── coding/
│   └── coding.md                      # 输出是代码目录，无 output schema
├── verification/
│   ├── verification.md
│   └── verification.output.schema.json
├── review/
│   ├── review.md
│   ├── check-list.md                  # review 输入清单
│   └── review-report.output.schema.json
├── reporting/
│   ├── reporting.md
│   └── execution-report.output.schema.json
└── reflection/
    ├── reflection.md
    └── reflection-report.output.schema.json
```

**atom-task 定义格式**（以 `spec.md` 为例）：

```markdown
---
name: spec
version: "1.0.0"
stage: specification
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  required: true
  rejectAction: regenerate-with-feedback
io:
  inputs:
    - ref: "run://docs/{type}/{dateDescription}/context-summary.md"
      required: false
  outputs:
    - ref: "run://docs/{type}/{dateDescription}/spec.md"
      kind: markdown
outputSchemaRef: "skill://atom-tasks/spec/spec.output.schema.json"
---

# spec

> 读取用户原始需求与 context-summary.md 生成 spec.md。

## 指令

（agent 执行的具体指令）

## 约束

（agent 必须遵守的规则）
```

**产物规范格式**（`spec.output.schema.json` 示例）：

```jsonc
{
  "description": "spec.md 输出规范",
  "outputFormat": "markdown",
  "document": { "title": "{{ 项目名称 }} Specification", "titleFormat": "占位符", "separators": true },
  "sections": [
    { "heading": "项目概述", "level": 2, "required": true, "format": "group", "subsections": [...] },
    { "heading": "功能需求", "level": 2, "required": true, "format": "structured-list", "idPrefix": "FR", "extensible": true },
    { "heading": "验收标准", "level": 2, "required": true, "format": "structured-list", "idPrefix": "AC", "extensible": true },
    { "heading": "用户确认", "level": 2, "required": true, "format": "template", "extensible": false, "content": "..." }
  ],
  "rules": [ "每个 {{ 占位符 }} 必须替换为具体内容", "..." ],
  "example": "# MyProject Specification\n\n> ...\n\n## 项目概述\n...",
  "fieldDocs": { "sections[].format": "内容格式类型...", "..." }
}
```

atom-task schema：`[atom-tasks/_schema/atom-task-md.schema.json](atom-tasks/_schema/atom-task-md.schema.json)`。

### 启用 / 禁用 atom-task

改 `atomTaskOverrides`，不要直接改 atom-task .md 的 `enabled`：

```jsonc
"atomTaskOverrides": {
  "review": { "enabled": true },
  "spec": { "enabled": false }
}
```

### Metrics 与 atom-task 的边界

- Metrics **不是** atom-task，**不会**出现在 `pipeline` / DAG 中
- 不要新增 `metrics-reporting` 等业务 stage；Run 级用量由 `scripts/metrics/plugin.js` 在 Workflow 前后执行
- 当前版本只统计 **Run Total**，不做 per-stage / per-atom-task 归因

## 🤝 贡献

欢迎 Issue 与 PR。提交前请注意：

- 修改 `config.schema.json` / `atom-task-md.schema.json` 时同步更新默认 `config.json` 与相关文档
- 修改 `.output.schema.json` 时确保 `sections` 和 `example` 一致
- 新增 Metrics Provider 时在 `scripts/metrics/providers/registry.json` 注册并更新 `docs/metrics.md`
- UI 改动请在 Chromium 系浏览器验证 Studio 完整流程（Open folder → 编辑 DAG → Save）

## 📄 许可证

本项目采用 [MIT License](LINCES) 开源协议。
