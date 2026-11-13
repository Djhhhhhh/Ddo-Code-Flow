# State Schema v2 实施 Spec

> 本文档用于确认 agent 是否正确理解用户关于「按 issue #86 实施指导手册完成 .state.json 结构规范化（schema v2）代码改造」的需求。

---

## 对齐摘要

- 用户目标：按已经用户批准的 issue #86 自足版实施手册（v1.1），完成 `.state.json` 结构规范化（schema v2）的全部**代码实施**（非再次方案讨论）。
- 期望交付：P-1..P-5 五期改造——①`tools/STATE-SPEC.md` 规范落盘；②state 校验扩展 + `WRITER_ALLOWLIST` 白名单守卫；③使用日志 `.usage.jsonl` + 门协议有界化；④E 区产物登记 + 输出声明第三形态；⑤测试与 dogfood 固化。
- 关键边界：手册是唯一实施依据；10 条红线（不新增 CLI 命令、零迁移、validate 纯读、`interactions[]` 停写等）不可越；只改 P-1..P-5 列出的文件触点。
- 验收基准：V-1..V-8 验收锚点 + 各期 DoD，通过 dogfood run 留档证据核对。
- 当前状态：需求证据充分（手册为前序方案 run 交付物、用户已批准），无阻塞性 BQ，待用户批准本 spec。

---

## 用户目标

- 消除两类已确认问题：历史使用记录无界续写进 `.state.json`（state 膨胀、回滚连带头销毁）；产物记录不完整（如 plan 阶段 split 产物 `plans/` 分册对 state 完全不可见）。
- 落实职责判据：**产物登记留 state**（下游阶段消费的控制流事实）；**历史操作记录外置 `.jsonl`**（复盘用，不增加 `.state.json` 复杂度）。
- 按手册分期任务 P-1..P-5 完成实施，并通过 V-1..V-8 验收锚点验证。

---

## 范围与非目标

### In Scope

- P-1：新建 `tools/STATE-SPEC.md`（搬运手册 §3+§4 为单一权威规范），`SKILL.md` 引用关系节指向它并删除重复结构自述。
- P-2：`tools/lib/state.js` `assertState` 加性扩展（`schemaVersion?`/`workflow?`/`artifacts?`/`gate.lastInteractedAt?`）+ `WRITER_ALLOWLIST` 表 + `DDO_STATE_STRICT=1` 写后 deep-diff 守卫。
- P-3：新建 `tools/lib/journal.js`（`.usage.jsonl` 追加语义）；`isPresentationValid` 改读 `lastInteractedAt` 标量（v1 兼容折算）；cli.js 各写点接入事件日志；`gate present` 增 `--note`；`run finish` 的 `finished` 先于 zip；subflow 双侧事件。
- P-4：输出声明第三形态 `{"files":[…],"dirs":[…]}`；`next` 推进时 E 区登记快照（path/bytes/sha256）；`rollback` 清除登记条目并整目录归档；`validate` 增目录存在且非空检查；`status`/`resume` 暴露 artifacts 摘要；`atom-tasks/plan/config.json` 相位 01 改声明。
- P-5：测试用例清单 8 组（含 V-7 负向）+ dogfood run 的 V-1..V-8 证据留档。

### Non-goals

- 不新增任何 CLI 命令；唯一参数扩展 = `gate present --note`。
- 不写迁移脚本、不动任何存量 run/zip/runs.jsonl（零迁移）。
- 不修改手册已批准契约：发现语义漂移（gate 机制重构、命令面变化）时停止实施并回手册修订，不由 agent 自行改契约。
- 不顺手加强 `{updates}` 声明的弱校验语义（V-7 负向锚点）。
- 不重复方案讨论：手册已是前序方案 run 的批准交付物，本 run 只实施。

---

## 需求对齐

