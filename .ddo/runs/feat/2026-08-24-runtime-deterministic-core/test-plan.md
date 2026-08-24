# Ddo-Code-Flow 测试计划

> 基于已确认的 spec.md 生成的验收测试 checklist。每条验收项标记为 cmd（自动化）或 human（手动）。TDD 模式开启，确认后为每个 cmd 项生成 Red 状态测试桩。

---

## G1. 零依赖运行与退出码契约（AC-1）

### Checklist

- [ ] cmd: node scripts/runtime/ddo.js（无子命令）返回 exit 2 用法错误
- [ ] cmd: node scripts/runtime/ddo.js compose-config（缺必需参数）返回 exit 2 用法错误
- [ ] cmd: node scripts/runtime/ddo.js compose-config --help 返回 exit 0
- [ ] cmd: node --test scripts/runtime/test/cli.test.js

### 通过标准

所有子命令仅依赖 Node 即可运行，无第三方依赖；cli.test.js 覆盖 0/1/2/77 退出码归一且全绿。

---

## G2. validate-output 硬校验（AC-2）

### Checklist

- [ ] cmd: node --test scripts/runtime/test/validate-output.test.js
- [ ] cmd: node scripts/runtime/ddo.js validate-output --artifact <非法 json+markdown 产物> --output-schema-ref skill://atom-tasks/spec/spec.output.schema.json 返回 exit 1 且 stderr 说明拦截原因
- [ ] cmd: node scripts/runtime/ddo.js validate-output --artifact <合法 spec 产物> --output-schema-ref skill://atom-tasks/spec/spec.output.schema.json 返回 exit 0

### 通过标准

对违反其 outputSchemaRef 的节点产出以 exit 1 + stderr 硬拦；对合法产出 exit 0。

---

## G3. register-artifact 登记（AC-3）

### Checklist

- [ ] cmd: node --test scripts/runtime/test/register-artifact.test.js
- [ ] cmd: echo "<产出文本>" | node scripts/runtime/ddo.js register-artifact --role plan --state <state.json> 落盘到 artifactDir 且 stdout 返回 `{path}`
- [ ] cmd: node --test scripts/runtime/test/register-artifact.test.js（校验 .state.json.artifacts 与 history 追加）

### 通过标准

stdin 文本落盘到 artifactDir、写入 .state.json.artifacts、追加 history，全程无需模型手写黑板。

---

## G4. applyMutation 写守卫（AC-4）

### Checklist

- [ ] cmd: node --test scripts/runtime/test/apply-mutation.test.js
- [ ] cmd: node scripts/runtime/ddo.js advance-stage（越权写 git-worktree 字段的场景）返回 exit 1 且 stderr 报越权
- [ ] cmd: node --test scripts/runtime/test/apply-mutation.test.js（自造顶层字段被 additionalProperties:false 拦截）

### 通过标准

对越权写（写他人 x-ddo-writer 字段）与自造顶层字段均 exit 1 并报错。

---

## G5. validate-dag 角色可达性（AC-5）

### Checklist

- [ ] cmd: node --test scripts/runtime/test/validate-dag.test.js
- [ ] cmd: node scripts/runtime/ddo.js validate-dag --workflow workflows/guarded.json 返回 exit 0
- [ ] cmd: node scripts/runtime/ddo.js validate-dag --workflow <含缺失 required consume 的 workflow> 返回 exit 1

### 通过标准

required consume 无上游产出时 exit 1；对 guarded.json exit 0。

---

## G6. compose-config 不落盘（AC-6）

### Checklist

- [ ] cmd: node --test scripts/runtime/test/compose-config.test.js
- [ ] cmd: node scripts/runtime/ddo.js compose-config --skill-root <skillRoot> --project-root <projectRoot> --args-json '{"feature":true}' 输出合并后 JSON 且不生成任何 per-run effective config 文件

### 通过标准

输出深合并后的有效配置 JSON，磁盘上不产生任何 per-run effective config 文件。

---

## G7. next-node 注入与合并（AC-7）

### Checklist

- [ ] cmd: node --test scripts/runtime/test/next-node.test.js
- [ ] cmd: node scripts/runtime/ddo.js next-node --state <state.json> 输出的自包含指令中 `{{inputs.*}}` 已替换为上游产物路径、options 已按优先级合并

### 通过标准

自包含指令中角色注入完成、options 合并正确，模型无需再自行拼装上下文。

---

## G8. advance-stage 终态推进（AC-8）

### Checklist

- [ ] cmd: node --test scripts/runtime/test/advance-stage.test.js
- [ ] cmd: node scripts/runtime/ddo.js advance-stage --state <未满足终态的 state.json> 返回 exit 1 且不推进 currentStage

### 通过标准

仅在终态检查（阶段全 done/合法跳过、门全批准、无 running/failed/pending）全满足时才推进 currentStage。

---

## G9. 角色/字段归属测试与 SKILL.md 委托（AC-9）

### Checklist

- [ ] cmd: node --test scripts/runtime/test/protocol.test.js（skill:// project:// run:// 解析，含 DEC-4 run://→worktreePath）
- [ ] cmd: node --test scripts/runtime/test/jsonschema.test.js（最小子集校验器覆盖全部现有 schema）
- [ ] cmd: node --test scripts/runtime/test/apply-mutation.test.js（state field ownership 表覆盖每个 x-ddo-writer）
- [ ] human: 检查 SKILL.md 的 Step 1–7 已改为委托 `node ddo.js <子命令>`，无遗留大段散文状态机；四层职责模型未被破坏

### 通过标准

角色可达性与状态字段归属均有对应测试；SKILL.md Step 1–7 完成委托子命令改写，模型只做生成。

---

## TDD 测试文件

| 测试文件 | 关联检查项 | 状态 |
|---|---|---|
| scripts/runtime/test/cli.test.js | G1 | Red |
| scripts/runtime/test/validate-output.test.js | G2 | Red |
| scripts/runtime/test/register-artifact.test.js | G3 | Red |
| scripts/runtime/test/apply-mutation.test.js | G4, G9 | Red |
| scripts/runtime/test/validate-dag.test.js | G5 | Red |
| scripts/runtime/test/compose-config.test.js | G6 | Red |
| scripts/runtime/test/next-node.test.js | G7 | Red |
| scripts/runtime/test/advance-stage.test.js | G8 | Red |
| scripts/runtime/test/protocol.test.js | G9 | Red |
| scripts/runtime/test/jsonschema.test.js | G9 | Red |

> TDD 阶段 2 已完成：以上 10 个测试桩已生成于 `scripts/runtime/test/`，均为 Red（skip）状态；`node --test scripts/runtime/test/` 可运行（当前 fail=0）。Coding 阶段实现 runtime 后，逐个去 skip 填充断言转 Green。
