# eval/design — 有效性评测方案（设计稿·待评审）

> 状态：方案稿（待评审）。对应 Plan：`.ddo/runs/feat/20261008-211433-13ff/plan.md`（revision 2）。生成日期：2026-10-08。
> 本目录是 ddo-code-flow **有效性验证评测体系**的设计文档集；不是已定规范，也不是可执行评测系统。评审定稿前不驱动任何实现。

## 范围声明

- 本轮只设计**有效性**命题（维度 D1、D2、D3、D4、D5、D-Config、D-HITL）。
- **优越性**（D6–D9）与**稳定性**（D10、D11、D-Recovery）为用户明确 deferred，本轮不展开（见 [01 分册 §5](01-effectiveness-dimensions.md)）。
- 设计完整覆盖六个组件：评测题来源、评测题目构建、自动化评测流程、指标获取、指标分析、标准化评测报告。
- 产物策略（用户约束）：评测运行中间产物**不入主分支**；每次评测仅在项目内保留**一份标准化评测报告**（发布介绍用途）；所有指标直观可量化。

## 分册索引与阅读顺序

| # | 分册 | 职责 | 主要读者场景 |
|---|---|---|---|
| 01 | [01-effectiveness-dimensions.md](01-effectiveness-dimensions.md) | 有效性 7 维度完整方案：维度定义、用户示例名→实际结构映射表、维度依赖图、行业适配标注、deferred 清单 | 理解「测什么」 |
| 02 | [02-case-source-and-construction.md](02-case-source-and-construction.md) | 评测题来源（dogfooding 历史 / 真实使用 / 行业基准转化）与题目构建（schema、难度分层、ground truth 策略、数量适配、版本化） | 理解「拿什么测」 |
| 03 | [03-automation-pipeline.md](03-automation-pipeline.md) | 自动化评测流程：沙箱隔离、无头执行、HITL 门自动化决议、D1 重试策略、数据捕获点、行业 harness 借鉴与适配 | 理解「怎么跑」 |
| 04 | [04-metrics-collection-and-judge.md](04-metrics-collection-and-judge.md) | 指标获取（确定性采集点 + token/成本来源）与 judge 设计（选型对比带推荐、prompt 框架、校准四件套、评分标准建议） | 理解「数据从哪来」 |
| 05 | [05-analysis-and-report.md](05-analysis-and-report.md) | 指标分析（阈值判定、聚合与量化呈现规则）与标准化评测报告模板（每轮一份） | 理解「结果怎么看、怎么发布」 |
| 06 | [06-artifact-isolation-and-versioning.md](06-artifact-isolation-and-versioning.md) | 中间产物与主分支隔离机制对比与推荐、发布 tag 先行的版本评测流程与 tag–版本对应规则 | 理解「产物放哪、版本怎么管」 |

## 与 eval/ 既有约定的关系

延续 `eval/README.md` 的沙箱（runs/）、纪元（verify/ playbook 版本锚定）与 showcase 概念；本方案在其上收紧产物保留策略（中间产物不入库、仅留一份报告），收敛方案见 06 分册。既有 `eval/runs`、`eval/verify`、`eval/showcases` 内容本方案零改动。

## 维护约定

- 各分册头部保留状态行；修订时同步更新本索引与对应分册的「变更记录」节。
- 评审定稿前，本目录内容不作为实现依据；实现轮次（评测 runner、用例集本体）须另行立项。
- 行业引用以分册内「参考」节为准；引用失效时在对应分册记录复核日期。
