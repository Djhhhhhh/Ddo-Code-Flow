# ddo-swe

> **ddo-swe** 是一款**可定制化的 AI 编程流水线 skill**：把"AI 写代码"这件事拆成 12 个有序阶段（spec → plan → test-plan → tasking → coding → verification → review → reporting → reflection → done），每个阶段由可配置的**原子任务（atom-task）承担实际工作；通过编辑 `config.json` 即可重新编排流水线，无需改动 skill 本体。配套一个纯本地、零依赖的可视化页面**，用于编辑流水线、切换原子任务启用状态。

## ✨ 项目亮点

- **流程标准化**：把"需求 → 规约 → 方案 → 测试计划 → 任务拆分 → 编码 → 验收 → 复盘"固化为可复用流水线，关键阶段强制用户确认（human-in-the-loop）
- **流程与能力解耦**：流水线只编排顺序，"做什么"由 atom-task 提供；新增 / 替换 atom-task **不需要改 skill 本体一行代码**
- **DAG 拓扑编排**：同一阶段内可挂多个 atom-task，支持依赖图、并行批次与"合并审批"（同批多产物一次确认）
- **指令型 runtime**：没有自研执行器、没有后台进程、不起 server——agent（Cursor）就是引擎，文件系统就是状态机
- **零依赖 UI**：原生 HTML + CSS + JS，通过浏览器 File System Access API 直接读写 `config.json`，无 node_modules、无打包
- **完全本机**：所有数据落在 `<target>/YYYY-MM-DD-<desp>/`，可直接 git track；不依赖任何在线服务

## 🚀 核心能力

- **12 阶段流水线**：Context → Requirement → Specification → Planning → Test-Planning → Tasking → Coding → Verification → Review → Reporting → Reflection → Done
- **4 个内置确认门**：Specification / Planning / Test-Planning / Reflection 阶段强制用户审阅产物，否决可带反馈重生
- **两段式 Verification**：`test-plan.md` 中的 `- [ ] cmd: <shell>` 由 agent 自动执行核对 exit code，`- [ ] human: <描述>` 由用户人工勾选
- **失败自动回退**：Verification 失败回到 Coding 重做直到全过；会话中断后续跑只需读 `.state.json`
- **可视化 DAG 编辑器**：拖拽 stage 顺序、拖入 atom-task 节点、点击锚点连线、勾选"合并审批"、实时无环校验
- **原子任务热插拔**：UI 扫描 `atom-tasks/*/`，对未使用 atom-task 一键"Add to stage"；ENABLED/DISABLED 走 `atomTaskOverrides` 覆盖层，不动 atom-task 自身 JSON
- **设计语言对齐**：UI 严格遵循 `DESIGN.md` 中 Ollama 风格 design system（纯黑白、pill 形按钮、12px 圆角卡片、无阴影）

## 🎯 适用场景

- 大型 / 中等复杂度的 AI 编程任务，需要先把 spec / plan 落到文档再开干
- 团队希望"AI 编程过程可审计、可回退、可复盘"
- 想把"代码 review / 测试规划 / 文档生成"这类常见子流程抽出来复用，而不是每次重写 prompt
- 需要按项目定制不同流水线编排（例如：纯文档项目跳过 Coding，纯重构项目跳过 Specification）

## 📦 发版与文档


| 版本    | 说明                                                |
| ----- | ------------------------------------------------- |
| 1.0.0 | 首版；12 阶段流水线、11 个默认 atom-task、UI 三 Tab 全量可用、零运行时依赖 |


## ⚡ 快速开始

ddo-swe 是个 **Cursor Agent Skill**，没有 CLI 也不需要安装；

### 1. 获取 skill

将该项目 clone 到你的 skills 目录。

### 2. 在目标项目里触发

新建一份 `requirement.md` 描述需求，或者直接在对话框里告诉 agent：

```
用 ddo-swe 跑一遍流水线，需求是：实现一个 reverseString(s: string): string 的纯函数模块。
```

agent 会按 `SKILL.md` 的执行循环：

1. 读 `config.json`，校验 schema 与 DAG 无环
2. 在目标目录下创建 `YYYY-MM-DD-<desp>/` 工作目录
3. 依次跑各阶段；遇到确认门时**停下来等你确认**，回复 `同意` 或 `修改：<意见>`
4. Coding 完成后自动跑 Verification；若失败自动回到 Coding 重做

### 3. （可选）打开 UI 编辑配置

需要改流水线编排或开关 atom-task 时，用浏览器（Chromium 系最佳）打开：

```text
skills/ddo-swe/ui/index.html
```

页面有三个 Tab：

