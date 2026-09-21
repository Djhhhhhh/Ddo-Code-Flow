# 工作项 05 · atom-tasks — 原子任务改造设计

> 版本：**v1.0（2026-09-22 已定版）**——本轮交付 exec 通用组装器 + 三个样例任务 + 测试。变更需升级版本号并记录于 §10。
> 需求依据：[requirement.md](./requirement.md)（D1–D13）
> 上游契约：[04-cli-commands/plan.md](../04-cli-commands/plan.md) v1.1（exec 契约位）、[02-index-structure/plan.md](../02-index-structure/plan.md) v1.0（state.atomTasks 字段）

## 1. 定位与架构原则

原子任务是 v2 的积木（00 定位）：**自包含的 prompt 资产 + 声明式配置**，由通用组装器（tools/ 的 `exec`）按执行位置组装出「恰好必需」的 prompt。本工作项定义 v2 标准结构、通用组装器实现、并改造三个代表性任务供验收。

**预设与事实源分离（D11，2026-09-22 定版）**：

- workflow 只是**预设**——原子任务间**不做强制依赖**，任务关联只在 workflow 定义中声明；
- 预设装配后的具体信息落到 `.state.json`，**`.state.json` 是运行过程中的唯一事实来源**——运行期（exec/钩子/未来的 next）一切读取以 state 为准，不回读预设；
- 推论：ctx（任务需要什么上下文）**不静态声明在任务里**——执行时基于 state 动态计算（D12）。

## 2. 标准结构（三件套）

```text
atom-tasks/<task>/
├── prompt.md      # 原始 prompt：agent 读，md；按相位分段（D8）
├── config.json    # 默认配置注册：脚本读，JSON（D7 判据）
└── <task>.js      # （可选）任务特定组装钩子：仅通用组装不够时才写
```

90% 任务只有 md + json 两件；`<task>.js` 是逃生舱，不是必选项。

### 2.1 `prompt.md` 契约

```markdown
# spec
（共享前言：任务定位/通用约束——未被相位标记包裹，每次输出携带）

<!-- @phase:01 -->
（相位 01 的完整指令）
<!-- /phase:01 -->

<!-- @phase:02 -->
（相位 02 的完整指令）
<!-- /phase:02 -->
```

- 标记语法：`<!-- @phase:<id> -->` / `<!-- /phase:<id> -->`，id 两位零填充（与 state 的 `stageId:phase` 记法一致）；
- **切片语义**：exec 只输出「共享前言 + 当前相位段」，不全量喂（D8）；
- 无任何标记 → 整文件即单相位 `:01`（单相位任务零负担）；
- 相位平铺不嵌套；一文件内每个相位 id 唯一；
- 标记是 HTML 注释，md 渲染不可见，人读整文件仍是干净 markdown。

**交互标记（`@interact`，2026-09-22 补充）**——相位段内可声明必须完成的交互：

```markdown
<!-- @phase:02 -->
<!-- @interact:required tool=ask-user -->
必须调用宿主提问工具（如 Claude Code 的 AskUserQuestion）向用户展示 spec 摘要，
获取 批准/驳回。未获得用户明确回复前，禁止调用任何推进命令。
<!-- /interact -->
（相位指令本体……）
<!-- /phase:02 -->
```

- 覆盖两类交互：**与用户交互**（提问/确认门，`tool=ask-user`）；**与终端交互**（需要 TTY 的命令，`tool=user-shell`——指令约定 agent 把命令交给用户执行（如 Claude Code 的 `! <command>` 前缀），不得代跑）；
- `@interact:required` 是 exec 的组装信号（见 §4 的 L2 强化）；human 相位（`type: human`）应携带该标记。

**交互保证分级**（诚实边界：prompt 是建议性的，保证靠分层）：

| 级 | 机制 | 保证程度 | 归属 |
|---|---|---|---|
| L1 | 相位段内交互指令（prompt 声明） | 遵守率高，无结构保证 | 本轮 |
| L2 | exec 检测 `@interact:required` → 输出顶部注入硬约束块 + 强制指定宿主提问工具 | 工具调用合规率远高于自由文本 | 本轮 |
| L3 | 状态机门：human 相位推进只接受用户侧信号，agent 无法自证完成 | 结构性 100% | 执行循环轮（O-B，`@interact` 即其数据来源） |

