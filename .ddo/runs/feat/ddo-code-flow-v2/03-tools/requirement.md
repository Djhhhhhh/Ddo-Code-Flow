# 工作项 03 · tools — 全局工具集与原子任务联动工具设计

> 状态：**基础架构实施中**（2026-09-22）

关联基线：[../02-index-structure/plan.md](../02-index-structure/plan.md)（v1.0：.state.json / index.json / history 结构、runId 计算方法、生命周期、写入协议——工具集是这些契约的执行者）。设计详见 [plan.md](./plan.md)。

## 已确认决策

| # | 决策 | 依据 |
|---|---|---|
| D1 | 仓库根创建 `tools/` 目录承载工具集 | 用户定版 |
| D2 | 形态：**CLI 单入口 + 子命令分发**，一个子命令对应一块逻辑 | 用户定版 |
| D3 | 实现语言：**Node.js**（保证通用性，零依赖） | 用户定版 |
| D4 | **不设 README**：CLI 自带 `--help`，帮助内容由内部命令注册表生成（注册处即文档源），杜绝文档与实现漂移 | 用户定版 |
| D5 | 子命令语法：**位置式两段**（`cli.js run start`，域+动词）；`--help` 作为全局 flag 共存。理由：与 git/npm/docker 等主流工具训练分布一致，AI 调用幻觉率最低；文法无歧义、help 可分层 | 用户委托评估后选定 |
| D6 | **四通道契约沿用**：stdout 结构化 JSON / stderr 人类可读 / exit 0·1·2 分级 / 状态文件现读不缓存 | 用户确认 |
| D7 | **本轮只做基础架构**：CLI 骨架 + run 生命周期 + 全局查询；`next`、原子任务产物登记、Prompt 组装、workflow 预设展开移到下一轮 | 用户定版 |

## 范围

**本轮（基础架构）**：

- `tools/cli.js`：命令注册表 + 分发 + help 渲染 + 四通道封装
- `tools/lib/`：runid / state / index-registry / history / fsutil（原子写、锁）
- 子命令：`run start` / `run update` / `run finish` / `run show` / `list active` / `list history`

**下一轮**：

- `next`（currentStage + stages DAG → 下一个原子任务）
- 原子任务产物登记、Prompt 组装
- workflow 预设格式与 stages 自动展开（本轮 `run start` 以 `--stages` 显式传入逻辑结构，运行时字段由工具物化）
