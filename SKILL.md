---
name: ddo-code-flow
description: |
  Engineering pipeline skill for AI coding agents. Drives requirement → spec
  → plan → coding → reporting through atom-tasks assembled per-phase by a
  deterministic Node CLI. 面向 AI 编码代理的工程化流水线：按阶段组装恰好必需的
  prompt，产物按 schema 规范化，.state.json 为唯一事实源。
metadata:
  authors:
    - "djhhhhhh"
  version: "2.0.0"
---

# ddo-code-flow

## 何时使用

用户要求「跑流水线」「按 ddo 流程开发」「use ddo-code-flow」，或明确要走过
需求 → 规格 → 计划 → 编码 → 报告的多阶段流程时激活本 skill。
一次性的小改动、问答、单文件修复不需要流水线，不要激活。

## 运行位置

- `skillRoot`：本 SKILL.md 所在目录（atom-tasks / workflows / tools）。运行期只读，不得写入。
- `projectRoot`：用户调用时的项目根。run 状态写在 `<projectRoot>/.ddo/runs/<type>/<dirName>/.state.json`。
- `DDO_HOME`：全局索引目录，缺省 `~/.ddo`（`index.json` 运行中指针、`history/runs.jsonl` 历史）。
- CLI 入口：`node <skillRoot>/tools/cli.js <命令>`。

## 核心契约

1. **格式分界**：脚本读的写 JSON，agent 读的写 markdown——exec 组装出的 prompt 也是 md。
2. **`.state.json` 是唯一事实源**：读 `currentStage`（形如 `spec:01`）决定当前要做什么；
   一切推进通过语义命令（`next` / `rollback` / `run finish`），不要手改 state。
3. **渐进式加载**：每次只 `exec` 当前相位——指令、恰好必需的上下文（ctx 钩子按 state 现算）、
   Output Contract 会被组装进一个 prompt；不要全量加载任务文件。
4. **确认门随任务走**：任务的 `type: human` 相位就是确认门（status 置 `waiting-human`），
   workflow 不单独配置确认。
5. **四通道**：stdout=JSON（exec 为裸文本例外）/ stderr=人话 / exit 0·1·2 / state 现读不缓存。

## 驱动一个 run

```bash
# ① 启动（返回 statePath 与起点；git 信息自动推断，非 git 环境置空）
node tools/cli.js run start --title "<一句话描述>"

# ② 逐相位循环，直到 next 返回 completed:true
读 state.currentStage → 得 <stageId>:<phase>
node tools/cli.js exec      --state <statePath> --task <stageId> --phase <phase>
node tools/cli.js validate  --state <statePath> --task <stageId> --phase <phase>
node tools/cli.js next      --state <statePath>

# ③ 结束（唯一收口入口）
node tools/cli.js run finish --state <statePath> --status done   # 或 aborted / failed
```

`exec` 输出的 prompt 顶部若出现「交互硬约束」块：该相位包含必须完成的交互，
未完成前禁止调用任何推进命令（next / rollback / run finish）；
与用户的交互必须使用宿主提问工具（如 AskUserQuestion）执行，不得以自由文本代替。

`validate` 失败（exit 1）时进入修正循环：按 stderr 指出的缺失/结构问题修正产物后重新校验，
不要带错推进。

## 硬边界

- 运行期不写 `skillRoot`；不修改 `.gitignore` 或 git exclude。
- 回滚用 `rollback --stage <stageId>`（每次一个阶段），不要手工改 stages 状态。
- 需要认证/TTY 的命令（如 `gh auth login`）不得代跑——交给用户在宿主 shell 执行。

## 当前状态与边界（v2）

已定版并实现：索引结构（02）、CLI 框架与命令集（03/04：run start / run finish /
rollback / exec / validate / next）、原子任务 v2 全量改造（05，17 个任务）、
workflow 预设与启动装配（06，`workflows/basic.json`）。

`waiting-human` 相位目前只做数据表达（状态先行）；离开确认门的强制检查
（L3 状态机门）与执行循环自动化属后续轮次——在此之前由本 SKILL 的驱动循环
与交互硬约束约定兜底。