### 2.2 `config.json` 契约

```json
{
  "name": "spec",
  "version": "2.0.0",
  "phases": [
    { "id": "01", "summary": "生成 Alignment Spec", "type": "action" },
    { "id": "02", "summary": "用户确认门", "type": "human" }
  ],
  "defaults": { "extra_ctx": "", "rules": [] }
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` / `version` | ✔ | 任务标识与版本（v2 任务从 2.0.0 起） |
| `phases[]` | ✖ | 相位声明：`id`（两位）、`summary`、`type`（`action`=AI 执行 / `human`=人审点）。省略 = 单相位 01/action。**这是原 O1 的关闭**：相位数由原子任务自声明，组装进 stage 时由 workflow 轮接线 |
| `defaults` | ✖ | `extra_ctx`（注入 prompt 的扩展 prompt 片段）与 `rules[]`（自定义要求/注意事项）的任务默认值 |

**明确不含**（D11/D12 的直接推论）：

- `ctx`——上下文**不静态声明**：任务间无强制依赖，「哪些上下文进入下一步 prompt」由钩子在执行时基于 state 现算（§2.3）；
- `consumes` / `produces`（v4 的角色耦合）——同上，关联归 workflow 预设，运行期归 state；
- v4 调度属性（timeoutSec/concurrency）——调度归 workflow 轮。

### 2.3 产出规范化（`.output.schema.json`，v1.2——保证产出结果稳定）

**定位**：产出规范化是**原子任务自持的规则**。沿用 v4 验证过的 schema 资产结构（sections 的 required/format/columns/idPattern/subsections、全局 rules、完整 example），由 meta-schema（`_schema/output-schema.schema.json`）约束 schema 本身。

```text
atom-tasks/<task>/
├── config.json                      # output 只做定位：字符串=产出文件名；{updates:[…]}=只写回
├── <task>.output.schema.json        # 结构契约（WHAT）——meta 校验保证 schema 合法
└── prompt.md / <task>.js            # 生成侧
```

**三层稳定机制**：

| 层 | 载体 | 性质 |
|---|---|---|
| 声明 | `<task>.output.schema.json`（required/optional section、format（list/table/group/structured-list/template）、columns、idPrefix/idPattern、subsections、rules、example） | 契约源，meta-schema 硬约束 |
| 生成 | exec 把 schema **渲染成 md「Output Contract」块**注入 prompt（含全部结构要求、全局规则、完整示例）——agent 只读 md（D7），比 v4（agent 自己开 JSON）更顺 | 软约束 |
| 校验 | `validate`（§4.2）：meta 校验先行；required section/level/subsections 存在、table 列齐、structured-list ID 格式、占位填充检测、jsonFields 类型 | **硬保证**：不合格 exit 1 → 修正循环 |

**无文档产出的任务**（coding/git-worktree 样例）：省略 output 与 schema——validate 报 skipped。

**联动**：rollback `_del` 归档清单 = config 的 output 产物/写回文件（数据来源就位）。

### 2.4 `<task>.js` 钩子契约（ctx 动态计算的落点，D12）

```js
module.exports = {
  assemble({ phase, state, statePath, config, sections }) {
    // phase:    当前相位 id（如 "02"）
    // state:    .state.json 内容（唯一事实源——ctx 从这里现算）
    // statePath:.state.json 绝对路径——run 目录锚点（ctx 动态读取产物的基准，v1.0 补）
    // config:   三层合并后的生效配置（extra_ctx/rules 已合并）
    // sections: { preamble, instruction, extraCtx, rules } —— preamble/instruction/extraCtx
    //           为 md 文本，rules 为字符串数组
    // 返回:     完整 prompt（md 文本）。
    // 典型用法：按 state 判断当前需要哪些上下文（如 state 所在 run 目录下
    //           存在哪些产物），动态收集后拼成 ctx 段，插入 instruction 与
    //           extraCtx 之间。
    // 返回 undefined / 不导出 assemble → exec 用默认模板拼装（无 ctx 段）。
  },
};
```

