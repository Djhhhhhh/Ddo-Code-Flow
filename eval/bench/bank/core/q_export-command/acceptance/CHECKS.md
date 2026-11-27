# CHECKS — q_export-command 验收清单

计分项（7 项，达标率分母 = acceptance 用例）：
- ① 导出命令入口存在（`bin/` 内含 export/--format 的可执行入口）；
- ② JSON 导出：≥2 条且可解析（`export --format json`）；
- ③ 导出字段与 `.ddo/runs/` 记录结构一致（样例 record.json 键集全量出现于导出首行）；
- ④ CSV 导出：表头 + 数据行（表头含 runId，总行数 ≥3）；
- ⑤ `--format` 非法值明确报错（exit 非 0 且 stderr 有信息，沿用项目 exit 约定 1/2）；
- ⑥ `--output` 指定路径写入文件（文件存在且非空，内容与 stdout 同构）；
- ⑦ 调研证据：spec/计划类产物引用被调研文件（`bin/runs.js` 与 `lib/records.js` 出现于产物文本）。

并列量化段（不混入验收分母）：
- 回归测试：fixture `tests/**/*.test.js` 全量重跑 ✔/✖ 计数（pass/total/broken）。
- researchEvidence：候选产物相对路径清单与引用判定。

参考档（不计分母）：
- 无（本题为 code 形态，无页面参考档）。

> 口径来源：本清单与 verify.js 用例逐条对应，同提交同步更新；rubric.md 只引用不复述。
