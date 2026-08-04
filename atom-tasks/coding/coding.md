---
name: coding
version: "1.0.0"
stage: coding
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: true
confirmation:
  required: false
  rejectAction: regenerate-with-feedback
io:
  inputs:
    - ref: "run://docs/{type}/{dateDescription}/tasks/task-group.json"
      required: false
    - ref: "run://docs/{type}/{dateDescription}/tasks/"
      required: false
    - ref: "run://docs/{type}/{dateDescription}/spec.md"
      required: true
    - ref: "run://docs/{type}/{dateDescription}/plan.md"
      required: true
    - ref: "run://docs/{type}/{dateDescription}/test-plan.md"
      required: false
    - ref: "run://docs/{type}/{dateDescription}/verification.log"
      required: false
  outputs:
    - ref: "run://"
      kind: dir
options:
  - name: maxSelfCheckRounds
    type: integer
    default: 3
    description: "自检最大轮次"
  - name: model
    type: string
    default: "inherit"
    description: "模型值（档位别名或完整模型名，inherit=主会话内联执行）"
---

# coding

> 按 tasks/task-group.json 的拓扑顺序执行每个 task-NN.md；同层任务可批次化产出（在指令型 runtime 下相当于一次响应输出多文件）。

## 指令

如果 tasks/task-group.json 存在，解析它并按任务执行：如果存在 parallelGroups，将其作为批次调度（每个内部数组是一个批次，按顺序执行）；否则通过 dependsOn 对 tasks[] 进行拓扑排序，将同层任务归为一个批次。按顺序处理每个批次：读取批次中的每个 task-NN.md，在 `.state.json.worktreePath` 指向的工作树中执行所述编辑，并在 .state.json 的对应 task 条目中写入一行完成标记。不得跳过任务。不得编造任务。在批次开始前，如果批次中每个任务都已标记完成，则将其视为无操作跳过。

如果 tasks/task-group.json 不存在（例如 lightweight 工作流），直接读取 spec.md 与 plan.md，将 plan.md 中的实施步骤按依赖顺序作为任务执行，并在 .state.json 中记录每一步结果。test-plan.md 在该模式下也是可选输入，不得仅因这两个可选产物缺失而中止 Coding。

如果 verification.log 存在且上一轮验证失败，只处理日志中失败检查项关联的任务或实施步骤：将这些条目从 done 重新打开为 pending，记录本轮修复原因和轮次，完成修复后再进入 Verification。不得因为任务曾经标记 done 就跳过失败修复。

### Loop 自检机制（options.maxSelfCheckRounds）

当 `options.maxSelfCheckRounds > 0` 时，执行自检循环：

```
round = 0
WHILE round < maxSelfCheckRounds:
  执行编码任务
  运行项目测试/静态检查（如有）
  IF 全部通过 → break，进入 Verification
  round++
  自行修复失败项
  记录轮次到 .state.json.stages.coding.selfCheckRound = round

IF round >= maxSelfCheckRounds AND 仍有失败：
  如果当前是 issue-driven 工作流：
    gh issue edit <issueNumber> --add-label "ddo:failed"
    gh issue comment <issueNumber> --body "自检超限（第 {round} 轮），转人工：{失败原因}"
  暂停，等待人工介入
```

自检轮次记录到 `.state.json.stages.coding.selfCheckRound`，供审计。

### 模型路由（options.model）

当 `options.model != "inherit"` 时，通过 subagent 委派执行：

1. 模型值解析优先级：workflow 级 atomTaskOverrides > config 全局 atomTaskOverrides > atom-task 默认值 > 继承
2. 档位别名（opus/sonnet/haiku/fable）：直接作为 subagent 模型参数
3. 完整模型名：写入 subagent 定义文件 model 字段，再按名委派
4. subagent 执行完成后，记录实际使用的模型到 `.state.json.stages.coding.actualModel`
5. 确认门仍由父会话主持，subagent 不与用户交互

```
IF model != "inherit":
  解析模型值（档位别名 or 完整名）
  委派 subagent 执行编码任务，传入 model 参数
  subagent 产物落盘
  父会话验证产物存在
  记录 actualModel 到 .state.json
ELSE:
  在主会话内联执行（行为与现状一致）
```

模型路由失败时回退为继承模式，记录警告，不中断流水线。

## 约束

- 从 tasks/ 读取 task-group.json——不要从 run 目录顶层读取。
- 仅操作 `.state.json.worktreePath` 内的文件；`config.base.targetDir` 是工作树的父目录，不是代码修改目录。不得修改主工作树、工作树父目录或 skill 本身。
- 保留无关文件；做最小化、有针对性的编辑。
- 当任务失败时，在 .state.json 中记录失败，并仅在通知用户后继续后续批次中的独立任务。