- **钩子是 ctx 引擎**：需要上下文的任务用钩子从 state 现算（读 state 派生路径下的产物、按相位选择、按存在性容错）；不需要上下文的任务（纯指令）不写 js；
- 抛错 → exec exit 1（stderr 透传）；
- 输入输出全程 md 文本（D7）；
- tools/ 对任务**零特定知识**——只认本钩子契约（「更高一层抽象」的落点，D3）。

## 3. 配置体系（D6/D9）

```text
任务默认（config.json 的 defaults）
  < 用户级（~/.ddo/atom-tasks.json：{"<task>": {"extra_ctx": "…", "rules": […]}}）
  < run 级（state.atomTasks["<task>"]，02 基线预留字段）
```

- **不存在项目级**（D6）；
- 终态（D9）：run start 启动时把用户级合并快照进 `state.atomTasks`，exec 只读 state；
- 过渡（本轮）：run start 未落地，exec 三层现读（state.atomTasks 若有则最高优先）；run start 落地后只是多一个写入方，exec 逻辑不变；
- 合并语义：标量覆盖、`rules` 数组拼接（用户级 + run 级追加在任务默认之后）。

## 4. 组装管线（exec 通用组装器，本轮实现）

```text
用法:   exec --state <path> --task <name> [--phase <id>]     （04 plan §2.3 契约位）
前置:   atom-tasks/<task>/{prompt.md,config.json} 存在；--phase 在 phases 声明内（缺省 01）

流程（全程 md 文本操作，D7）:
  ① 校验任务目录与相位声明（--phase 必须在 phases 声明内，缺省 01）
  ② 配置三层合并（rules 拼接语义，P3 定稿）→ 生效 extra_ctx / rules
  ③ 切片：prompt.md → 共享前言 + @phase:<id> 段
  ④ L2 交互强化：切片结果含 @interact:required → 在输出最顶部注入硬约束块
     （「本次执行包含必须完成的交互，未完成前不得调用任何推进命令」+ 指定宿主工具）
  ⑤ ctx 动态追加（D12）：<task>.js 存在且导出 assemble → 以 sections 调用，
     钩子基于 state 现算 ctx 并返回完整 prompt；无钩子 → 默认模板（无 ctx 段）
  ⑥ 输出：裸文本 md（stdout 直出，四通道唯一例外——04 P2 已定稿）

输出模板（P2 定稿：指令在前；ctx 段由钩子插入）:
  [L2 硬约束块]        ← 仅当相位含 @interact:required
  <共享前言>
  <当前相位指令段>
  ──（分隔）──
  ## Context: <标题>    ← 钩子按 state 动态现算的上下文段（可有多个/可无）
  <ctx 内容>
  ## Extra Context
  <extra_ctx>
  ## Rules
  - <rule>              ← 三层拼接（任务默认 → 用户级 → run 级）
```

**指令渐进与上下文渐进是两条独立通道**：`:02` 不重喂 `:01` 的指令段，但 `:01` 的产物可被 `:02` 的 ctx 声明注入（指令不重复，事实跟得上）。

### 4.2 `validate`（产出规范化校验，v1.2 schema 驱动实现）

```text
用法:   validate --state <path> --task <name> [--phase <id>] [--tasks-dir <dir>]
前置:   任务存在（prompt.md + config.json）；声明的相位（缺省 01）
逻辑:   ① 读 config 的 output 声明（字符串=产出 / {updates}=写回 / 无=skipped）
        ② meta 校验先行：schema 不符合 _schema/output-schema.schema.json → exit 1（设计时错误，
           不依赖产物存在）
        ③ 产物文件存在性（产出 + 写回清单）
        ④ 结构硬校验（<task>.output.schema.json）：
             required section / subsection 存在（可选 section 缺失 = 合法省略）
             section 正文无占位填充（无/待定/TBD/N/A）
             table 格式列齐全；structured-list 条目符合 idPattern（如 BQ-{N}）
             jsonFields 模式：字段存在 + 类型匹配
输出:   { "validated": true }
        { "validated": null, "reason": "任务未声明产出" }        → exit 0（skipped）
        { "validated": false, "missing": […], "errors": […] }    → exit 1（stderr 人话 + stdout JSON，
                                                                   供修正循环解析）
错误:   exit 2 —— 参数缺失/非法
定位:   顶层动词；执行循环在任务执行后调用，不合格即进修正循环（重 exec → 重 validate）
```