| ID | Agent 对需求的理解 | 来源 | 成功结果 |
|---|---|---|---|
| FR-SPEC-1 | 将手册 §3（数据模型契约）+ §4（工具读写规则）固化为 `tools/STATE-SPEC.md` 单一权威文档；`SKILL.md` 引用关系节增一行指向它并删除重复结构自述。 | 用户原始要求（手册 §7 P-1） | AC-1 |
| FR-STATE-2 | `assertState` 加性扩展四个可选段：`schemaVersion`（integer∈[1,2]）、`workflow`（string）、`artifacts`（§3.5 结构）、`stages.*.gate.lastInteractedAt`（ISO）；无 `schemaVersion` 的 v1 state 原样通过。 | 用户原始要求（手册 §7 P-2①④） | AC-2、AC-3 |
| FR-WLIST-3 | 定义 `WRITER_ALLOWLIST` 表（照抄手册 §4.4）；`DDO_STATE_STRICT=1` 时写后 deep-diff 守卫（越权→stderr+exit 1），缺省关闭。 | 用户原始要求（手册 §7 P-2②③） | AC-2 |
| FR-JRNL-4 | 新建 `tools/lib/journal.js`：`.usage.jsonl` 仅追加、11 种事件、seq 单调（允许空洞）；`interacted` 先写 state 标量后追加日志，其余事件 state 成功后追加、失败仅 stderr 警告。 | 用户原始要求（手册 §3.7/§5.3/§7 P-3①） | AC-4 |
| FR-GATE-5 | 门协议有界化：`gate interact` 停写 `interactions[]`，改写 `lastInteractedAt` 标量；`isPresentationValid` 改标量比较（v1 存量按末元素 `at` 只读折算，异常按 never）；`gate present` 增 `--note`（note 只进日志事件，不进 state）。 | 用户原始要求（手册 §5.2/§7 P-3②③） | AC-4、AC-7 |
| FR-ART-6 | E 区产物登记：`next` 推进 action/updates 相位时对声明 output 做存在性快照登记（`{phase,recordedAt,trigger:"next",files[{path,bytes,sha256}]}`）；声明文件缺失→空登记+提示、不阻断；`rollback` 删除对应阶段条目。 | 用户原始要求（手册 §3.5/§4.3.1/§7 P-4②） | AC-5 |
| FR-SPLIT-7 | 输出声明第三形态 `{"files":[…],"dirs":[…]}`（files 必填、dirs 可选、路径防逃逸）；`atom-tasks/plan/config.json` 相位 01 改该声明；`validate` 对 dirs 做「目录存在且非空」检查（保持纯读）；`stageOutputFiles` 扩展为回滚时整目录移入 `_del/rollback-<n>/`。 | 用户原始要求（手册 §4.3.2/§7 P-4①③④⑥） | AC-5、AC-6 |
| FR-VIEW-8 | `run start` 创建 state 时写入 `schemaVersion:2` 与 `workflow`；`status`/`resume` 视图暴露 artifacts 摘要；`run finish` 的 `finished` 事件先于 zip。 | 用户原始要求（手册 §3.1/§4.3.3/§7 P-3③/P-4⑤） | AC-4、AC-7 |
| FR-NOCMD-9 | 命令面约束：不新增 CLI 命令；13 命令读写行为按手册 §4.2 矩阵收敛；纯读命令（exec/validate/status/resume/list/guide/deps）零写入。 | 用户原始要求（手册 §2 命令面约束/§4.1 R-4） | AC-7 |
| FR-MIGR-10 | 零迁移：已归档 zip 与 runs.jsonl 不动；运行中 v1 state 沿 v1 语义走完（不补写 `schemaVersion`）；未知顶层键不拒绝。 | 用户原始要求（手册 §9.1） | AC-3 |
| FR-TEST-11 | P-5 测试：白名单快照断言、`interacted` 双写崩溃窗口、E 区登记与回滚清除对账、v1 容错、dirs 逐文件登记+整目录归档、V-7 负向、V-8、dogfood SOP 走查；证据留档。 | 用户原始要求（手册 §7 P-5/§8） | AC-4、AC-5、AC-6 |

---

## 约束与保留术语

- **红线 10 条（手册 §10，违反任何一条即返工）**：validate 永不写文件；不新增 CLI 命令；命令只写白名单字段；`gate.interactions[]` 停写；E 区/归档路径 runDir 内相对防逃逸；独立 JSON 文件 2 空格缩进+尾随换行（JSONL 豁免）；零迁移；控制流永不读 `.usage.jsonl`；`interacted` 先 state 后日志；`schemaVersion:2` 只在 run start 写入且 A/B 区创建后冻结。
- **实施铁律**：只改 P-1..P-5 列出的文件触点；不写迁移脚本、不动任何存量 run/zip/runs.jsonl。
- **冲突处理**：手册与仓库代码矛盾时以「文件+符号」重定位（行号会漂移）；语义漂移时停止实施回手册修订。
- **保留术语**：`.state.json`、使用日志 `.usage.jsonl`、E 区（artifacts）、门协议对象（gate）、split 分册、`WRITER_ALLOWLIST`、零迁移、dogfood、相位（phase）。

