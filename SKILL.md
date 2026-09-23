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
4. **确认门状态化（07）**：任务的 `type: human` 相位是确认门的**声明**（注册源，可选
   `gate.options` 选项集定制——用户词汇决议名（如 同意/驳回/修改/提问），action 分推进型/
   转移型/相位内交互 in-phase）；进入该相位的推进命令把门实例（含选项集）注册进
   `stages[k].gate`；CLI 拦截「门未关就推进」，agent 负责呈现与代跑，不负责放行。
5. **节律结构锁（07）**：exec/validate 只服务 `currentStage` 中的位置（相位缺省 = 当前相位，
   不一致即拦）——不 next 就停在原相位，执行节律由结构保证而非指令约定。
6. **四通道**：stdout=JSON（exec 为裸文本例外）/ stderr=人话 / exit 0·1·2 / state 现读不缓存。

## 驱动一个 run

```bash
# ① 启动（返回 statePath 与起点；git 信息自动推断，非 git 环境置空）
node tools/cli.js run start --title "<一句话描述>"

# ② 逐相位循环，直到 next 返回 completed:true
读 state.currentStage → 得 <stageId>:<phase>
node tools/cli.js exec      --state <statePath> --task <stageId>   # 相位缺省=当前位置
node tools/cli.js validate  --state <statePath> --task <stageId>
node tools/cli.js next      --state <statePath>

# ③ 确认门（next 输出 openedGates，或 status 显示 waiting-human）
#    用宿主提问工具把门的选项清单（name/desc/action）原样呈现给用户；用户选择后按 action 处理：
node tools/cli.js next --state <statePath> --decision 同意    # 推进型决议（用户词汇）
#    转移型（action 是 rollback / run finish）→ agent 代跑声明的命令；
#    相位内交互（action 是 in-phase，如 修改/提问）→ 按该相位 prompt 的行为定义处理，不触推进命令

# ④ 中断恢复（新会话接手 run 时）
node tools/cli.js status --state <statePath>    # 当前位置 + gateOptions（呈现集）+ availableCommands（可执行集）

# ⑤ 结束（唯一收口入口）
node tools/cli.js run finish --state <statePath> --status done   # 或 aborted / failed
```

**确认门协议（agent 呈现、用户选择、agent 代跑）**：门未关闭时 `next` 会被拦截
（exit 1，stderr/stdout 直接给出选项清单——错误信息本身就是提示）。不得替用户决议、
不得省略呈现直接带 `--decision` 推进；转移型（如 驳回→rollback）与相位内交互
（in-phase，如 修改/提问）喂给 `next` 同样会被拦。

**中断恢复协议**：调 `status`，把 `gateOptions`（呈现集，含相位内交互）与
`availableCommands`（可执行集）原样转述给用户后等选择——提示来自结构化输出，不自行发挥。

`validate` 失败（exit 1）时进入修正循环：按 stderr 指出的缺失/结构问题修正产物后重新校验，
不要带错推进（重放当前相位 exec 是合法的）。

## 硬边界

- 运行期不写 `skillRoot`；不修改 `.gitignore` 或 git exclude。
- 回滚用 `rollback --stage <stageId>`（每次一个阶段），不要手工改 stages 状态；
  回滚会清除该阶段未关闭的确认门（重做后重新送审）。
- 需要认证/TTY 的命令（如 `gh auth login`）不得代跑——交给用户在宿主 shell 执行。

## 当前状态与边界（v2）

已定版并实现：索引结构（02）、CLI 框架与命令集（03/04：run start / run finish /
rollback / exec / validate / next）、原子任务 v2 全量改造（05，17 个任务）、
workflow 预设与启动装配（06，`workflows/basic.json`）、执行节律与确认门状态化
（07：`stages[k].gate` + `--decision` + `status` + 位置拦截）。

诚实边界：门拦截保证「未决议不推进」（结构性），不防 agent 伪造决议——呈现协议是
本 SKILL 级约束，决议留痕（decision/closedAt）供审计；严格用户亲跑通道留后续可选。
