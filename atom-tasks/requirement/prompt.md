# requirement

> 验证用户需求已明确，将需求原文固化为 requirement 产物。

## 指令

1. 若 Context 中存在 Issue Context，从其提取 issue 标题、正文和约束作为需求原文；
2. 否则检查用户最近一次触发本次 run 的提示词是否包含清晰、可执行的需求；
3. 提示词为空、过于模糊、或仅含激活短语（如「use ddo-code-flow」）时：**暂停流水线**，要求用户提供具体需求后再继续——不猜测、不继续执行；
4. 需求明确后，将用户需求**原文照录**写入 run 目录的 `requirement.md`。
