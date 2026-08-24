# 需求原文：ddo-code-flow 演进调研 — 把确定性内核下沉到 runtime 代码

> 调研性质：探索性技术问答沉淀。本文只记录调研中已明确的事项；方向性但未细化到实现级的，显式标注。

---

## 1. 为什么要做

### 现状
ddo-code-flow 的"状态机"写在 `SKILL.md` 的散文里：DAG 校验、角色注入、状态写入归属、确认门控，都靠 LLM 在散文指引下**自觉执行**。模型同时充当生成器与解释器。

### 根因诊断
不是"项目复杂度过高导致上下文加载有问题"。复杂度本身合理，问题在**该硬的地方还太软**——确定性机制放错了层：

| 维度 | 判断 |
|---|---|
| 加载时体积 | 其实不大（`SKILL.md` 312 行 + atom-task 按需加载），不是"加载爆了" |
| 长跑保持与漂移 | 真问题。9 阶段 4 门、否决重做，跨几十轮 + 摘要压缩后，散文约束被悄悄稀释 |
| 确定性放错层 | DAG 校验 / 角色注入 / 状态写入归属 / 门控，本该是代码不变量，却交给 LLM 自觉 |

一句话：**该硬的机制层用了软散文，跨长跑后约束被丢弃且不报错。**

### 证据锚点（均为已存在的事实）
- **真实 run**：`.ddo/runs/fix/2026-08-09-context-paths-bug-fix/.state.json` 的 spec 阶段有两次 `spec-revised` 否决重生成（05:35、05:37），`gate-approved` 在 05:40。否决→重生成→归档旧版→重请确认，全靠模型自觉。
- **x-ddo-writer 只是注释**：`state.schema.json` 里每个顶层字段标了 `x-ddo-writer`（如 `worktreePath`→`git-worktree`、`currentStage`→`runtime`），但没有代码拦——"谁该写"只是注释，模型可能越权写或自造顶层字段。
- **plugin.js 已是代码先例**：`scripts/metrics/plugin.js`（267 行 Node CommonJS）已用"子命令 + stdout JSON + exit 码 + 读写 .state.json"的范式跑通。runtime 化不是开荒，是复用已验证的范式。

---

## 2. 不变的核心：四层职责模型

演进只动 runtime 这一层，其余三层不动。

| 层 | 拥有 | 禁止拥有 |
|---|---|---|
| atom-task | 业务指令、produces/consumes 角色、options | 阶段归属、具体产物路径、上游任务名 |
| workflow | 阶段顺序、DAG 节点、taskRef、确认门 | 业务指令、产物文件路径 |
| config | 全局默认、项目覆盖、选项覆盖 | 生成的运行态、per-run effective config 文件 |
| runtime | 配置组合、DAG 校验、角色注入、注册、状态、恢复 | atom-task 已拥有的业务决策 |

演进目标：runtime 从"散文解释器"变成"代码 + 扩展点"，**让模型只做生成、不做解释器**。

---

## 3. 实施路径

依赖顺序分批。P0.5 / P0 已细化到命令级；P1 / P2 为方向性，本次调研未细化到实现级。

### P0.5 · 最小硬化（当下）
在现有散文 runtime 之上加两个 post-node 动作，不动调度：
- **validate-output**：节点产出后，按 atom-task 的 `outputSchemaRef`（`skill://` 解析）做 schema 校验。不通过 → exit 1 硬拦。
- **register-artifact**：模型产出文本经 stdin 传入；命令落盘到 artifactDir、写 `.state.json.artifacts`、追加 `history`。模型不再手写黑板登记。
- 收益：最脆的软约束（BQ 偷懒、黑板漏登记）立刻变硬；对存量 run 无影响（纯增量）。

### P0 · runtime 子命令化（短期）
把散文里的 Step 1–7 落成独立 Node CLI 子命令。命令清单与职责（对应 `SKILL.md` 的执行步骤）：

