# task-04: compose-config 深合并

- 关联验收点：G6（AC-6）
- 依赖：task-01
- 状态：pending

## 目标

实现 `config.default.json <- .ddo/config.json <- run 参数` 的三段深合并，仅输出到 stdout，不落盘。

## 涉及文件

- `scripts/runtime/lib/config.js`（新增）

## 实现要点

- 合并规则：对象递归合并、数组整体替换、标量替换。
- 读 `config.default.json` + `<projectRoot>/.ddo/config.json`（不存在则跳过）+ `--args-json`。
- 输出合并后 JSON 到 stdout；**不得写任何 per-run effective config 文件**。

## 验收

- [ ] cmd: node scripts/runtime/ddo.js compose-config --skill-root <skillRoot> --project-root <projectRoot> --args-json '{"feature":true}' 输出合并 JSON 且无 effective config 文件生成
- [ ] cmd: node --test scripts/runtime/test/compose-config.test.js（去 skip 后全绿）
