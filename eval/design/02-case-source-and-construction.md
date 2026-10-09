# 02 · 评测题来源与题目构建

> 状态：方案稿（待评审）· 对应 Plan revision 2 · 2026-10-08

## 1. 题来源（三类，各标注适配结论）

| 来源 | 说明 | 行业适配结论 |
|---|---|---|
| S1 · dogfooding 历史 | 仓库内既有真实需求：`.ddo/runs/` 各 run 的 `requirement.md`（v2 起全部需求有原文留档）、`eval/runs`、`eval/showcases` 的输入材料。**首选来源**：真实、已发生过、天然覆盖不同任务类型 | **直接采用**（行业 golden dataset 首选「真实生产输入」的共识，此处生产输入=dfoogding 需求原文） |
| S2 · 真实使用累积 | 后续真实使用中沉淀的新需求原文；按本分册 schema 入库 | **直接采用**，作为长期补充渠道 |
| S3 · 行业基准转化 | SWE-bench 类真实 issue 改写为 user_req；HumanEval 类函数级任务扩写为小型完整需求 | **有条件转化**：issue 描述需补齐 ddo 所需的「目标 + 边界 + 验收」三要素（SWE-bench issue 常缺验收口径）；函数级任务过小，仅用于「简单」难度层。转化模板见 §3.4 |

> 行业参照：golden/评测集构建共识为「从真实失败与真实输入出发、多来源混合、避免单一来源偏差」。参考：[DeepEval 数据集构建](https://deepeval.com/docs/datasets)、[Databricks LLM 评测实践](https://www.databricks.com/blog/best-practices-and-methods-evaluating-llm)、[qaskills 黄金数据集指南](https://qaskills.sh)。

## 2. 题目构建

### 2.1 用例 schema（user_req 格式，一个用例一文件）

```yaml
case_id: CS{版本}-E{序号}        # 例：CS1-E007
title: 一句话需求标题（即 --title）
requirement_text: |               # 需求原文，交付给被测工作流的唯一输入
  （自包含：目标、边界、验收期望；不含内部实现指引）
difficulty: simple | medium | complex
target_workflow: basic | standard  # 被测链路
acceptance:                        # 验收特征清单（替代唯一标准答案）
  - "[ ] cmd: node --test tools/tests/xxx.test.js"   # 可自动执行
  - "[ ] human: 文档含安装与卸载两节"                 # judge/人工判
caseset_version: 1.0.0
source: S1 | S2 | S3               # 来源与原始出处指针
notes: 构建时已知的风险或边界说明
```

### 2.2 构建规则

- **自包含**：requirement_text 不依赖会话上下文；读题者（陌生代理）无需追问即可开工。
- **可判定**：每个用例必有 acceptance 清单；cmd 项须可在沙箱离线执行（无 sudo、无网络），human 项须 rubric 可判。
- **不泄露实现**：不指定内部文件路径、库选择、算法（否则测的是题不是工作流）。
- **语言与规模**：需求语言与仓库一致（中文为主）；规模分 S/M/L 三档（预估改动文件数 1–2 / 3–8 / 9+）。

### 2.3 难度分层标准

| 层 | 判据（满足任一） | 主要服务维度 |
|---|---|---|
| 简单 simple | 单文件级改动；无新依赖；链路 ≤ basic 五阶段 | D1、D3 |
| 中等 medium | 3–8 文件；含一个新能力点；跨两个以上阶段 | D1、D2、D4 |
| 复杂 complex | 多模块联动或含schema/契约变更；歧义需门决议澄清 | D1、D2、D-HITL |

### 2.4 S3 行业基准转化模板

1. 取 SWE-bench Verified 风格 issue → 剥离仓库特定上下文；
2. 补写「目标 / 边界 / 验收」三要素（验收转成本分册 acceptance 格式）；
3. 规模归一化到 S/M/L 档；标注 `source: S3` 与原题指针，保证可回溯。

### 2.5 ground truth 策略（行业「标准答案」的转化）

行业 golden dataset 提供唯一标准答案；ddo 产出为**非唯一实现的代码+文档**，直接照搬不适配。**转化**：用「验收特征清单（acceptance）」替代标准答案——正确性由 cmd 验收命令（功能正确）+ rubric（质量）共同判定，与 SWE-bench「以测试判定 resolved」同构。此为本方案对行业不适配项的第一处关键转化。

### 2.6 数量适配推荐（DEC-10，标注：建议，供讨论）

行业基线约 300–500 例（如 LaunchDarkly 建议 ~500）：适用于低单例成本的 LLM 调用评测。ddo 全链单例成本高 1–2 个数量级（多阶段 × 多模型调用），照搬不可行。**推荐分层配额（起步）**：

| 层 | 数量 | 服务维度 |
|---|---|---|
| 简单 | 10 | D1、D3 |
| 中等 | 15 | D1、D2、D4 |
| 复杂 | 5 | D1、D2、D-HITL |
| 合计 | **30**（用户区间 30–50 下限） | — |

扩展规则：某维度置信区间过宽（通过率 95% CI 半宽 >10 个百分点）时优先加该层用例，而非整体扩量。统计上 30 例对「≥80% 通过率」的判定分辨率约 ±14 个百分点（Wilson 95% CI），足以发现粗粒度回退；更细分辨率留给回归场景的同题重复（后续稳定性轮）。

### 2.7 用例集版本化

- 用例集整体版本号（caseset_version，语义化）；任何用例内容变更即升版本。
- 评测报告绑定 `tag × caseset_version` 二元组（见 06 分册）；不可变历史靠 git 追溯。
- 用例集入库位置与隔离策略见 06 分册（建议随库版控，属资产非中间产物）。

## 3. 维度 × 用例需求对照

| 维度 | 需要的用例材料 | 由本分册哪节保障 |
|---|---|---|
| D1 | 全量 30 例 + 各例验收命令 | §2.1、§2.6 |
| D2 | 全量 30 例的 rubric 锚点（quality 评分参照） | §2.1 acceptance human 项 |
| D3 | 每被测任务 ≥3 组 mock 上游 fixture | §1-S1 高分 run 产物复用 |
| D4 | 每相邻对 ≥4 类缺陷注入样本 | 01 分册 D4 缺陷库 |
| D5 | 抽样框（当轮全量产物清单） | 03 分册采集 |
| D-Config | 3 类配置变体（非 user_req，属配置用例） | 01 分册 D-Config |
| D-HITL | 20 条门反馈集（10 同意变体 + 10 修改变体） | 01 分册 D-HITL |

## 4. 变更记录

| 日期 | 变更 | 依据 |
|---|---|---|
| 2026-10-08 | 初版：三来源、schema、分层、数量适配推荐、版本化 | Plan revision 2（FC-3、DEC-10） |
