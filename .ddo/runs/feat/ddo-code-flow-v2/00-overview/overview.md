# 工作项 00 · overview — ddo-code-flow 背景与定位

> v2 架构重设计的基线背景文档（2026-09-22 与用户对齐定稿）。所有后续工作项以本定义为共识起点。

## 一句话定义

**ddo-code-flow 是一个给 AI coding agent 用的「开发过程流水线」skill**——它不写业务代码本身，而是驱动 agent 按工程化流程把一个开发任务从需求做到交付。

## 解决什么问题

裸用 AI 写代码的问题是「一步到位、不可控、无过程」：没有需求澄清就直接动手、方案没人审、测试事后补、做完没有留档。ddo-code-flow 把资深工程师的工作方式固化成 agent 可执行的流水线：

```text
需求澄清 → 规约 spec → 技术方案 plan → 测试计划 → 任务拆分
   → 编码 → 验收 verification → 复审 review → 报告 → 复盘 reflection
```

三个核心价值：

1. **先想清楚再动手**——spec/plan/test-plan 先行，且带确认门：AI 生成方案 → 人审批准（`:02` 人审相位）→ 才推进。
2. **过程资产化**——每次 run 的需求、方案、测试计划、报告全部持久化到 `.ddo/runs/`，可追溯、可复盘。
3. **确定性与智能分离**——流程簿记（状态推进、DAG 校验、产物登记）下沉给脚本硬保证，AI 只做业务判断，不能自己跳过流程。

## 运行形态

- **寄生式 skill**：没有独立进程，长在 agent（Claude Code/Codex）里，靠 SKILL.md 指令 + 工具调用驱动。
- **每次 run 一个隔离环境**：Git worktree + 专属分支，run 产物随分支合并回项目。
- **原子任务是积木**：atom-task 自包含业务指令 + 产物角色契约（consumes/produces），当前 18 个（见 `atom-tasks/`）。
- **workflow 是装配器**：组合原子任务成流水线（v4 有 standard / lightweight / guarded / issue-driven 四种）。
- **状态可恢复**：`.state.json` 记录执行进度，中断可续跑。

## 能力边界

**做**：单仓库开发任务的阶段化执行、产物管理、分支/worktree 隔离、issue/PR 集成、人审门、断点恢复。

**不做**：

- 不替代 agent 的编码智能（atom-task 只是指令，执行靠 agent）；
- 不管部署运维，不做 CI（remote-gate 只等待信号）；
- 不动 git 可见性（不写 .gitignore / exclude）；
- v4 及之前为单机单项目视野——**多项目并发管理正是 v2 要突破的**。

## v2 主线：全局化 + 极简化

| 工作项 | 内容 | 与主线的关系 |
|---|---|---|
| 01 clear-work | 清空 v4 外围与机制文件，仅留 atom-tasks | 极简化：甩掉历史包袱 |
| 02 index-structure | `.state.json` / `~/.ddo/index.json` / history JSONL 三工件定版 | 全局化：多项目发现与追溯的地基 |
| 03 tools | CLI 注册框架（纯框架，命令随归属轮登记） | 确定性内核的操作面载体 |
| 04 cli-commands | 基本执行命令集定义 | agent 与流水线之间的操作面 |

## 版本叙事备注

内部版本号（v4.x）与用户侧「v2」命名的关系统一待定——属收尾阶段事项，不阻塞各工作项设计。
