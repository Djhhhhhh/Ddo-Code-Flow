# STATUS — 已过期（被新版本取代）

| 项 | 值 |
|---|---|
| **状态** | **已过期**——本目录保留为历史归档，不再作为现行评测依据 |
| **取代者** | [../../verify/v2.1.md](../../verify/v2.1.md)（v2.1 纪元 playbook） |
| **判定依据** | v2-beta playbook §0 失效判据命中：skill 行为已超出其锚定范围——新增 `gate present` / `gate interact` / `guide` 命令、state 新增 `ephemeral` 字段与 `dirs` 扩展、finish 归档形态由 `history/<runId>/.state.json` 目录副本改为 `history/<runId>.zip` 整目录归档 |
| **标注日期** | 2026-09-27（随 eval/verify/v2.1.md 定稿） |

## 说明

- 本目录全部内容（timeline / ASSESSMENT / reverify / artifacts / state-archive）保持归档原样，未做任何修改；本文件是目录内唯一新增。
- 评估结论「建议转正式」在其时点仍然成立；过期的是**评测方法与断言基线**（82 用例、state 目录副本归档形态等），不是历史结论本身。
- 现行评测入口：[eval/README.md](../../README.md) 的「当前版本」指针与 [verify/v2.1.md](../../verify/v2.1.md)。
