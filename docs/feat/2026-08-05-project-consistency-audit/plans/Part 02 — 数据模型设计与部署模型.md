# Part 02 — 数据模型设计与部署模型

# Part 02 — 数据模型设计与部署模型



> 隶属《Ddo\-Code\-Flow 技术 Plan》revision 7；本册覆盖：数据模型设计（实体、schema、不变量、迁移回滚）与三地解耦部署模型。
> 
> 



---



## 数据模型设计



### 实体与字段



**v4 atom\-task frontmatter**（atom\-task\-md\.schema\.json v4）



|字段|类型|必填|说明|
|---|---|---|---|
|name / version / enabled|string / semver / bool|是|不变|
|produces|array|是|`[{role, kind}]`；role 必须存在于目录；kind ∈ markdown/json/text/code/dir|
|consumes|array|否|`[{role, required}]`；默认 required=false|
|options|array|否|key/type/default/label/description；type enum 扩为 boolean/string/number/integer/array；key 采用 camelCase|
|confirmation|object|是|仅保留 rejectAction ∈ regenerate\-with\-feedback/abort/skip；删除 required|
|concurrency / timeoutSec / outputSchemaRef|—|—|不变|
|删除字段|—|—|stage、io、confirmation\.required|



**产物目录**（atom\-tasks/artifacts\.json）



|字段|类型|说明|
|---|---|---|
|roles\.\\\<role\\\>\.file|string / null|规范文件名（如 spec\.md）；动态角色为 null|
|roles\.\\\<role\\\>\.dynamic|boolean|运行时按上下文解析（如 stage\-artifact 解析为当前阶段主产物）|
|roles\.\\\<role\\\>\.description|string|角色说明|



**黑板清单**（\.state\.json\.artifacts）



|字段|类型|说明|
|---|---|---|
|\\\<role\\\>\.path|string|run:// 路径|
|\\\<role\\\>\.producer|string|产出节点名|
|\\\<role\\\>\.stage|string|产出时所在 stage|
|\\\<role\\\>\.at|ISO 8601|登记时间|



**项目级配置**（项目根 \.ddo/config\.json，项目维护的唯一配置；首次 run 由 skill 自动创建）



|字段|类型|说明|
|---|---|---|
|worktreeDir|string（可选）|worktree 目标目录；所有 run 的 worktree 都在其下创建：`<worktreeDir>/<projectName>-<branchName>`；不设时默认项目父目录（worktree 与项目同级）|
|contextPaths / atomTaskOverrides / metrics / respGenerator / branchRules|同全局结构|按键覆盖全局默认|



**状态锚点模型**（\.state\.json v4）



|字段|形态|说明|
|---|---|---|
|projectRoot / worktreePath|绝对锚点（仅这两个）|续跑定位|
|skillName / skillVersion|身份标识|续跑再解析与版本告警|
|skillRoot|hint（仅校验用）|不作唯一依据|
|configPath / workflowPath|相对引用|相对 projectRoot（\.ddo/config\.json）/ 相对 skillRoot（workflows/x\.json）|
|artifacts|run://（相对 worktree）|黑板清单|



### schema 与 DDL



atom\-task\-md\.schema\.json v4 核心变更（draft 2020\-12）：`produces.items = {role: pattern ^[a-z][a-z0-9-]*$, kind: enum}`；`consumes.items = {role, required}`；`options.key` pattern 改 camelCase；`options.type` enum 扩为 boolean/string/number/integer/array；`confirmation.required = ["rejectAction"]`；删除 `stage`、`io` 与 stageEnum。新增 artifact\-catalog\.schema\.json 元 schema。config\.schema\.json：删除死定义 `$defs/stageEnum`；顶层 oneOf 简化为仅 workflows；`$defs/workflowDefinition` 节点删除 io；新增 `$defs/projectConfig`（项目级配置字段，含 worktreeDir，additionalProperties:false）。skill 内 `config.json` 更名 `config.default.json`（语义：全局只读默认值 / 首次创建 \.ddo/config\.json 的初始模板）。



### 状态与不变量



- I1：role 全目录唯一；produces/consumes 引用的 role 必须存在，否则编排校验失败。

- I2：任一 workflow 中，节点 required consume 的角色必须在 DAG 上游可达处被 produce；校验期拒绝。

- I3：同一 run 内同一 role 单一生产者；返工重生成覆盖清单条目并记 history。

- I4：任务正文经 `{{inputs.<role>}}` 引用输入（DEC\-5）；正文出现其他任务名或直接产物路径判违规（测试强制）。

- I5：确认门唯一真相源 = workflow confirmationGates；含 remote\-gate 节点的 stage 豁免本地门。

- I6：任务不读 config；所需全局参数由 runtime 以 node options 注入。

- I7：skillRoot 运行期只读——流水线运行期间不向 skill 目录写任何文件；Studio 编辑属运行期之外的设计时行为。

- I8：配置合并优先级 run 参数 \> \.ddo/config\.json \> 全局默认；对象递归合并、数组整体覆盖；合并仅在 runtime 内存中进行，**不物化落盘、不产生每 run 一份的配置副本**；项目只维护 \.ddo/config\.json 一份配置。

