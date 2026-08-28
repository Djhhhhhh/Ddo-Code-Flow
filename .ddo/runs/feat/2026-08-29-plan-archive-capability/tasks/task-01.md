# task-01: 创建归档模版 atom-tasks/plan/references/ddo.md

- 关联验收点：G1（TP-01~03）、G2（TP-04~06）
- 依赖：无
- 状态：pending

## 目标

在 `atom-tasks/plan/references/` 新增归档模版 `ddo.md`，内容逐字采用本 run 登记的 issue #36 正文（`issue-context.md` 中「## Issue 正文（归档模版原文）」之后的全部内容），不增删任何字符。

## 涉及文件

- `atom-tasks/plan/references/ddo.md`（新增，本分支唯一交付文件）

## 实现要点

- 唯一事实源：`<worktreePath>/.ddo/runs/feat/2026-08-29-plan-archive-capability/issue-context.md`（worktreePath 见 .state.json）的 issue 正文段（已由 issue-fetch 于 requirement 阶段登记）；不得凭记忆重写、不得改写措辞。
- 提取方式：取「## Issue 正文（归档模版原文）」标题之后至文件末尾的全部内容（含其后的空行结构），以 UTF-8、LF 写入模版文件。
- 模版文件不加 frontmatter、不加额外标题或前言——它本身以 `# 技术方案设计模板` 开头。
- 该文件不是 atom-task（无需通过 atom-task-md.schema.json 校验），仅为 plan.md §6 归档机制按 `*.md` 枚举与 basename 精确匹配的内容模版。

## 验收

- [ ] cmd: test -f atom-tasks/plan/references/ddo.md
- [ ] cmd: awk '/^## Issue 正文/{f=1;next} f' .ddo/runs/feat/2026-08-29-plan-archive-capability/issue-context.md | diff - atom-tasks/plan/references/ddo.md（无输出）
- [ ] cmd: 章节骨架与归档属性关键句全部存在（TP-05、TP-06 命令）
