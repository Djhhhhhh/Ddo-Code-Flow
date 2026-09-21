# 工作项 02 · index-structure — 全局索引文件结构设计

> 状态：**已定版**（2026-09-21，方案 v1.0 见 [plan.md](./plan.md)，供后续工作项作为架构基线使用）

## 目标

为 v2 建立两级状态/索引体系，支撑多项目并发 run 的统一发现、管理与事后追溯：

1. **用户级全局索引**（`~/.ddo/index.json`）：纯指针注册表，快速回答「本机当前有哪些运行中的 workflow」。
2. **项目级状态**（各项目内 `.state.json`）：唯一事实源，承载 run 的全部状态细节。

## 范围

**做**：

- `~/.ddo/index.json` 结构（纯指针，单文件）
- `~/.ddo/history/runs.jsonl` 结构（全局历史，单 JSONL 文件起步）
- `.state.json` 的结构约定（runId / git / currentStage / stages / atomTasks）
- 三者的生命周期约定（注册 / 更新 / 结束迁移 / 崩溃残留处理）

**不做**（后续工作项）：

- 状态更新脚本的具体逻辑（`.state.json` 更新与索引同步）
- 预设 workflow 配置的格式与阶段生成规则（脚本从预设动态生成 stages）
- history 行的完整字段集（先 v0 最小集）
- 可视化面板

## 已确认决策

| # | 决策 | 依据 |
|---|---|---|
| D1 | `.state.json` 是唯一事实源，承载 run 全部状态细节（git 拓扑、currentStage、stages、atom-task 配置） | 用户定版 |
| D2 | `~/.ddo/index.json` 为**纯指针注册表**：每个运行中 run 只记 `.state.json` 路径等最小信息，不复制状态内容 | 用户定版（v2 修订：简化逻辑） |
| D3 | 历史先做全局单文件 `~/.ddo/history/runs.jsonl`（JSONL 防止单文件过大），行内容字段后续设计 | 用户定版 |
| D4 | 索引「简单优先」：只在启动注册、结束迁移两个时点变化；面板不依赖其实时性 | 用户定版 |
| D5 | `currentStage` 支持 `stageId:相位号` 记法（如 `spec:01`/`spec:02`），表达「动作段 + 人审段」两段式阶段 | 用户定版 |
| D6 | 状态中不保存完整 Prompt、上下文和长日志，atom-task 只存配置 | 用户定版 |
| D7 | 阶段状态枚举沿用 v4：pending / running / done / failed / skipped / rework / waiting-human / waiting-remote-gate | 用户草案：沿用现有定义 |
| D8 | `.state.json` **不含 workflowId**：workflow 来自预设配置，由脚本在启动时按预设动态生成所需阶段写入 `stages`——状态文件是自包含的实例数据，不回指配置 | 用户定版（v2 修订） |
| D9 | **runId 与语义分离**：runId 为无语义机器标识，计算方法 `YYYYMMDD-HHMMSS-<4位hex随机>`（run 启动本地时间 + 随机后缀，定长 18 字符，字典序即时间序）；人类可读描述由新增必填字段 `title` 承载 | 用户定版（v3 修订：原「项目名-分支名」拼接不利于存储） |

## 约束

- `~/.ddo/` 属用户目录，skill 运行期只按约定维护上述两类索引文件，不存放其他运行时产物。
- `index.json` 为多项目并发共写文件，写入方必须保证原子性与幂等（详见 plan.md 写入协议）。
- 时间一律 ISO 8601 带时区偏移。
