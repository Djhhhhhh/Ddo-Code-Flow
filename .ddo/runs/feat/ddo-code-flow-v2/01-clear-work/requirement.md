# 工作项 01 · clear-work — v2 架构预清理

> v2 架构升级（发布分支 `feature/ddo-code-flow-v2` → 开发分支 `feat/ddo-code-flow-v2`）的第一个工作项：
> 清空 v4 时代的仓库外围辅助材料，只保留 skill 机制核心，为 v2 重新设计减负。

## 需求（用户确认的清理范围，2026-09-21）

删除（均为 git 跟踪文件）：

- `ui/`（index.html、studio.js、styles.css — 设计时静态 Studio）
- `assets/`（image.png — Studio 截图）
- `show_case.md`（v4 端到端示例，v2 时重写）
- `scripts/gh-watcher.sh`（issue 巡检脚本）
- `eval/`（评测方案 README — 用户点名纳入，原默认保留）
- `.claude/`（v4 责任边界规则、settings.json、settings.local.json）
- `CLAUDE.md`
- `README.md`
- `docs/`（change-logs/ 23 篇历史变更日志、metrics.md — 用户选择「更彻底」）

保留：

- `SKILL.md`、`config.default.json`、`config.schema.json`、`state.schema.json`
- `atom-tasks/`（全部原子任务均被 workflow 引用）、`workflows/`（4 个）
- `scripts/runtime/`（确定性内核 + 测试）、`scripts/metrics/`
- `.ddo/runs/` 历史 run 归档、`LICENSE`、`.gitignore`

## 附带修正

- `scripts/metrics/templates/metrics-report.md`：移除指向 `docs/metrics.md` 的链接，避免删除 docs/ 后产生死链。（该文件随后在第二轮中随 scripts/ 一并删除）
- `LICENSE`：版权人 `Djhhh` 系拼写错误，修正为 GitHub 账号 `Djhhhhhh`。

## 第二轮范围（用户追加，2026-09-21）

核心逻辑暂时仅保留 `atom-tasks/`，追加删除：

- `scripts/`（runtime 确定性内核 + 测试、metrics 插件 — v2 将重新实现）
- `workflows/`（4 个 pipeline 定义）
- `SKILL.md`
- `config.default.json`、`config.schema.json`
- `state.schema.json`

清理后仓库仅剩：`atom-tasks/`、`LICENSE`、`.gitignore`、`.ddo/`。

## 决策记录

- 删除 `CLAUDE.md` + `.claude/rules/` 意味着 v4 责任边界规则不再约束本仓库的后续开发——v2 设计摆脱 v4 规则重新开始，定稿后随新架构重写规则文件。
- `.ddo/runs/` 历史归档按 README 声明的「随分支合并回项目」机制刻意保留，本工作项不处理；v2 若调整归档策略另行立项。
- v4 的 runtime / workflow / config / schema 机制全部退场，仅 atom-task 库（业务指令 + 产物角色声明）作为 v2 设计的输入留存；旧实现随时可从 git 历史找回。
- `~/.claude/skills/Ddo-Code-Flow` 处仍装有一份 v4 skill 运行副本，本仓库清理不影响已安装副本，但 v2 期间两处会出现版本分叉，定稿后需重新安装同步。
