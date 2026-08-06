# show\-case

# Ddo\-Code\-Flow v4 执行全景 Show Case（三地解耦 · 项目内 \.ddo 默认）



> 本文档以一个**完整的端到端示例**，展示 v4 解耦架构（spec revision 8 / plan revision 7）下一次 run 的**产出全景**：每个文件落在哪里、由谁产出、被谁消费、如何关联管理。
> 
> 
> 
> 本版要点：**skill 全局只读**、**项目内 ****`.ddo/`**** 工作区默认自动创建（config \+ runs，runs 只存产物）**、**worktree 默认与项目同级（以单一 worktreeDir 字段可配置）**、**项目只维护一份 config\.json（仅内存合成，无每 run 副本）**、**git 可见性完全交还用户**。
> 
> 



---



## 0\. 场景设定



|项目|值|
|---|---|
|用户输入|`用 ddo-code-flow 跑一遍流水线，需求是：实现 reverseString(s: string): string 纯函数模块`|
|skill 安装位置|`~/.claude/skills/ddo-code-flow/`（设备全局 skill 库，自动发现，无需项目登记）|
|项目|`~/work/demo-app`（git 仓库，main 分支）|
|项目级配置|首次 run 由 skill 自动创建 `~/work/demo-app/.ddo/config.json`|
|解析出的 workflow|`standard`（selection rules 无命中 → fallback）|
|分支|`feat/2026-08-05-reverse-string`|



---



## 1\. 三地布局总览（★ config\.json 的位置在这里）



```Plain Text
① skillRoot —— 全局 skill 库（只读程序体，运行期不落一字节）
~/.claude/skills/ddo-code-flow/
├── SKILL.md                          # runtime 指令（机制的唯一真相源）
├── config.default.json               # 全局默认配置：workflow 索引 / 选择规则 / base 默认值
├── config.schema.json                # 元 schema（含 $defs/workflowDefinition、$defs/projectConfig）
├── state.schema.json                 # .state.json 顶层字段 schema 与 writer 归属
├── atom-tasks/                       # 16 个任务：各自 <name>.md（produces/consumes 声明 + 业务正文）
│   ├── artifacts.json                #   产物角色目录：role ↔ 规范文件名（全局唯一真相源）
│   ├── _schema/                      #   atom-task-md.schema.json (v4) / artifact-catalog.schema.json / output-schema.schema.json
│   ├── context/  requirement/  git-worktree/  spec/  plan/  test-plan/
│   ├── tasking/  coding/  verification/  review/  reporting/  reflection/
│   └── issue-fetch/  remote-gate/  delivery-doc/  create-pr/
├── workflows/                        # 编排层：stage 顺序 + 确认门 + 节点参数（唯一集成位置）
│   ├── lightweight.json  standard.json  guarded.json  issue-driven.json
├── scripts/metrics/                  # Metrics 插件（配置由 runtime 传入 / 读项目配置）
└── ui/                               # Studio（设计时工具，不在运行期使用）

② projectRoot —— 用户仓库（.ddo/ 工作区随项目入库）
~/work/demo-app/
├── .git/
│   └── worktrees/demo-app-feat-2026-08-05-reverse-string/   # git 标准 worktree 元数据
├── src/ ...                          # 源码（改动发生在 worktree 分支上，合并后回主干）
└── .ddo/                             # ★ ddo 工作区，首次 run 自动创建，随项目入库
    ├── config.json                   # ★★ 项目级配置（用户可编辑、可提交共享）
    └── runs/                         # ★ 只存储产物信息（不含 worktree / src）
        └── feat/2026-08-05-reverse-string/                  # 本次 run 的产物（随分支合并而来）
            ├── worktree-info.json         # worktree-info 角色
            ├── context-summary.md         # context-summary 角色
            ├── requirement.md             # requirement 角色
            ├── spec.md                    # spec 角色
            ├── plan.md                    # plan 角色
            ├── test-plan.md               # test-plan 角色
            ├── tasks/task-group.json + task-01.md         # task-group + tasks-dir 角色
            ├── verification.log           # verification-log 角色
            ├── execution-report.md        # execution-report 角色
            └── reflection-report.md       # reflection-report 角色

③ worktree —— 项目同级（默认落点；分支完整检出）
~/work/demo-app-feat-2026-08-05-reverse-string/
├── src/reverseString.ts …            # 源码改动（随 commit 入分支）
└── .ddo/runs/feat/2026-08-05-reverse-string/                # 运行期生成的产物（合并后进入项目 .ddo/runs/）
    ├── .state.json                   # 状态机 + 黑板清单 + history（运行期状态，通常 gitignore）
    └── spec.md  plan.md  …           # 与上图同一份产物清单
```