## 5. 与已定版契约的一致性

| 契约 | 本设计如何遵守 |
|---|---|
| D7 格式判据 | config/用户级/state.atomTasks 为脚本读（JSON）；prompt、ctx、产物、组装输出为 agent 读（md） |
| 04 P2 | exec 裸文本输出 |
| 04 D1 命令哲学 | exec 自持组装逻辑；tools/ 零任务特定知识 |
| 02 基线 | 不新增 state 字段（atomTasks 已预留）；exec 只读 state（过渡期读三层，见 §3） |
| 03 §3.4 | exec 为顶层动词（已定版命名） |
| 测试隔离 | tools/tests 增 exec 用例，沿用沙箱约定 |

## 6. 代表性改造任务（D5，评审点 P5）

| 任务 | 形态覆盖 | 改造要点 |
|---|---|---|
| `spec` | 多相位 + 动态上下文 + 人审门 | 2 相位（01 生成 action / 02 确认 human + @interact）；`spec.js` 钩子演示 ctx 动态计算（:01 注入 requirement、:02 注入 requirement + 刚产出的 spec.md）；v4 的 `confirmation.rejectAction` 语义映射为「:02 驳回 → rollback --stage spec」写进指令 |
| `coding` | 单相位大体量执行类 | 无相位标记；`coding.js` 按存在性容错注入 plan.md / test-plan.md / tasks（存在才进 ctx）；指令重组为 v2 直陈式 |
| `git-worktree` | 纯动作类、git 交互 | 单相位；`git-worktree.js` 注入 requirement；v4 的 worktree-info 产物声明不迁移（关联归 workflow 预设） |

旧 `<task>.md` 与 `*.output.schema.json` 在样例改造时删除（git 历史可回；output schema 随产物机制另行设计）。

## 7. 验收与全量迁移（D5）

1. 本轮交付：本设计 + 通用组装器实现 + 三个样例任务 + exec 测试用例；
2. 用户验收样例（重点：相位切片是否「恰好必需」、extra_ctx/rules 注入形态、钩子边界）；
3. 验收通过 → 全量迁移剩余 15 个任务（后续执行）；
4. 全量迁移后清理 v4 目录级遗留（`_schema/`、`artifacts.json`、`branch-rules.json` 等的存废）——开放问题 O-D。

## 8. 开放问题

| # | 问题 | 状态 |
|---|---|---|
| O-A | ~~`ctx` 的 `role` 解析~~ | **已关闭（v0.3）**：ctx 不静态声明（D12），钩子从 state 动态现算；产物定位的约定随产物登记机制在钩子内演进 |
| O-B | `waiting-human` 状态的进入/离开（exec 输出后谁置状态、human 相位完成谁推进）——即交互保证 L3 状态机门 | 执行循环轮；`type: human` + `@interact` 声明已就位（L3 的数据来源） |
| O-C | `stages ↔ task` 映射（next 报任务名的依据） | workflow 轮；next 仍悬置于该轮 |
| O-D | ~~v4 目录级遗留文件的存废~~ | **已关闭（v1.4）**：删除 `artifacts.json`、`_schema/artifact-catalog.schema.json`、`_schema/atom-task-md.schema.json`——角色映射职责已由 ctx 钩子（文件定位）与 config output 声明（产物定位符）接管，v4 frontmatter 契约由 config.json + meta-schema 取代；全仓零引用，测试 26/26 与 exec/validate 冒烟无损 |
| 原 O1 | 相位数来源 | **已关闭**：`config.json.phases` 自声明（本设计 §2.2） |

## 9. 评审要点（全部已处理）

