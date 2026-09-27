# 用户需求

> 用户触发此流水线的原始需求描述。

## 原始需求

这个问题感觉比较大啊，接着一个微型run也不太好，我理解这个问题需要设计一下

（背景——缺口陈述，已经用户确认理解：交付链把 cleanup-worktree 作为最后阶段，`git worktree remove` 会连 run 自己的 `.state.json`（唯一收口 `run finish` 的输入）一起删除，收口发生在删除之后导致 run 无法正式关闭、index 悬空。wtt 手工流程是「先 finish → commit 产物 → 再删 worktree」，自动化预设把顺序倒了。本次两条实链 run 均靠人工绕行顺序收口（commit 产物 → 跨 worktree finish → 再删），该绕行不应长期依赖人工记忆。用户决议：不用微型 run 打补丁，正式开设计轮解决「收口时机与职责归属」。）

## 需求摘要

设计并修复交付链的收口顺序问题：cleanup-worktree 移除 worktree 与 run finish 唯一收口的结构关系（谁在什么时机代跑收口），消除人工绕行。
