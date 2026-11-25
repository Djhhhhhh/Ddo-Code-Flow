# 用户需求

> 用户触发此流水线的原始需求描述。

## 原始需求

---
name: 功能提议
about: 新原子任务 / 新预设 / 新命令 / 机制扩展
labels: enhancement
---

## 场景与痛点

本机已在 `~/.ddo/` 持久注册自定义流程（run 20261116-114950-3c02 交付：`ones-o` 创建应用变更单、`ones-d` 交付 RND+变更项+绑定，含 `~/.ddo/atom-tasks/` 三个自定义任务与 `~/.ddo/profiles/` 域配置单档案）。真实使用中发现：**新会话（尤其非 Claude Code 宿主）输入 `ones-d` 启动时**——

- `list workflows` 缺省只扫 skillRoot 内置目录，看不到 `~/.ddo` 注册的预设；
- agent 只能按 SKILL.md「自定义」缺省路径在系统临时目录翻找/另写预设，或全盘文件搜索数分钟才命中 `~/.ddo/workflows/`（本 run 期间两轮实测：第一轮翻临时目录很久才从 run 快照找到；第二轮靠稳定落点数步命中）；
- 现有绕法（`~/.ddo/README.md`、项目 `.ddo/CUSTOM-FLOWS.md`、宿主记忆）均为**被动可发现性**：能找到，但每次启动仍多付数步搜索，且跨宿主/跨项目不保证。

## 期望的行为

- `list workflows`、`guide`、`run start` 的预设解析**缺省合并检查 `~/.ddo/workflows/`**（用户本地注册目录）与 `~/.ddo/atom-tasks/`；
- `list workflows` 不带参数即列出 `ones-o`/`ones-d` 等本地注册流程；guide 模式选择输入 `ones-d` 一步命中并按注册目录启动；
- 合并语义：**加性、同名冲突 fail-fast、不遮蔽内置预设**；
- 行为可预期：未部署 `~/.ddo` 的机器行为与现状完全一致。

## 涉及面初判

- CLI 命令：`list` / `guide` / `run start` 的预设与任务目录解析（cli.js:577-578 一带）
- 目录语义：`~/.ddo/` 用户本地注册目录（workflows / atom-tasks / profiles）
- 引擎 lib：新增 sources 合并解析模块（即既有的 `sources.js` 批准设计）
- state schema：预计不变（启动时解析，不落新字段）

## 方案讨论

此前已批准设计（记忆 `ddo-user-local-loading-source`）：`~/.ddo/atom-tasks`+`workflows` 注册 + `lib/sources.js` 合并解析——加性、冲突 fail-fast、不遮蔽内置。本 run 已产出可用的注册目录结构（`workflows/*.json` + `atom-tasks/<task>/{config.json,prompt.md}` + `profiles/*.json`）可直接作为加载源与验收样例；验收即「新会话输入 ones-d 零搜索直接启动」。按项目纪律走 requirement → spec → plan 门评审后再动代码；注意 profiles 目录是否纳入自动发现（当前流程经 atom-tasks prompt 引用 profiles 路径，无需引擎感知）可在 spec 阶段定界。

## 需求摘要

CLI 的 list / guide / run start 缺省合并解析 `~/.ddo/` 用户本地注册的 workflows 与 atom-tasks（加性、同名冲突 fail-fast、不遮蔽内置预设），使新会话零搜索直接启动本地注册流程。
