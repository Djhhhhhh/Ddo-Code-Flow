# CHECKS — q_regression-trap 验收清单

计分项（4 项，达标率分母 = acceptance 用例）：
- 验收用例组（4 项）：① `--uppercase` 生效（`bin/convert.js --uppercase 'hello  world'` → `HELLO WORLD`）；② `--uppercase` 与规范化空白组合（`'  a   b  '` → `A B`）；③ 缺省行为保持（不加选项，规范化空白不变大小写）；④ `--lower` 原有选项不受影响。
- 回归测试（并列量化段）：fixture `tests/**/*.test.js` 全量重跑，`✔/✖` 计数为 pass/total，broken = 失败数（不混入验收分母）。
- 改动范围（并列量化段）：`git diff --name-only HEAD` + untracked 对 `qpack.json changeWhitelist`（`lib/`、`bin/convert.js`、`tests/`、`README.md`），越界文件数与清单如实记录。

参考档（不计分母）：
- regression.rawExit：回归命令原始 exit code（执行成功性与验收通过与否分离）。
- changeScope.whitelist：判定所用白名单快照（审计追溯）。

> 口径来源：本清单与 verify.js 用例逐条对应，同提交同步更新；rubric.md 只引用不复述。
