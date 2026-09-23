# ASSESSMENT — v2 内测 → 转正式评估

> 评估依据：eval dogfooding 全链 run（20260924-014319-025b，standard 10 阶段 4 门）+ 82/82 回归测试
> 评估日期：2026-09-24 ｜ 评估人：用户（决议与内审）+ agent（执行与记录）

## 运行环境与执行主体（基础信息，结论的可复现前提）

| 项 | 值 |
|---|---|
| 执行主体（agent 角色） | Claude Code CLI 会话，模型 **glm-5.3** |
| 决议主体 | 真人用户（4 门决议 / 2 BQ 回答 / human 验收目检 / 内审） |
| 被测工具 | **ddo-code-flow v2-beta**（SKILL `version: 2.0.0`） |
| 代码基线 | git HEAD `77b7780`（feat/ddo-code-flow-v2）+ 运行中产生的工作区变更（D-1 占位符修复于 run 内做出，D-3/D-4 修复于 run 后内审做出——均随本 showcase 一并提交） |
| CLI | `node tools/cli.js`（零依赖 Node 内核） |
| Node | v22.23.1 |
| OS | macOS（Darwin 27.0.0） |
| DDO_HOME | 真实 `~/.ddo`（非隔离——顺带验证全局索引行为） |
| 执行窗口 | 本地 01:39–02:20（含中断重开与内审；净链路执行约 40 分钟，4 门人工决议在内） |
| 测试基线 | 82/82 用例全绿（含内审修复的 4 例新增回归） |

## 结论

**建议转正式**，附 2 个前置条件（均已就绪，随本归档一并交付）：

1. dogfooding 期间发现的阻断级缺陷修复随 showcase 提交（output-schema 占位符通配 + test-plan schema 归一 + 回归测试 2 例）；
2. 将「每版本发布前执行一次 eval 快速验证」固化为发布检查项（流程已定版于 eval/README）。

## 依据：本 run 验证了什么

| 维度 | 证据 | 判定 |
|---|---|---|
| 确认门（核心卖点） | 4 门全开全关，无决议推进全部被结构性拦截；决议与时间戳留痕完整可审计 | ✓ |
| BQ 澄清循环 | 2 个阻塞问题经相位内问答写回 spec，对齐变化摘要展示后重新送审；两次澄清实际改变了交付形态（砍掉 HTTP server 分支与历史数据源） | ✓ |
| 产物校验 | validate 在本 run 真实拦下 3 次（含 1 个产品级缺陷）；修正循环 2 次靠错误信息自定位闭环 | ✓（且抓到 bug） |
| 执行节律 | 位置锁拦下 1 次抢跑；tdd=false 相位按声明跳过 | ✓ |
| 全链完整性 | standard 10 阶段全部走完，requirement→reflection 无一跳过；tasking→coding 批次衔接正常 | ✓ |
| 生命周期 | 中断→aborted 正规收束→重开；done 收尾四步迁移（归档/jsonl/index/清空）全验证 | ✓ |
| 交付物质量 | 可视化工具 5 cmd + 2 human 验收全过；布局自检 0 交叉；对抗用例诚实标注 1 处不可消除交叉（符合设计边界） | ✓ |

## 发现的缺陷（dogfooding 的直接产出）

| # | 缺陷 | 严重级 | 处置 |
|---|---|---|---|
| D-1 | 契约占位符 heading（`{{ }}`）按字面匹配——**review / test-plan / verification 三任务的产物校验对任何真实内容必然失败**（含 schema 自带 example）。78 例单命令测试未覆盖「真实产物 × 契约」组合路径 | 阻断（全链 tail 段不可用） | 已修复：output-schema.js heading 通配 + test-plan schema 归一；回归测试 2 例 |
| D-3 | **时间戳全部 UTC**：runId（本地日期）与 startedAt（UTC）日期对不上，`at`/gate 留痕非上海时区、人工不可读（用户内审发现） | 高（留痕可读性/一致性） | 已修复：`nowIso()` 输出本地时区偏移 ISO；回归 1 例（格式 + runId 日期一致 + 偏移语义） |
| D-4 | **history 的 statePath 记相对路径**（随执行 cwd 变化）——归档追溯指针不可解析，与 index 注册形态不一致（用户内审发现） | 高（追溯链断裂） | 已修复：run finish 统一绝对化；回归 1 例（跨 cwd 传参 → history 绝对） |
| D-2 | 一次未复现的空渲染瞬态（工具读到空索引渲染空页，复跑即恢复，无数据损坏） | 观察 | 记录待观察；不阻塞（工具只读） |

## 执行审计（用户内审第三问，如实回答）

- **状态推进：100% 经 CLI**——run start ×2 / exec / validate / next（含 4 门 `--decision`）/ run finish ×2 全部走命令；未手改 state。
- **上下文组装：8/10 相位真实 exec 消费**；2 处捷径（中断重开后 requirement 的 exec 输出被丢弃、spec 的 exec 直接跳过复用前 run 记忆）——属「AI 凭上下文判断」替代「CLI 组装喂入」，发生于同会话 run 作废重开场景，当时无协议指引。
- **处置**：SKILL.md 逐相位循环补硬约束（当次 exec 当次消费、禁凭记忆替代、输出须完整消费）；「跳过 exec」的结构性拦截属 07-O3（窗口绑定登记）范畴，维持挂账。
- **命令面缺口**：coding 的「state 写任务完成标记」无 CLI 对应（09-O2 挂账），本 run 未受影响。

## 机制层观察（不构成阻塞，如实记录）

1. **plan ↔ test-plan 语义冲突无交叉校验**：plan 写 exit 1、test-plan 写 exit 0，靠 review 人审捕获并按「后批准者为准」裁决。三件套一致性目前是评审责任不是结构保证——真实痛点出现再考虑机制化。
2. **coding「state 写任务完成标记」无命令面**（09-O2 已挂账）：本 run 批次串行未受影响；并行批次场景会暴露。
3. **closedGates 概要字段不带 phase**（决议详情在 stages[k].gate 完整）：纯展示层小噪音。
4. dogfooding 本身证明了「每版本一次真实全链 run」的必要性——D-1 只有这一层能抓到。

## 内测期遗留清单（转正式后按真实需要排期）

- `list history` 查询面（数据已就位）/ 并行多门决议粒度 / 严格用户亲跑通道 / 预设自我进化（数据地基已就位）
- 可选：visualize.js 提升为仓库级工具 + 历史 run 可视化（BQ-1 当时收窄的范围）

## 归档清单

- `artifacts/`：requirement / spec / plan / test-plan / verification.log / review-report / execution-report / reflection-report / tasks/ / layout.js / visualize.js / ddo-visual.html（含当前位置标记的运行中快照）
- `state-archive/`：结束归档 state 副本 + history jsonl 双行（首个 aborted + 本 done）
- `timeline.md`：全事件时间线与机制触发记录