**config\.json 的两个形态**：

- **全局默认** `~/.claude/skills/ddo-code-flow/config.default.json`——skill 自带，只读。

- **项目级** `~/work/demo-app/.ddo/config.json`——★ 用户问的就是这个；首次 run 自动创建，可编辑、可提交仓库共享。

**git 归属（完全交还用户）**：skill 不写 `.gitignore`、不写 git exclude。`.ddo/` 随项目入库，其中哪些内容入库由用户在 `.gitignore` 自定义——通常提交 `.ddo/config.json` 与 `.ddo/runs/` 产物，忽略运行期的 `.state.json`（这是文档建议，非 skill 行为）。产物经分支合并后落在项目级 `.ddo/runs/<type>/<date>/`。



**worktree 项目同级，\.ddo/runs/ 只存产物**：worktree 是分支完整检出（src \+ 运行期产物），默认创建在项目同级（与项目并列），不进入项目 `.ddo/runs/`；项目 `.ddo/runs/` 只存从分支合并来的产物信息，不含 worktree/src。故 `.ddo/` 恒为「config \+ 产物」的清爽结构。



---



## 2\. 阶段 0 —— 启动、配置合并与 \.ddo/ 引导



1. agent 从全局 skill 库自动发现并加载 SKILL\.md、config schema、state schema 与 artifact catalog（**项目侧无需登记 skill 位置**）。

2. **\.ddo/ 引导（幂等）**：检查项目 `.ddo/`，不存在则创建 `.ddo/config.json`（按 `$defs/projectConfig` 写最小默认）与 `.ddo/runs/`；已存在则不覆盖用户配置。

3. 配置合成（纯函数，运行期唯一一次，仅内存、不落盘）：

```Plain Text
全局默认  config.default.json                 ─┐
项目级    ~/work/demo-app/.ddo/config.json     ─┼─► 深合并（对象递归 / 数组覆盖）
run 参数  本例无 --key value                    ─┘
                                                ▼
              内存中的有效配置   ← 后续校验与执行直接使用；不产生每 run 一份的配置副本
```



4. workflow 选择：优先级 `--model <workflow-id>` 显式指定 \> 用户 prompt 规则匹配 \> fallback。本例未带 `--model`、规则无命中 → fallback `standard`。

5. run 类型：`--feature` → feat、`--bugfix` → fix（决定分支前缀与产物 `<type>` 目录）；均未指定则按提示词推断或默认。本例为需求 → feat。

6. 状态在内存中初始化（worktreePath 建立前先走延迟写入）。

**调用参数（最小集）**：`--model <workflow-id>` 显式选流水线；`--feature` / `--bugfix` 无值标志，标识需求/bug 的 run 类型。其余参数当前不引入（配置统一归 config\.json）。



## 3\. 阶段 1 —— worktree 创建（位置可配置）



|步骤|动作|落盘|
|---|---|---|
|context|读项目上下文，产出 context\-summary|**延迟写入**：base64 暂存 `.state.json.pendingOutputs`|
|requirement|确认需求明确，产出 requirement\.md|同上|
|git\-worktree|**worktree 位置解析**：读有效配置 worktreeDir（缺省为项目父目录，即 worktree 与项目同级），在 `<worktreeDir>/<projectName>-<branchName(/→-)>/` 创建 worktree；worktreeDir 指向任意目录即切换落点。冲突追加 \-2|① `git worktree add` 创建 worktree；② 生成 runId；③ 刷写 pendingOutputs 全部产物；④ 登记 worktree\-info 角色；⑤ `.state.json` 落盘（记 projectRoot / worktreePath 两个绝对锚点 \+ skillName/skillVersion 身份）|



> skill 对项目的唯一 git 接触是标准 worktree 元数据（`.git/worktrees/`）。skill **不**写 `.gitignore`、**不**写 exclude——git 可见性由用户决定。
> 
> 



## 4\. 阶段 2 —— 黑板登记与注入：上游通知，下游被动接受



每个节点生命周期固定三步：**注入 → 执行 → 登记**。下游任务从不点名上游文件，只声明需要的角色；runtime 按 `.state.json.artifacts` 黑板匹配后注入 `{{inputs.<role>}}` 绑定。



standard workflow 全程角色流转：