- I9：状态可移植——\.state\.json 绝对路径仅 projectRoot 与 worktreePath 两处，其余引用为相对或 hint。

- I10：git 可见性交还用户——skill 不写 \.gitignore、不写 git exclude；\.ddo/ 随项目入库，入库范围由用户以 \.gitignore 自定义；状态文件经锚点相对化（I9）即便入库也不泄漏机器路径。

### 迁移、兼容与回滚



本项目无需考虑兼容性（用户明确）：运行中的实例均由各自 \.state\.json 驱动，契约更新无影响。一次性切换（DEC\-3）：全部变更同一变更集完成，测试全绿后合入；v2→v3 迁移逻辑删除；历史 run 产物为只读快照；run 位置默认项目内 \.ddo/ 不影响旧 run（续跑依赖 state 的 worktreePath 锚点）。回滚 = git revert 整集。



---



## 部署模型与三地解耦



### 三地职责



|位置|角色|内容|写入规则|
|---|---|---|---|
|skillRoot（全局库）|只读程序|SKILL\.md、atom\-tasks/、workflow 模板、schemas、scripts、ui、config\.default\.json、artifacts\.json|运行期不写（I7）|
|projectRoot（用户仓库）|\.ddo/ 工作区|\.ddo/config\.json \+ \.ddo/runs/\<type\>/\<date\>/（只存产物，随分支合并而来）|首次 run 自动创建 \.ddo/；随项目入库，入库范围由用户 \.gitignore 控制|
|runStore（run 层）|代码检出 \+ 运行状态|worktree（src \+ 运行期产物 \+ \.state\.json）|默认与项目同级（worktreeDir 目标目录可配置）；不入项目 \.ddo/runs/|



### 调用入口与参数（最小集）



|参数|形态|作用|
|---|---|---|
|`--model <workflow-id>`|key\-value|显式选择流水线（workflow），优先于选择规则自动匹配|
|`--feature`|无值布尔标志|标识输入为需求；run 类型 feat（决定分支前缀与产物 `<type>` 目录）|
|`--bugfix`|无值布尔标志|标识输入为 bug；run 类型 fix（同上）|



- workflow 解析优先级：`--model` 显式指定 \> 选择规则关键词自动匹配 \> 默认 workflow。

- `--feature` / `--bugfix` 互斥；均未指定时按提示词关键词推断或回落默认 run 类型。

- 参数全部写入 `.state.json.args`；当前不引入其他调用参数，也不引入动态配置参数（配置统一归 config\.json，FR\-DEPLOY\-7）。

### 配置解析（单一配置，仅内存）



- 项目维护唯一一份配置 \.ddo/config\.json；首次 run 由 skill 自动创建（以全局模板播种）；用户自管、可提交共享。

- 全局默认：skill 内 config\.default\.json——仅作初始模板与缺省字段的默认值来源，只读。

- run 参数：`--key value`，写入 state\.args，优先级最高。

- 运行期配置在内存中合成（全局默认 ← \.ddo/config\.json ← run 参数），不物化落盘、不产生每 run 一份的副本；校验与执行直接使用内存结果。

- Studio 止血边界：读写全局默认文件（设计时编辑默认值）；项目级配置手工编辑，README 提供模板。

### worktree 位置与 \.ddo/ 工作区



- 首次 run，skill 在项目自动创建 \.ddo/：`.ddo/config.json`（以全局模板播种）与 `.ddo/runs/`；使 config\.json 位置可见、可编辑（FR\-DEPLOY\-6）。

- 所有 run 的 worktree 都在目标目录 `worktreeDir` 下创建，默认为项目父目录（worktree 与项目同级），即每个 run 为 `<projectRoot>/../<projectName>-<branchName>/`；命名冲突追加 \-2（沿用现有规则）。在 config 中设置 worktreeDir 即可改为任意目录（如用户级目录、自定义路径）。

- 单个 run 的全部变更（代码 \+ 产物 \+ 状态）都在其对应 worktree 内进行；产物随分支合并入库（merge 后落在项目级 `.ddo/runs/<type>/<dateDescription>/`）。项目 `.ddo/runs/` 只存产物信息，不承载 worktree/src。

- git worktree add 可指向任意路径；对项目的唯一 git 接触是标准 worktree 元数据（\.git/worktrees/）。

### 状态可移植与续跑



- state 记 skillName\+skillVersion；skillRoot 降级为校验 hint。

- 续跑解析序：当前会话 skill 加载上下文（按名）→ hint 路径 → 均失败则中止并报错；版本不匹配告警不阻断。

- configPath/workflowPath 相对化后，即便用户将 \.state\.json 入库也不泄漏机器路径。

### git 可见性交还用户



- skill 不参与 git 可见性管理：不写 \.gitignore、不写 git exclude（DEC\-10）。

- \.ddo/ 随项目入库；其中哪些内容入库由用户以 \.gitignore 自定义（建议提交 \.ddo/config\.json 与 \.ddo/runs/ 产物，忽略运行期 \.state\.json；瞬态 worktree 在项目同级、合并后可删除——此为文档建议，非 skill 行为）。

- 审计需求由入库产物（spec/plan/report 等）与 execution\-report 承担。