| 子命令 | 对应 Step | 职责 | 对 .state.json 的访问 |
|---|---|---|---|
| `compose-config` | Step 1 | 深合并 config.default + .ddo/config.json + run 参数；stdout 给 JSON，**不落盘** | 只读 / 不写 |
| `select-workflow` | Step 2 | `--model` 显式或按 selection.rules 匹配或 fallback；返回 workflowId/runType/workflowPath | 只读 |
| `validate-dag` | Step 3 | 拓扑遍历 workflow，required consumes 必须在上游已产出，否则 exit 1 | 只读 |
| `init-state` / `find-resumable` | Step 4 | 扫描可恢复 run（currentStage≠done 且锚点匹配）；创建/续 .state.json | 写（runtime 字段） |
| `next-node` | Step 5 | Kahn 选下一批节点；解析 consumes 取路径、替换 `{{inputs.*}}`、合并 options；stdout 吐 self-contained instruction | 只读 |
| `register-artifact` | Step 5 | stdin 接产出文本；落盘 + 写 artifacts + 追加 history | 写（writer=runtime） |
| `validate-output` | P0.5 | 按 outputSchemaRef 校验产出 | 只读 |
| `gate` | Step 6 | approved 放行 / rejected 自动归档旧版到 `_del` + 追加 gate-rejected + 标 rework-pending | 写 history（runtime） |
| `advance-stage` | Step 7 | 终态硬检查：阶段全 done/合法跳过、门全批准、无 running/failed、无 pending；全满足才推进 currentStage | 写 currentStage/stages（runtime） |

### P1 · 预计算 + 分层加载（中期，方向性，未细化到实现级）
- `next-node` 预计算 per-node prompt（inputs 已注入、options 已合并），模型拿到的 instruction 自包含。
- 配合分层加载，只加载当前节点所需上下文。
- 目标：消除长跑漂移（模型不再需要"记得"状态，状态每次由命令现读）。

### P2 · 阶段级动态裁剪（长期，方向性，未细化到实现级）
- 按需裁剪非必要阶段，复杂度按需付费。
- 本次调研仅确立方向，不含实现细节。

---

## 4. 脚本执行机制（已明确）

### 形态
runtime **不是常驻服务**，而是一堆**无状态的 Node CLI 子命令**。模型在 `SKILL.md` 指引下用 Bash 工具调 `node ddo.js <subcommand>`。状态全在 `.state.json` 文件里，不在内存——崩溃或换轮都不丢。

### 四件套契约

| 通道 | 约定 |
|---|---|
| stdout | 只吐结构化 JSON（或预计算 prompt 文本）。模型读它决定下一步，不混人类日志 |
| stderr | 人类可读错误说明。exit≠0 时模型据此修正 |
| exit code | 0=ok / 1=硬失败（拦下，进修正循环）/ 2=用法错误 / 77=pending（远程门/CI） |
| .state.json | 唯一状态来源。命令现读现写，无内存缓存 |

### 退出码不是崩溃，是受控失败
`validate-output` / `validate-dag` / `advance-stage` 会故意 exit 1——这是把"该硬的地方"用进程退出码表达。模型看到非零退出码 + stderr，进入修正循环：读 stderr → 改产出 → 重新 register → 重新 validate。门是否通过，由代码说了算，不由模型自评。

### applyMutation 写入守卫
所有命令写 `.state.json` 都走唯一函数 `applyMutation(state, patch, writer)`：
1. 进程启动时读 `state.schema.json`，建 **field→writer** 表（来自各字段的 `x-ddo-writer`）。
2. 写入前校验：当前命令的 writer 是否拥有这些字段。
3. 越权写或自造顶层字段（`additionalProperties:false` 已禁）→ exit 1。

落地效果：`x-ddo-writer` 从"希望大家遵守的注释"变成"拦截器"。

### 协议解析
- `skill://` → 解析到 skillRoot（只读，skill 自带）。如 `outputSchemaRef: "skill://atom-tasks/spec/spec.output.schema.json"`。
- `project://` → 解析到 projectRoot/.ddo/（项目自有）。如 `hooks.post: "project://.ddo/hooks/spec-jira-lint.js"`。
- `run://` → 解析到 artifactDir（本次运行产物）。artifacts 里的 path 都用它。