|stage|任务|被动接受的输入（runtime 注入）|产出并登记的角色|
|---|---|---|---|
|context|context|运行时上下文：用户 prompt、项目文件（非角色输入）|`context-summary`|
|requirement|requirement|运行时上下文：用户 prompt；`issue-context`（issue-driven 中可选）|`requirement`|
|requirement|git\-worktree|`requirement`；skill 自带 branch\-rules|`worktree-info`|
|spec ⛔确认门|spec|`requirement`、`context-summary`（可选）|`spec`|
|planning ⛔确认门|plan|`spec`、`context-summary`（可选）|`plan`、`plan-parts`（可选）、`tech-design`（可选）|
|test\-plan ⛔确认门|test\-plan|`spec`|`test-plan`|
|tasking|tasking|`plan`、`test-plan`|`tasks-dir`、`task-group`|
|coding|coding|`spec`、`plan`、`task-group`（可选）、`tasks-dir`（可选）、`test-plan`（可选）、`verification-log`（重试时可选）|`code-change`|
|verification|verification|`spec`、`test-plan`（可选）、`plan`（可选）|`verification-log`|
|reporting|reporting|`verification-log`（可选）、`spec`（可选）、`plan`（可选）、`test-plan`（可选）、`context-summary`（可选）|`execution-report`|
|reflection ⛔确认门|reflection|`execution-report`|`reflection-report`|
|done|—（终态哨兵，校验 Step 5 不变量）|||



输入的三个来源（全部被动送达，任务不主动拉取）：



1. **黑板角色**——上游已登记的 run 产物（`{{inputs.spec}}` → 实际路径）；

2. **运行时上下文**——用户 prompt 与 args；用户原始需求由 runtime 注入给 requirement，不作为 `.state.json` 顶层字段持久化；

3. **配置注入**——有效配置中的参数以 node options 下发（任务永不读取配置文件本身）。

**编排期保证**：上表在 run 开始前经过角色可达性校验——任一 required 角色在 DAG 上游无生产者即拒绝启动。



## 5\. `.state.json` 全貌（run 的唯一状态源 \+ 黑板）



```Plain Text
{
  "runId": "demo-app-feat-2026-08-05-reverse-string",
  "workflowId": "standard",
  "createdAt": "2026-08-05T10:00:00Z",
  "skillName": "ddo-code-flow",              // 身份：续跑按名再解析
  "skillVersion": "4.0.0",                   // 版本不匹配 → 告警
  "skillRoot": "~/.claude/skills/ddo-code-flow",  // 仅作 hint 校验
  "projectRoot": "~/work/demo-app",          // 绝对锚点 ①
  "worktreePath": "~/work/demo-app-feat-2026-08-05-reverse-string", // 绝对锚点 ②（worktree 与项目同级）
  "configPath": ".ddo/config.json",          // 相对 projectRoot
  "workflowPath": "workflows/standard.json", // 相对 skillRoot
  "type": "feat",
  "dateDescription": "2026-08-05-reverse-string",
  "artifactDir": "~/work/demo-app-feat-2026-08-05-reverse-string/.ddo/runs/feat/2026-08-05-reverse-string",
  "args": {},
  "currentStage": "done",
  "stages": { "context": { "status": "done" }, "…": "…" },
  "artifacts": {                             // ★ 黑板清单：上游登记、下游消费的唯一依据
    "context-summary":  { "path": "run://.ddo/runs/feat/2026-08-05-reverse-string/context-summary.md", "producer": "context",    "stage": "context",    "at": "…" },
    "requirement":      { "path": "run://.ddo/runs/feat/2026-08-05-reverse-string/requirement.md",     "producer": "requirement","stage": "requirement","at": "…" },
    "worktree-info":    { "path": "run://.ddo/runs/feat/2026-08-05-reverse-string/worktree-info.json", "producer": "git-worktree","stage": "requirement","at": "…" },
    "spec":             { "path": "run://.ddo/runs/feat/2026-08-05-reverse-string/spec.md",            "producer": "spec",       "stage": "spec",       "at": "…" },
    "plan":             { "…": "…" },
    "test-plan":        { "…": "…" },
    "task-group":       { "…": "…" },
    "code-change":      { "path": "run://", "producer": "coding", "stage": "coding", "at": "…" },
    "verification-log": { "…": "…" },
    "execution-report": { "…": "…" },
    "reflection-report":{ "…": "…" }
  },
  "pendingOutputs": {},
  "history": [
    { "event": "created",          "at": "…", "note": "workflowId=standard" },
    { "event": "worktree-created", "at": "…" },
    { "event": "node-start", "stage": "spec", "node": "spec", "at": "…" },
    { "event": "node-done",  "stage": "spec", "node": "spec", "at": "…" },
    { "event": "gate-pending",  "stage": "spec", "at": "…" },
    { "event": "gate-approved", "stage": "spec", "at": "…" },
    { "event": "run-completed", "at": "…" }
  ]
}
```



