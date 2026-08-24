# task-08: register-artifact + validate-output

- 关联验收点：G2（AC-2）+ G3（AC-3）
- 依赖：task-02, task-03, task-06
- 状态：pending

## 目标

实现 P0.5 两个 post-node 动作：登记（落盘 + 黑板 + history）与硬校验（拦截非法产出）。

## 涉及文件

- `scripts/runtime/lib/artifacts.js`（新增）

## 实现要点

- `register-artifact`：stdin 接产出文本，落盘到 artifactDir（按 artifacts.json 的 file），写 `.state.json.artifacts[role]`，追加 `node-done` history（writer=runtime）。
- `validate-output`（按 DEC-5）：
  - `json+markdown` 产物 → 按 `outputSchemaRef` 的 `jsonFields` 校验必需字段/类型。
  - `markdown` 产物 → 校验 `required:true` 的 section 标题存在。
  - `.state.json` → 用 task-02 校验 `state.schema.json`。
  - 不通过 → exit 1 + stderr 说明。

## 验收

- [ ] cmd: echo "<文本>" | node scripts/runtime/ddo.js register-artifact --role <role> --state <state.json> 落盘并返回 {path}
- [ ] cmd: node --test scripts/runtime/test/register-artifact.test.js（去 skip 后全绿）
- [ ] cmd: node --test scripts/runtime/test/validate-output.test.js（去 skip 后全绿）
