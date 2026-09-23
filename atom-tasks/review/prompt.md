# review

> 代码/文档复审：以 sub-agent 方式逐条核对内置复审清单，产出 review-report。

## 指令

1. 逐条遍历本目录 `check-list.md` 的复审清单；
2. 对每个条目，对照生效工作目录中的代码改动与 Context 中的文档产物进行评估（工作目录按 .state.json 判定：`git.worktreePath` 非空则为该 worktree，否则为当前项目目录）；
3. 将结论写入 run 目录 `review-report.md`：每个清单条目一个 section（`## <条目>`），后跟结论（通过 / 不通过 / 不适用）与备注。

多模型评审（run 配置 models 非空时）：为每个模型委派一个 sub-agent 评审，合并报告——各模型结论独立分段并标注模型名；全部模型共同提到的问题标「高置信度」；仅单一模型提到的标「待确认」。配置为空时单模型评审。