---

## 解释与假设

| 类型 | 内容 | 依据或原因 | 若错误的影响 |
|---|---|---|---|
| Interpretation | 用户「根据这个 issue，处理一下」= 执行手册所述的**实施 run**（写代码），而非再次产出方案或评估。 | 手册定位节明确「本手册面向的实施 run 正是要执行这些代码变更」，且前序方案 run 已收口。 | 若用户只想要评估或部分实施，范围与交付物会完全不同。 |
| Interpretation | issue 正文（自足版 v1.1，2026-11-11 修订）是最新批准版本，以其为准（修订未进前序 run 的 finish 快照）。 | issue 版本注记与归档说明。 | 若存在更晚的未公开修订，实施依据需同步更新。 |
| Assumption | basic 工作流（requirement→spec→plan→coding→reporting）足以承载实施：手册已是完整批准方案，plan 阶段只需蒸馏为实施序列，无需再开方案讨论。 | 用户在启动问询中选择 basic；手册声明「实施 agent 无需读取 plan.md 等过程存档」。 | 若用户期望更重的过程（如独立 test-plan/verification 阶段），工作流需调整，但不改变交付物范围。 |

---

## 留给 Planning

- **PD-1**：P-3 与 P-4 的实施编排——手册允许并行（P-3 ∥ P-4），run 内 coding 阶段按串行（P-3 → P-4）还是并行推进、每期是否独立提交，由 plan 阶段决定（不改变交付物范围）。

---

## 成功结果

| ID | 用户可观察的结果 | Validates | 来源 |
|---|---|---|---|
| AC-1 | `tools/STATE-SPEC.md` 存在且覆盖 14 个顶层键清单、gate 7 字段、11 种日志事件、白名单表；`SKILL.md` 无结构自述残留。 | FR-SPEC-1 | 用户原始要求（P-1 DoD） |
| AC-2 | v2 形态 state 通过 `assertState` 校验；任一 v1 存量 state 原样通过；`DDO_STATE_STRICT=1` 下越权写被拦截（stderr+exit 1）。 | FR-STATE-2、FR-WLIST-3 | 用户原始要求（P-2 DoD） |
| AC-3 | v1 存量 state（如 run 20261111-141756-f180，plan 门含 9 条 interactions）在新内核走 `status`/`resume` 正常；存量 zip 与 runs.jsonl 零改动。 | FR-MIGR-10、FR-STATE-2 | 用户原始要求（§8 dogfood ⑥/§9.1） |
| AC-4 | dogfood run 中 V-1/V-2/V-3/V-4/V-8 全绿：连续 `gate interact` ≥3 次 state 字节数不变；`.usage.jsonl` 逐事件含 note 全文、seq 单调；gate 无 `interactions` 键、含 `lastInteractedAt`；`rollback` 后日志保留全部 `interacted` 事件；`gate present --note` 的摘要进日志、state 无该字段。 | FR-JRNL-4、FR-GATE-5、FR-VIEW-8、FR-TEST-11 | 用户原始要求（P-3 DoD/§8） |
| AC-5 | dogfood run 中 V-5/V-6 全绿：`next` 推进后 `artifacts[task]` 条目含 path/bytes/sha256 且文件真实存在；split 模式 `plans/` 全部分册逐文件登记、validate 目录检查通过、回滚后整目录入 `_del/`。 | FR-ART-6、FR-SPLIT-7、FR-TEST-11 | 用户原始要求（P-4 DoD/§8） |
| AC-6 | 全部测试用例通过，含 V-7 负向锚点（`{updates}` 相位 validate 仍仅查文件存在性，未被顺手加强）。 | FR-SPLIT-7、FR-TEST-11 | 用户原始要求（P-5 DoD/§8） |
| AC-7 | 命令面验收：13 个 CLI 命令无新增；`gate present --note` 为唯一参数扩展且 note 不进 state；纯读命令零写入；`run start` 写入 `schemaVersion:2` 与 `workflow`。 | FR-NOCMD-9、FR-GATE-5、FR-VIEW-8 | 用户原始要求（§2/§4/红线 2） |

---

## 用户确认

当前无阻塞问题（BQ），可以批准。用户可以：

- ✅ **同意**：批准当前 spec，进入 Planning。
- ❌ **修改：<反馈>**：修改当前 spec，展示变化后重新确认。
- ❓ **提问：<问题>**：仅答疑；如需据此改动，必须随后明确选择 `修改`。
