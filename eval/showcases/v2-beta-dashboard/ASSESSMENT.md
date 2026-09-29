# ASSESSMENT — v2-beta dashboard showcase（WTT single + basic 全链）

> 评估依据：eval dogfooding showcase run（20260929-221955-b3cd，basic 5 阶段 2 门，WTT single 场景）+ 118/118 回归测试
> 评估日期：2026-09-29 ｜ 评估人：用户（决议与定夺）+ agent（执行与记录）

## 运行环境与执行主体（基础信息，结论的可复现前提）

| 项 | 值 |
|---|---|
| 执行主体（agent 角色） | Claude Code CLI 会话，模型 **glm-5.3** |
| 决议主体 | 真人用户（2 门决议 / 2 BQ 回答 / 归档目录与分支去向定夺） |
| 被测工具 | **ddo-code-flow v2-beta**（SKILL `version: 2.0.0`，安装副本 `~/.claude/skills/Ddo-Code-Flow`） |
| 代码基线 | git main `3a74e78`（PR #61 合并点）；run 于 worktree 分支 `feat/ddo-index-dashboard` 上执行 |
| CLI | `node <skillRoot>/tools/cli.js`（零依赖 Node 内核） |
| Node | v22.23.1 |
| OS | macOS（Darwin 27.0.0） |
| DDO_HOME | 真实 `~/.ddo`（非隔离——顺带验证全局索引行为） |
| 执行窗口 | 本地 22:19:55–22:46:45（约 27 分钟，含 2 门人工决议与 BQ 问答） |
| 测试基线 | 118/118 用例全绿（`node --test tools/tests/*.test.js`，coding 后复跑） |

## 结论

**通过**：WTT single 场景 + basic 全链的可演示性成立，机制可对外 showcase；未发现阻断缺陷，无前置条件。

## 依据：本 run 验证了什么

| 维度 | 证据 | 判定 |
|---|---|---|
| WTT single 场景（首次实战） | 冷启动问答定分支名 → 前置建分支与工作树 → `run start --project <工作树>` 落位 → `state.git` 自动捕获 branch/worktreePath → finish 归档，全程无中途迁移、无分裂拓扑；worktree-info.json 审计登记 | ✓ |
| basic 链完整性 | requirement → spec → plan → coding → reporting 5 阶段全部走完，无一跳过；每相位 exec 组装→validate→next 节律执行 | ✓ |
| BQ 澄清循环 | 2 个阻塞问题（交付形态/代码归属）经相位内问答写回 spec，对齐变化摘要展示后重新送审；两次澄清实际改变了交付物（静态单文件 HTML + 沙箱归属，砍掉服务与拖载分支） | ✓ |
| 呈现协议（结构闭环） | 门 payload 经 `gate present` 取用并留痕；BQ 交互后重新呈现才决议——re-ask 由结构强制路径真实走到 | ✓ |
| 只读消费边界 | dashboard 链路对 `~/.ddo` 与各 `.state.json` 零写入；finish 后 index.json 注销为空 map（`{}`） | ✓ |
| 自举演示价值 | dashboard 快照两次捕捉到 run 自身：coding:01（coding 自检时）与 reporting:01（reporting 刷新时）——「用流水线开发监控流水线的工具」闭环成立 | ✓ |
| 容错三级边界 | 空索引→空态提示 exit 0；指向缺失 state 的条目→降级行不阻塞且 type 仍可从路径提取；index.json 损坏→exit 1 + stderr 人话 | ✓ |
| 生命周期收口 | run finish done 四步齐验：state 副本归档 `~/.ddo/history/<runId>/.state.json`、runs.jsonl 追加、index 注销、runDir 原位随版控 | ✓ |

## 与 v2-beta 先例（visualizer）的关系

同机制复用而非重跑：visualizer 验证的是 standard 全链与工作流图布局；本次验证的是 **WTT single 场景 + basic 轻量链**，case 侧复用其「读 index → 解析 state → 单文件 HTML」模式与五状态语义（`--home`/`--out`、四通道契约），互补覆盖。

## 备注

- 快照时效为设计边界：dashboard 为生成时刻内嵌快照非实时（页面标注 generatedAt；刷新 = 重跑 `node build.js`）。
- run finish 后 run 从 index.json 注销——最后一代有效快照产于 reporting 相位（本归档 artifacts 内 `eval/runs/20260929-ddo-dashboard/dashboard.html`）。
