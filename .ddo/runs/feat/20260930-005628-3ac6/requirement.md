# 用户需求

> 用户触发此流水线的原始需求描述。

## 原始需求

1. .claude/settings.local.json 从仓库中排除掉
2. 现在执行完coding后会静默执行到工作流结束，无提示用户coding结束确认阶段，这个需要补充一下，参数提供：同意、提问、修改 即可。
3. https://github.com/Djhhhhhh/Ddo-Code-Flow/issues/64 worktree的命令提示不稳定，这个问题需要回归一下skill.md的提示等部分全都检查一下，要保证每次启动时候询问的内容是一致的
4. 仓库内存在已经在执行中的工作流，需要给个快速resume的方式，这个需要设计一下，看看是否需要再设计一下启动的标准。
本质：3，4 都是启动的标准问题，我希望在本次把启动的相关的状态机设计好，要保证稳定性

（关联 issue：Djhhhhhh/Ddo-Code-Flow#64【Bug】skill启动worktree命令不稳定&coding结束无确认阶段——正文：skill启动worktree命令不稳定&coding结束无确认阶段，直接执行到最后结束了）

## 需求摘要

统一并稳定 ddo 流水线的启动状态机（启动引导一致性与 running-run 快速 resume），补齐 coding 阶段结束确认门（同意/提问/修改），并将 .claude/settings.local.json 等本地运行时文件从仓库追踪中排除。
