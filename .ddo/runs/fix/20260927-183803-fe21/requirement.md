# 用户需求

> 用户触发此流水线的原始需求描述。

## 原始需求

现在我会发现个问题，现在针对需要给用户输出options的操作还是不会被ai读到，不会给用户明确并且统一的一个交互模式，例如：在提问之后，就不会自动触发重新询问操作的方式

（随后经宿主提问工具确认的方向决议，用户原话选择：）

- 设计方向：**B：结构闭环**——「统一交互 payload + 呈现/交互留痕 + next --decision 校验『交互后必须重新呈现』——漏问/漏 re-ask 被结构性拦截」
- 推进方式：**开 fix run 走流水线**——「用 ddo-code-flow 自己的流程跑一轮 fix（requirement → spec → plan → coding），dogfooding」
- 变更方式：参考 `../Ddo-Code-Flow-feat-worktree-creation-timing/` 的分支结构，用 git worktree 做变更（分支 `fix/interaction-loop`，run 产物留在 worktree 内）

## 需求摘要

把「向用户呈现选项」的交互协议从 prompt 散文约束升级为结构保证：统一交互 payload 单一来源、呈现与 in-phase 交互留痕、next --decision 前置校验（最后交互后须重新呈现才可决议）。