## 6\. 关联管理总表



|被管理对象|管理者（单一真相源）|机制|消费者|
|---|---|---|---|
|角色 ↔ 文件名契约|`artifacts.json`（skill 内）|目录元 schema \+ 编排期校验|runtime 路径解析、README 产物树|
|角色 → 实际路径实例|`.state.json.artifacts`|节点交付即登记（单一生产者）|runtime 注入、reporting/review|
|任务输入|runtime 注入|consumes 声明 → 黑板匹配 → `{{inputs.<role>}}`|所有 atom\-task|
|执行顺序 / 确认门 / 节点参数|`workflows/*.json`|pipeline 唯一集成位置|runtime 调度|
|配置生效值|runtime 内存合成（全局默认 ← \.ddo/config\.json ← run 参数）|纯函数合并，不落盘、无副本|校验 / 执行|
|执行状态字段契约|`state.schema.json`|顶层字段 schema、唯一 writer、允许 readers|runtime / atom-task fallback 读取|
|执行状态与历史|`.state.json`|runtime 状态机，history 只追加|续跑 / reporting / reflection|
|git 可见性|**用户的 ****`.gitignore`**|skill 不参与|用户|
|产物可追溯性|分支 `feat/…` \+ 合并|git 原生|项目仓库历史|
|skill 身份与续跑|`.state.json.skillName/skillVersion`|按名再解析，路径仅 hint|续跑流程|



**方向的直观总结**：



```Plain Text
写入方向（上游 → 黑板）     消费方向（黑板 → 下游）
任务A 交付产物               runtime 进入任务B
   │                            │
   ▼                            ▼
runtime 登记 role→path       按 B.consumes 查 manifest
   │                            │
   ▼                            ▼
.state.json.artifacts  ───►  注入 {{inputs.role}} 绑定
```



## 7\. 收尾：合并回项目



1. reflection 确认门通过 → 终态哨兵校验 Step 5 不变量 → `currentStage: done`。

2. （若启用 Metrics）runFinish 基于内存有效配置生成 metrics\-report\.md。

3. 分支 `feat/2026-08-05-reverse-string` 上已有全部产物与源码改动；用户合并分支后，项目仓库新增：

```Plain Text
~/work/demo-app/                        ← 合并后
├── src/reverseString.ts                # 源码改动
└── .ddo/                               # ddo 工作区：配置 + 全部 run 产物
    ├── config.json                     # 项目级配置（随项目入库，用户自管）
    └── runs/
        └── feat/2026-08-05-reverse-string/  # 本次 run 的产物
            ├── worktree-info.json  context-summary.md  requirement.md
            ├── spec.md  plan.md  test-plan.md  tasks/…
            └── verification.log  execution-report.md  reflection-report.md
```



（瞬态 worktree 在项目同级，合并后可删除；`.ddo/runs/` 只存产物，是否入库由用户 `.gitignore` 决定，skill 不干预。）



## 8\. 中断与续跑



会话中断后再次触发：



1. runtime 扫描候选 `.state.json`（按 worktreePath 锚点定位，含默认项目同级与可配置的其他位置）。

2. 读取候选 state：`workflowId` 确定 workflow；`skillName` 与当前会话 skill 匹配——**skill 已搬家/升级也能解析**，版本不匹配仅告警。

3. 相对引用还原：`workflowPath` 相对 skillRoot、`configPath` 相对 projectRoot。

4. 从 `currentStage` 继续；history 追加 `resumed`。

## 9\. 定制变体（项目级配置示例）



`~/work/demo-app/.ddo/config.json` 首次 run 自动创建为最小默认，用户可按需扩展（可提交仓库与团队共享）：



