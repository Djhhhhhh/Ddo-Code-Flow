# 工作项 03 · tools — 基础架构设计方案

> 版本：v0.1（2026-09-22 初版）
> 需求依据：[requirement.md](./requirement.md)（D1–D7）
> 契约依据：[../02-index-structure/plan.md](../02-index-structure/plan.md) v1.0

## 1. 定位

`tools/` 是 v2 的确定性执行内核：把索引基线（runId 计算、`.state.json` 读写、index 注册/移除、history 追加）落成可被 agent 直接调用的 CLI。**模型只调用、不实现**这些逻辑。

## 2. 目录结构

```text
tools/
├── cli.js                 # 唯一入口：命令注册表 + 参数解析 + 分发 + help 渲染 + 四通道封装
└── lib/
    ├── fsutil.js          # 原子写（临时文件+rename）、锁文件（O_EXCL + 超时重试 + 陈旧锁打破）
    ├── runid.js           # §5.2.1 runId 计算：YYYYMMDD-HHMMSS-<4位hex>；防碰撞重试
    ├── state.js           # .state.json 现读/原子写/基本校验（必填字段）
    ├── index-registry.js  # ~/.ddo/index.json：register / unregister / readAll（加锁+原子写）
    └── history.js         # ~/.ddo/history/runs.jsonl：追加 / 查询
```

零 npm 依赖，仅用 Node 内置模块（fs / path / os / crypto）。

## 3. CLI 契约

### 3.1 调用形态

```text
node tools/cli.js <domain> <verb> [--flag value | --flag=value]
node tools/cli.js --help | -h          # 全局总览
node tools/cli.js <domain> --help      # 域内子命令
node tools/cli.js <domain> <verb> --help
```

- 位置式两段子命令（D5）；无参数 = help（exit 0）；未知子命令 = stderr + exit 2。
- **命令注册表即文档源**（D4）：每个命令在注册表中声明 `{ name, summary, usage, options }`，help 纯渲染，不存在第二份文档。

### 3.2 四通道契约（D6）

| 通道 | 约定 |
|---|---|
| stdout | 仅结构化 JSON（命令的正式输出） |
| stderr | 非零退出时的人类可读说明 |
| exit code | `0` 成功 · `1` 硬失败（业务/IO 错误）· `2` 用法错误 |
| 状态文件 | `.state.json` / `index.json` 唯一事实源，每次调用现读，无内存缓存 |

### 3.3 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `DDO_HOME` | `~/.ddo` | 索引根目录（index.json、history/、锁文件所在）；测试/沙箱用 |

## 4. 子命令清单（本轮）

| 命令 | 职责 | 关键参数 |
|---|---|---|
| `run start` | 算 runId（防碰撞）→ 物化 stages → 建 `.state.json` → 注册 index | `--state <path>` `--title <text>` `--main-branch <name>` `--stages <json>` `--release-branch` `--development-branch` `--worktree-path` `--current` |
| `run update` | 状态推进：stage 状态/相位 + currentStage + at 刷新 | `--state <path>` `--stage <id>` `--status <enum>` `--current <a:01,b:01>` |
| `run finish` | 结束迁移：state.currentStage 清空 → history 追加 → index 移除 | `--state <path>` `--status done\|aborted\|failed` |
| `run show` | 读单 run 状态 | `--state <path>` |
| `list active` | 运行中列表（读 index + 惰性校验） | — |
| `list history` | 历史查询 | `--last <N>` |

**stages 物化规则**（`run start`）：调用方传**逻辑结构** `{"spec":{"dependOn":["requirement"]}}`，工具物化运行时字段——`status:"pending"`、`at:<startedAt>`；`currentStage` 缺省取 stages 首键 + `:01`。workflow 预设自动展开是下一轮能力。

**惰性校验**（`list active`）：`statePath` 不存在，或 state 的 `currentStage` 为空 → 条目标记 `valid:false`，不剔除（清理策略后续定）。

**结束迁移顺序**（`run finish`，对应基线 §7）：① `.state.json` 置 `currentStage: []`（原子写）→ ② history 追加一行（信息取自 state）→ ③ index 移除该 runId。崩溃于任意步均可被惰性校验兜住。

## 5. 并发与原子性（对应基线 §8）

- **原子写**：同目录临时文件 + `rename`（state / index / history 落盘前必经）。
- **index 锁**：`$DDO_HOME/.index.lock`，`O_EXCL` 创建；获取失败 50ms 重试、2s 超时报 exit 1；锁龄 >10s 视为陈旧，直接打破。
- **runId 防碰撞**：生成后与 index 现有 key 比对，冲突重掷随机后缀（至多 5 次）。
- **幂等**：注册同 runId 覆盖写；history 追加不去重（读取方容忍）。

## 6. 下一轮路线（D7，不在本期实现）

1. `next`：currentStage + stages DAG 推导下一个原子任务
2. 原子任务产物登记（依赖产物机制设计）
3. Prompt 组装/注入
4. workflow 预设格式 + `run start` 自动展开 stages

## 变更记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.1 | 2026-09-22 | 初版：基础架构（骨架 + 生命周期 + 查询） |