- **Base**：`targetDir` / `contextPaths` / `contextOptional` / `<desp>` 生成规则
- **Pipeline**：12 阶段 DAG 可视化编辑——拖拽 stage、拖入 atom-task 节点、点击锚点连线、勾选"合并审批"
- **Atom-tasks**：扫描 `atom-tasks/`，对每个 atom-task 切换 ENABLED/DISABLED；对未使用的 atom-task 一键"Add to stage"

> Firefox / Safari 不支持 File System Access API 时，UI 会自动切换到 **Import / Export config.json** 兼容模式。

### 4. 查看产物

每次 run 的产物全部落在 `<target>/YYYY-MM-DD-<desp>/`：

```text
2026-05-23-reverse-string/
├── .state.json
├── spec.md
├── plan.md
├── test-plan.md
├── tasks/
│   ├── task-01.md
│   ├── task-02.md
│   └── task-group.json
├── verification.log
├── execution-report.md
└── reflection-report.md
```

## ⚙️ 配置说明

### `config.json` — 流水线编排

skill 根目录的 `[config.json](config.json)` 是**唯一真相源**，含三段：

```jsonc
{
  "version": "1.0.0",
  "base": {
    "targetDir": ".",
    "contextPaths": ["AGENTS.md", "README.md", "product.md"],
    "contextOptional": true,
    "respGenerator": { "maxLength": 32, "case": "kebab", "stripStopwords": true },
    "confirmationGates": ["specification", "planning", "test-planning", "reflection"]
  },
  "pipeline": [
    {
      "stage": "specification",
      "description": "AI 基于 Requirement 与 Context 生成 spec.md ...",
      "atomTasks": {
        "entry": ["spec"],
        "nodes": { "spec": { "next": [], "parallelApprove": false } }
      }
    }
    // ...另外 11 个 stage
  ],
  "atomTaskOverrides": {
    "review": { "enabled": false }
  }
}
```

完整 schema 见 `[config.schema.json](config.schema.json)`。改它前先读 `[docs/plan.md](docs/plan.md)` §4。

### `atom-tasks/` — 可插拔的原子任务

每个 atom-task = 一个子目录 = 一份 JSON + 它的附属产物（模板、check-list 等）：

```text
atom-tasks/
├── _schema/atom-task.schema.json
├── context/             context.json
├── requirement/         requirement.json
├── spec/                spec.json + spec_template.md
├── plan/                plan.json + plan_template.md
├── test-plan/           test-plan.json + test-plan_template.md
├── tasking/             tasking.json + task_template.md
├── coding/              coding.json
├── verification/        verification.json + verification_template.md
├── review/              review.json + check-list.md   (默认禁用)
├── reporting/           reporting.json + execution-report_template.md
└── reflection/          reflection.json + reflection-report_template.md
```

atom-task JSON 的 schema 见 `[atom-tasks/_schema/atom-task.schema.json](atom-tasks/_schema/atom-task.schema.json)`；字段说明见 `[docs/plan.md](docs/plan.md)` §5。

### 启用 / 禁用

不要直接改 atom-task JSON 的 `enabled` 字段。改 `config.json` 的 `atomTaskOverrides`：

```jsonc
"atomTaskOverrides": {
  "review": { "enabled": true },
  "spec":   { "enabled": false }   // 跳过 Specification stage
}
```

UI 的"Atom-tasks Tab → ENABLED/DISABLED"按钮等价于改这里。

## 📁 项目结构

```text
skills/ddo-swe/
├── SKILL.md                          # Cursor agent 入口；描述执行循环（无业务）
├── config.json                       # 默认流水线编排 + atom-task 覆盖开关
├── config.schema.json                # 上面这份的 JSON Schema
├── atom-tasks/                       # 11 个默认 atom-task（每个一个子目录）
│   ├── _schema/atom-task.schema.json
│   ├── context/        requirement/
│   ├── spec/           plan/         test-plan/
│   ├── tasking/        coding/       verification/
│   ├── review/         reporting/    reflection/
├── ui/                               # 零依赖可视化页面
│   ├── index.html
│   ├── styles.css                    # DESIGN.md tokens → CSS variables
│   └── app.js                        # FS + Schema + DAG + 3 Tab 全部单文件
└── docs/                             # skill 自身的开发文档
    ├── requirement.md
    ├── spec.md / plan.md / test-plan.md
    ├── tasks/                        # 自举 run 的 17 个 task
    ├── execution-report.md
    └── reflection-report.md
```

## 🤝 贡献

欢迎提交 Issue 与 PR。建议提交前：

- 修改 `config.schema.json` / `atom-task.schema.json` 时**必须**同步更新对应文档与默认 `config.json`
- UI 修改后请用 Chromium 系浏览器跑一遍 `[docs/test-plan.md](docs/test-plan.md)` 的 G7 / G8 group

## 📄 许可证

本项目采用 [MIT License](../../LICENSE) 开源协议。