```Plain Text
{
  "$schema": "https://ddo-code-flow/config.schema.json#/$defs/projectConfig",
  "worktreeDir": "~/work",                      // worktree 目标目录；不设时默认项目父目录（worktree 与项目同级）
  "contextPaths": ["docs/architecture.md"],
  "atomTaskOverrides": {
    "review": { "enabled": true },
    "coding": { "model": "sonnet" }
  },
  "metrics": { "enabled": true, "provider": "tokscale", "failurePolicy": "warn",
               "report": { "enabled": true, "path": "metrics-report.md" },
               "pricing": { "model": "", "inputPerMillionUsd": 0, "outputPerMillionUsd": 0 } }
}
```



配置合成优先级：run 参数 \> 本文件 \> 全局默认；仅运行期内存合成，不物化、不产生每 run 一份的副本——项目只维护这一份 config\.json。



**worktree 位置按使用习惯切换**：`worktreeDir` 指向哪个目录，所有 run 的 worktree 就创建在哪里（如项目父目录、用户级目录）；产物与状态始终随 worktree。



## 10\. worktree 落点：默认项目同级，可配置



默认（不设 `worktreeDir`）worktree 创建在**项目父目录**（与项目同级），即 §1 布局。把 `worktreeDir` 指向任意目录即可切换落点（如用户级 `~/.ddo/runs`、完全自定义路径）。**无论 worktree 放哪，产物合并后都进项目 ****`.ddo/runs/<type>/<date>/`**（见 §11）。



**默认配置**（`~/work/demo-app/.ddo/config.json`，省略 worktreeDir）：



```Plain Text
{
  "$schema": "https://ddo-code-flow/config.schema.json#/$defs/projectConfig"
  // worktreeDir 省略 → worktree 创建在项目父目录（与项目同级）
}
```



**落点对比**（产物最终都进项目 `.ddo/runs/<type>/<date>/`，落点只影响瞬态 worktree 在哪）：



||默认（项目同级）|自定义 worktreeDir（如用户级）|
|---|---|---|
|瞬态 worktree|`<项目父目录>/<projectName>-<branch>/`|`<worktreeDir>/<projectName>-<branch>/`|
|配置|省略 worktreeDir|`worktreeDir: <目标目录>`|
|适用习惯|经典兄弟 worktree、对项目侵入低|跨项目集中存放 / 自定义路径|



## 11\. 产物到底放在哪



产物归属**项目级 ****`.ddo/runs/<type>/<dateDescription>/`**，两个阶段处于两个位置：



|阶段|位置|说明|
|---|---|---|
|运行期|worktree 内 `.ddo/runs/<type>/<dateDescription>/`|产物随分支提交，这是「产物可追溯、随代码合并」的基础|
|合并后|项目级 `.ddo/runs/<type>/<dateDescription>/`|分支合并后的最终归属，进入项目 git 历史|



因此项目 `.ddo/` 聚合了 ddo 的「配置 \+ 全部 run 产物」：`config.json` \+ `runs/`（若干 `<type>/<dateDescription>/`）；`docs/` 目录不再被 ddo 占用，`.ddo/runs/` 里也**只有产物**、没有 worktree/src。



关于「`.ddo` 结构看起来复杂」：把 worktree 默认放项目同级、`.ddo/runs/` 只存产物后，项目内 `.ddo/` 就是「config \+ 产物」的清爽结构，复杂感消失。worktree 落点（默认项目同级或自定义，见 §10）只影响瞬态 worktree 在哪，不改变产物最终归属。



## 12\. 与 v2 旧行为的差异速览



|维度|v2（旧 show\_case）|v4（本文档）|
|---|---|---|
|配置位置|skill 内 config\.json 承载一切|项目只维护一份 \.ddo/config\.json（自动创建）；全局默认仅作模板/缺省回退；仅内存合成|
|run 目录（worktree）|项目父目录 worktree|默认项目同级；\.ddo/runs/ 只存产物；worktreeDir 指向任意目录即切换|
|config\.json 可见性|藏在 skill 内|项目内 \.ddo/config\.json，可见可编辑可共享|
|git 管理|——|完全交还用户 \.gitignore，skill 不参与|
|任务间数据流|下游 io 点名上游文件路径|角色声明 \+ 黑板登记 \+ runtime 注入|
|skill 目录|运行期被迁移逻辑/Studio 写入|运行期严格只读|
|断链暴露时机|运行期（孤儿输入）|编排期校验拒绝启动|
|新增 workflow|需改 schema 枚举/任务 stage 字段|只写 workflow JSON，任务定义不动|



---



> 本文档为 v4 当前执行示例；文中路径均为示例值。角色清单以 `atom-tasks/artifacts.json` 为准，状态字段以 `state.schema.json` 为准。
> 
> 

