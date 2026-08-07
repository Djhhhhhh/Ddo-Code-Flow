# Plan

# Ddo\-Code\-Flow 技术 Plan



> 以仓库事实、技术决策和实现契约指导 Test\-Planning、Tasking、Coding、Verification 与 Review。
> 
> 



---



## 执行摘要



本 Plan 实现已批准的 spec《原子化解耦与职责收敛》（同目录 spec\.md，revision 8）：将 Ddo\-Code\-Flow 契约层重构为 v4 四层解耦架构，并完成面向全局 skill 库部署的「三地解耦」。核心机制：



- **产物角色模型**——atom\-task 只声明 produces/consumes 角色，上游完成即向黑板登记，runtime 匹配注入，下游不再点名上游；pipeline 成为唯一集成方式。

- **三地解耦**——skill 位置（全局库，运行期只读）、项目位置（项目内 \.ddo/：config\.json \+ runs/ 只存产物）、worktree（默认与项目同级，worktreeDir 可配置）三者职责清晰，以配置内存合成与按名续跑解析连接；git 可见性完全交还用户。

- **职责固化**——四层职责矩阵写入 \.claude 编码规则，可机械校验项落成契约测试。

范围与非目标见下节；详细设计按语义拆分为四册（plans/），本文档为稳定入口与唯一确认入口。文档模式 split，revision 7。



---



## 范围与非目标



|事项|说明|AI 索引|
|---|---|---|
|v4 任务契约与 schema|frontmatter 移除 stage/io，引入 produces/consumes 角色声明|FR\-ATOM\-1|
|产物目录与黑板机制|artifacts\.json 目录 \+ \.state\.json\.artifacts 清单 \+ runtime 注入|FR\-ATOM\-2|
|pipeline 唯一集成|删节点级 io 覆盖；保留 taskRef/options；确认门归 pipeline|FR\-PIPE\-1|
|职责划分收敛|SKILL\.md 业务段落移回 atom\-task；任务内机制复述删除|FR\-RESP\-1|
|\.claude 编码规则|职责矩阵、禁止事项、自查清单、三地解耦约束|FR\-RULE\-1、FR\-RULE\-2|
|全量迁移与断链修复|16 任务 / 4 workflow / tests 迁移；修 issue\-driven 断链|FR\-MIG\-1、FR\-MIG\-2|
|部署模型：三地解耦|skillRoot 运行期只读；项目承载 \.ddo/ 工作区（config \+ 默认 run）；run 自包含|FR\-DEPLOY\-1|
|配置合成（单一配置）|全局默认 ← 项目 \.ddo/config\.json ← run 参数；仅内存合成，不物化落盘|FR\-DEPLOY\-2|
|worktree 位置可配置|单一 worktreeDir 目标目录字段，默认与项目同级；\.ddo/runs/ 只存产物|FR\-DEPLOY\-3|
|调用参数（最小集）|\-\-model 选流水线；\-\-feature/\-\-bugfix 标识 feat/fix run 类型；其余不引入|FR\-DEPLOY\-7|
|git 可见性交还用户|\.ddo/ 随项目入库，范围由用户 \.gitignore 决定；skill 不管理 git|FR\-DEPLOY\-4|
|状态可移植与续跑|最小锚点 \+ skillName/version；按名再解析，版本告警|FR\-DEPLOY\-5|
|自动引导|首次 run 创建项目 \.ddo/（含 config\.json）|FR\-DEPLOY\-6|
|文档对齐与清理|README v4 与部署模型、docs/metrics\.md、版本说明、删冗余文件|FR\-DOC\-1|
|非目标：UI v4 功能|studio\.js 仅止血与改写目标修正，不支持项目级配置编辑|FR\-DOC\-1|
|非目标：metrics/eval/业务重写|scripts/metrics 机制不动；show\_case\.md 仅标注存档|FR\-DOC\-1|



---



## Parts Manifest



|\#|文档|职责|字符数|状态|AI 索引|
|---|---|---|---|---|---|
|01|plans/01\-architecture\-and\-selection\.md|现有设计与复用基线、整体架构与流程、技术选型与方案对比|3593|current|FR\-RESP\-1、FR\-DEPLOY\-1|
|02|plans/02\-data\-model\-and\-deployment\.md|数据模型设计（实体/schema/不变量/迁移回滚）、三地解耦部署模型、调用入口与参数|5841|current|FR\-ATOM\-1、FR\-DEPLOY\-2\~7|
|03|plans/03\-interface\-algorithm\-changes\.md|API 接口契约、算法设计、文件变更计划|4803|current|FR\-ATOM\-2、FR\-MIG\-1|
|04|plans/04\-assurance\-and\-handover\.md|兼容稳定性与回滚、Verification Anchor、开放问题、风险与交接、后续演进|4017|current|FR\-RULE\-2、FR\-DEPLOY\-3\~6|



---



## 用户确认



- **同意**：批准当前 Plan，进入 Test\-Planning / Tasking。

- **修改：\<反馈\>**：按反馈修改本 Plan 并重新确认。

- **提问：\<问题\>**：仅答疑，不修改文档或确认状态。

- **归档**：列出可用归档模板。

- **归档：\<模板名\>**：按模板派生简化归档文档。

