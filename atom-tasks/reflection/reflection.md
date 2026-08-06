---
name: reflection
version: "4.0.0"
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  rejectAction: regenerate-with-feedback
consumes:
  - role: execution-report
    required: true
produces:
  - role: reflection-report
    kind: markdown
    primary: true
outputSchemaRef: "skill://atom-tasks/reflection/reflection-report.output.schema.json"
---

# reflection

> 检查项目是否存在未完结的后续流程（TODO / 遗留风险 / 经验记录），生成 reflection-report。
> 该原子任务是确认门：用户同意后才能进入 Done。

## 指令

遍历 `.state.json.worktreePath` 中本次 run 添加或修改的 TODO、FIXME、XXX 标记。结合 `{{inputs.execution-report}}`、本次 run 的决策日志和验证历史，参考 reflection-report.output.schema.json 中的 sections 定义和 example 示例来组织输出格式，生成 reflection-report：未完结项、推荐后续动作、经验教训。末尾追加标准的「用户确认」section。

## 约束

- 仅扫描 `.state.json.worktreePath`；不得扫描主工作树、worktreeDir 中的其他项目或 skill 目录。
- 列出 TODO 条目时，引用文件路径和（如果可用）行号。
- 后续动作应表述为可执行的任务，而非自由文本。