| # | 结论 |
|---|---|
| P1 | ✅ 定稿：ctx **执行时动态计算**（D12）——config.json 无静态 ctx 声明，`<task>.js` 钩子基于唯一事实源 state 现算并追加 |
| P2 | ✅ 定稿：输出模板指令在前（前言 → 指令 → ctx → extra_ctx → rules） |
| P3 | ✅ 定稿：三层覆盖 + `rules` 数组拼接（任务默认 → 用户级 → run 级逐层追加） |
| P4 | ✅ 定稿：`phases[].type: action\|human` 进 config.json（接线留执行循环轮） |
| P5 | ✅ 定稿：样例 spec / coding / git-worktree |
| P6 | ✅ 定稿：样例改造即删旧 v4 文件（git 历史可回） |

## 变更记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.1 | 2026-09-22 | 初版：三件套标准结构、相位标记切片、配置三层体系、exec 组装管线、三个代表性任务改造方案 |
| v0.2 | 2026-09-22 | 补充：交互保证分级（L1/L2/L3）+ `@interact` 标记（ask-user / user-shell 两类）；组装管线新增 ④ L2 交互强化步骤；输出模板增硬约束块 |
| v0.3 | 2026-09-22 | P1–P6 评审定稿：新增架构原则（预设与事实源分离，D11）；ctx 改为钩子动态计算（D12，config 移除 ctx/consumes/produces）；钩子 API 升级为 sections 形态；rules 拼接语义定稿 |
| **v1.0** | 2026-09-22 | **定版**：钩子签名补 `statePath`（ctx 动态计算需要 run 目录锚点）；进入实现——exec 组装器 + 三个样例 + 测试 |
| v1.1 | 2026-09-22 | 补充产出规范化（用户需求：规范化是原子任务自持的规则，保证产出稳定）：§2.3 output 声明（artifact/sections/updates，相位级或顶层）+ 三层稳定机制（声明/生成/校验）+ §4.2 validate 命令；解锁 rollback `_del` 归档的数据来源 |
| **v1.2** | 2026-09-22 | 按用户评审升级为 **`.output.schema.json` 方式**（恢复 v4 schema 资产结构 + meta-schema 约束；config.output 简化为定位符）；exec 注入 md 渲染的 Output Contract（含 rules/example）；validate 升级为 schema 驱动（meta 先行 + required/subsection/列/idPattern/占位/jsonFields）；恢复 spec.output.schema.json（修正 v4 遗留 titleFormat 漂移）；修复管道下 process.exit 截断输出的缺陷 |
| **v1.3** | 2026-09-22 | **全量迁移执行完毕**：剩余 14 个任务全部改为 v2 三件套（prompt.md / config.json / 可选 hook + output.schema）。v4 schema 自 `3cff557` 恢复并统一命名 `<task>.output.schema.json`，共 15 个到位（批量恢复曾部分丢失，二次补齐 10 个并重修 plan 对 meta-schema 的漂移——7 个根级自定义属性与 section 级属性折叠进 rules[]/description、字符串 subsections 转对象；meta-schema `outputFormat` 枚举扩为 markdown/json/json+markdown；补 git-worktree 顶层 `output: worktree-info.json` 定位符）；生成 9 个 ctx 钩子（requirement/plan/test-plan/tasking/verification/reporting/reflection/create-pr/delivery-doc，修复批量生成遗留的 `{{`/`}}` 未反转义）；plan 2 相位、test-plan 3 相位（含 TDD）、reflection 2 相位，交互门按 v4 语义移植；v4 旧文件 27 个 `git rm`（保留 review/check-list.md、plan/references/ddo.md）。冒烟：17 任务 × :01 + 多相位 :02/:03 共 22 项 exec 全通过，15 个 schema 任务契约块全部注入（coding/cleanup-worktree 无产物契约，符合设计），meta 校验 15/15，validate 正/负例（json+markdown 两路）验证通过，必需上下文缺失阻断验证通过；测试 26/26 |
| **v1.4** | 2026-09-22 | **O-D 关闭（v4 遗留清理）**：删除 `artifacts.json`、`_schema/artifact-catalog.schema.json`、`_schema/atom-task-md.schema.json`；`_schema/` 仅存 meta-schema。角色/产物定位职责归属：ctx 钩子（文件定位）+ config output 声明（产物定位符）；v4 frontmatter 契约由 config.json 取代。全仓零引用，测试 26/26 + exec/validate 冒烟无损 |