### 为什么进程式而非常驻服务
- 可恢复：状态在文件，崩溃后下次命令现读 .state.json 即续跑。
- 已有先例：`plugin.js` 就是同一范式。
- 天然适配 Claude：Bash 工具就是 stdin/stdout/exit code。
- 无竞态：模型串行调命令，一次一个进程，无并发写。
- 成本：node 启动约百毫秒，远小于模型生成耗时。

---

## 5. 技术选型（已明确）

### 选 Node，不选 bash / PowerShell
| 运行时 | macOS | Windows | 判断 |
|---|---|---|---|
| bash / POSIX sh | 自带 | ❌ 不自带（要 WSL/Git Bash） | 只覆盖一边 |
| PowerShell | ❌ 不自带 | 自带 | 只覆盖另一边 |
| Node | 要装 | 要装 | 见下 |

- **没有脚本语言在 Mac 和 Win 两边都天生自带**。"两边都原生支持"在脚本层不成立；真能两边零依赖的只有预编译单文件二进制（Go/Rust），但对会频繁演进的 skill runtime 是过重的分发负担（每次改要交叉编译 + 分发版本 + 用户更新二进制）。文本分发（JS）下次加载即生效。
- **Node 在本场景不构成额外依赖**：Claude Code 本身就是 Node 应用，能用这个 skill 的人必然已装 Claude Code → 必然有 Node。"需要 Node"与"需要 Claude Code"是同一个前提。
- **这类逻辑用 shell 写不可靠**：JSON 深合并、schema 校验、DAG 拓扑用 bash 写极脆（解析 JSON 还得拉 jq，又一份依赖）。

### 跨平台靠"不碰 shell 语法"，不靠换语言
真正的平台差异风险是 shell 语法与路径，解法：runtime 命令本身是 Node 进程，内部用 `path.join()`（不拼字符串分隔符）、用 `child_process`（不塞给 `sh -c`），就天然跨平台。

### 把"平台原生"需求下放到 hook 层
hook 扩展点（项目自有）用什么都行——bash / PowerShell / python，runtime 只认 exit code，不关心语言。runtime 内核用最稳的 Node，hook 层由用户按本机环境自决。

---

## 6. 定制需求怎么落（已明确）

runtime 硬化 ≠ 写死业务。三分类，两不碰 runtime 内核：

| 类别 | 做法 | runtime 是否改动 |
|---|---|---|
| **A. 业务内容定制**（最常见） | 新建 `atom-tasks/<name>/<name>.md`（纯散文业务指令）+ workflow JSON 用 taskRef 引用 + `artifacts.json` 声明 role | 不改，对所有节点一视同仁 |
| **B. 确定性定制** | atom-task frontmatter 声明 `hooks.pre/post` 或 `gate.hook`，指向 `project://.ddo/hooks/*.js`；声明了就跑，没声明就跳过 | 不改（扩展点已预留） |
| **C. 一次性零碎事** | 别进流水线，在相关 atom-task 里顺手做 | 不改 |

hook 声明样例：
```yaml
hooks:
  pre:  "project://.ddo/hooks/spec-jira-lint.js"
  post: "project://.ddo/hooks/spec-jira-lint.js"   # outputSchemaRef 是它的特例
gate:
  hook: "project://.ddo/hooks/wait-ci-green.js"
# skill:// skill 自带；project:// 项目自有。返回 ok 放行 / rejected 重做 / pending(77) 轮询。
```

---

## 7. 配套源文件（只读参考，不在本文展开）

| 文件 | 作用 |
|---|---|
| `SKILL.md` | 现状散文状态机（312 行），演进对照基准 |
| `state.schema.json` | x-ddo-writer / additionalProperties:false，applyMutation 守卫的数据源 |
| `config.schema.json` | config 合并的元 schema |
| `atom-tasks/artifacts.json` | 17 个角色目录，角色注入的解析依据 |
| `workflows/standard.json` / `guarded.json` | DAG 与确认门定义 |
| `scripts/metrics/plugin.js` | runtime 子命令的代码先例（CommonJS、子命令、stdout JSON、exit 码） |
| `.ddo/runs/fix/2026-08-09-context-paths-bug-fix/.state.json` | 真实 run，spec 两次否决重生成，before/after 对比锚点 |

> 交互版对比报告（时序图 / 流程图 / 节点可点击）：同目录 `index.html`。
