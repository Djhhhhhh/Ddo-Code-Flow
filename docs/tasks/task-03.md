# task-03 — 重写 SKILL.md 为指令型执行循环

## 目标
把现有占位 `SKILL.md` 改写为符合 plan §11 的**指令型 runtime 执行骨架**：描述如何读 config.json + 按 DAG 执行 atom-task + 维护 .state.json + 触发确认门，不写任何业务。

## 范围
- 覆盖写 `skills/ddo-swe/SKILL.md`

## 依赖
- 可与 task-01 / task-02 并行起步，但**入库前需要 task-02 的最终 config.json 与 task-01 的 schema 名字稳定**。

## 关联验收点（test-plan.md）
- G1：SKILL.md 存在。
- G4 / G5 / G6 / G9：执行循环描述要能引导 agent 实现批次化 DAG、确认门停下、合并审批、Verification 失败回退、跨会话恢复。
- G10：SKILL.md 不内嵌任何具体业务（只描述"如何读 config 并执行"）。

## 步骤
1. 保留 frontmatter（name / description / metadata）：
   - `description` 改为：用于驱动多阶段 spec→plan→test→code→verify 工作流的可定制流水线 skill。
2. Body 写入 plan §11 给出的执行循环（6 步），其中第 3 步 a/b/c 子项要明确写出"DAG 拓扑批次化 + parallelApprove 合并确认 + stage-level 确认门"三件事。
3. 增加一节"Outputs to maintain"，明确每个 stage 收尾必须更新 `.state.json` 的 `stages[<name>]` 字段与可能的 `history` 条目。
4. 增加一节"Failure modes"，列举三种回退：
   - 确认门否决 → 重跑当前 atom-task，反馈拼到 prompt 末尾；
   - Verification 失败 → 回到 Coding；
   - 会话中断 → 下次启动先读 `.state.json` 续跑。
5. 增加一节"What this skill does NOT do"：不内嵌业务、不修改 atom-task JSON、不写其它 skill。
6. 字数总量控制在约 200 行以内；尽量是机械化步骤列表而非散文。

## 产物
- `skills/ddo-swe/SKILL.md`（覆盖原文件）
