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
      required: true
  outputs:
    - ref: "run://docs/{type}/{dateDescription}/verification.log"
      kind: text
outputSchemaRef: "skill://atom-tasks/verification/verification.output.schema.json"
---

# verification

> 解析 test-plan.md 的两段式 checklist：`cmd:` 行为自动化测试（单元测试、接口测试、shell 验证），在 targetDir 中执行并比对 exit code；`human:` 行为功能测试（UI 交互、页面操作），展示给用户手动执行并确认。结果落入 verification.log；任一失败回到 Coding 重做，直到末尾出现 `ALL PASSED`。

## 指令

逐行解析 test-plan.md。参考 verification.output.schema.json 中的 sections 定义和 example 示例来组织输出格式。对于每行匹配 `^- \[ \] cmd: (.+)$` 的条目：在 targetDir 中执行捕获的命令，捕获 stdout/stderr 和 exit code，将结果行追加到 verification.log。对于每行匹配 `^- \[ \] human: (.+)$` 的条目：不执行；收集到「人工检查清单」块中，逐一展示给用户，并将用户的通过/失败回答记录到 verification.log。按父级 `## G<N>.` 标题分组；每组末尾输出组摘要 `GROUP G<N> PASSED` 或 `GROUP G<N> FAILED: <count> failing`。如果每组都通过，追加最终行 `ALL PASSED`。如果有任何条目失败，跳转回 Coding 阶段（状态机转换），不写 `ALL PASSED`。

## 约束

- 不得执行 `human:` 行；仅展示。
- 在 targetDir 工作目录中执行 `cmd:` 行；不得 sudo，不得修改外部路径。
- 执行前去除 `cmd:` 内容中的反引号和尾部标点；保留带引号的 shell 字符串原样。
- 如果命令退出非零或超时（默认每个条目 >120s），记录 [FAIL]。
- 如果有任何条目 FAIL，不得写入最终的 `ALL PASSED` 标记。
- 每个条目捕获的 stderr 截断到 <= 200 字符以保持文件可读；完整输出可保留在 side file verification.full.log 中。
