---
name: verification
version: "1.0.0"
stage: verification
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  required: false
  rejectAction: regenerate-with-feedback
io:
  inputs:
    - ref: "run://docs/{type}/{dateDescription}/test-plan.md"
      required: false
    - ref: "run://docs/{type}/{dateDescription}/spec.md"
      required: true
    - ref: "run://docs/{type}/{dateDescription}/plan.md"
      required: false
  outputs:
    - ref: "run://docs/{type}/{dateDescription}/verification.log"
      kind: text
outputSchemaRef: "skill://atom-tasks/verification/verification.output.schema.json"
---

# verification

> 解析 test-plan.md 的两段式 checklist：`cmd:` 行为自动化测试（单元测试、接口测试、shell 验证），在 worktreePath 中执行并比对 exit code；`human:` 行为功能测试（UI 交互、页面操作），展示给用户手动执行并确认。结果落入 verification.log；任一失败回到 Coding 重做，直到末尾出现 `ALL PASSED`。lightweight 工作流没有 test-plan.md 时，依据 spec.md 和项目已有测试进行基础验收。

## 指令

如果 test-plan.md 存在，逐行解析它。参考 verification.output.schema.json 中的 sections 定义和 example 示例来组织输出格式。对于每行匹配 `^- \[ \] cmd: (.+)$` 的条目：在 `.state.json.worktreePath` 指向的工作树中执行捕获的命令，捕获 stdout/stderr 和 exit code，将结果行追加到 verification.log。对于每行匹配 `^- \[ \] human: (.+)$` 的条目：不执行；收集到「人工检查清单」块中，逐一展示给用户，并将用户的通过/失败回答记录到 verification.log。按父级 `## G<N>.` 标题分组；每组末尾输出组摘要 `GROUP G<N> PASSED` 或 `GROUP G<N> FAILED: <count> failing`。

如果 test-plan.md 不存在（例如 lightweight 工作流），读取 spec.md 与 plan.md，从仓库已有配置和文档中发现最小、确定性的现有测试或静态检查命令，并在工作树中执行；同时逐项核对 spec.md 的验收条件是否被实现。将这些检查作为 `LIGHTWEIGHT` 分组写入 verification.log。不得仅因 test-plan.md 缺失而跳过验证或宣告成功。

如果所有自动检查和已确认的人工检查都通过，追加最终行 `ALL PASSED`。如果存在任何失败，将失败分组及命令记录到 verification.log，将相关 Coding 任务重新置为 `pending`、Coding stage 置为 `pending`、Verification stage 置为 `failed`，清除尚未开始或已经生成的 Reporting/Reflection/Done 下游状态，并将 `currentStage` 设置为 `coding` 后重新修复；不得写 `ALL PASSED`。最多自动修复 3 轮，达到上限后将 run 标记为 `failed` 并停止。若仅存在尚未确认的人工检查，将 Verification 标记为 `waiting-human` 并暂停，不得进入后续阶段。

## 约束

- 不得执行 `human:` 行；仅展示。
- 在 `.state.json.worktreePath` 工作目录中执行 `cmd:` 行；不得在 `config.base.targetDir`、主工作树或其他外部路径执行修改性命令。
- 执行前去除 `cmd:` 内容中的反引号和尾部标点；保留带引号的 shell 字符串原样。
- 如果命令退出非零或超时（默认每个条目 >120s），记录 [FAIL]。
- 如果有任何条目 FAIL，不得写入最终的 `ALL PASSED` 标记。
- 如果仍有未确认的 `human:` 条目，不得写入最终的 `ALL PASSED` 标记。
- 每个条目捕获的 stderr 截断到 <= 200 字符以保持文件可读；完整输出可保留在 side file verification.full.log 中。
