# Spec

# 原子化解耦与职责收敛 Spec



> 本文档用于确认 agent 是否正确理解用户关于「atom\-task 完全解耦、pipeline 作为唯一集成方式、职责划分清晰化、\.claude 仓库编码规则防回归」的需求。
> 
> 



---



## 对齐摘要



- 用户目标：atom\-task 之间完全解耦、各自独立只负责自身部分；pipeline 作为 atom\-task 的唯一集成方式；各层职责清晰；通过 \.claude 仓库编码规则保证职责混乱不再发生。

- 期望交付：v4 解耦契约（产物角色声明 \+ 黑板式上下文注入）及全部现有定义的迁移、一套可被 agent 会话引用的仓库编码规则。

- 关键边界：只重构契约层与职责归属，不重写任务业务指令；不引入任何自研执行器。

- 当前确认状态：revision 8——已写回决策「worktree 默认与项目同级、\.ddo/runs/ 只存产物」「单一 \.ddo/config\.json、仅内存合成」「产物归属项目级 \.ddo/runs/\<type\>/\<date\>/」「最小调用参数集：\-\-model 选流水线、\-\-feature/\-\-bugfix 标识需求/bug」「取消动态配置参数」「issue 全自治与 headless 另立文档延后」；无阻塞问题，待用户确认。

---



## 用户目标



- atom\-task 之间完全解耦，每个任务独立，只负责自己的部分。

- pipeline 作为 atom\-task 的集成方式。

- 做好职责划分，每个部分只负责它们自己的内容。

- 在 \.claude 中设计仓库编码规则，保证后续不再出现职责混乱。

- 上下文依赖反转：每个原子任务只明确产出哪些内容，下游任务被动接受整理好的输入，而不是主动去拿上游的具体产物。

- 本次需求本身按项目现有原子任务的产物规范交付（spec / plan），验证原子化后原子任务可单独使用。

- skill 后续放入设备全局 skill 库：skill 位置、产出与运行状态位置、项目位置完全解耦，降低 skill 对项目的侵入。

---



## 范围与非目标



### In Scope



- 重新设计 v4 atom\-task 定义契约：产物角色声明、消费角色声明、移除 stage 归属、移除路径化 io 声明、任务不再读取全局配置。

- 新增产物角色目录与运行时黑板机制：上游完成即登记产物角色，运行时按下游声明匹配并注入。

- pipeline 层简化：节点级输入输出覆写移除，确认门归属收敛到 pipeline 单一定义。

- 全量迁移：现有 16 个 atom\-task、4 个 pipeline、2 个 schema、契约测试。

- \.claude 仓库编码规则：层职责矩阵、禁止事项清单、新增任务/编排的自查清单，并可被 agent 会话引用。

- 修复审计发现的 issue\-driven 数据链断裂（详见 FR\-MIG\-2）。

- 文档对齐：README、SKILL\.md、metrics 文档与 v4 一致；版本号体系统一解释。

- Studio 最小止血：保证打开并保存 v3 配置时不写坏配置。

- 部署模型：单一项目配置 \.ddo/config\.json（仅内存合成、不物化副本）、worktree 单一 worktreeDir 目标目录可配置（默认与项目同级）、\.ddo/ 首次 run 自动创建（config \+ runs，runs 只存产物）、状态文件可移植化、git 可见性交还用户、续跑时 skill 位置动态再解析。

### Non\-goals



- 不重写 atom\-task 的业务指令内容（只移除跨层重复与点名引用，业务表述保留）。

- 不引入自研执行器或后台进程，保持指令型 runtime。

- 不做 Studio UI 的 v4 功能支持（taskRef 可视化、workflow 级确认门编辑等）。

- 不改动 Metrics Runtime Plugin 机制。

- 不新增 atom\-task 或 pipeline。

- 不重建 eval 体系；show\_case 仅标注为 v2 存档，不重写。

- 不做任何向后兼容或双轨过渡设计：运行中的实例由各自 run 目录的 \.state\.json 驱动，契约更新对其无影响。

---



## 需求对齐



|ID|Agent 对需求的理解|来源|成功结果|
|---|---|---|---|
|FR\-ATOM\-1|atom\-task 定义只声明自身能力：产出哪些产物角色、消费哪些产物角色、可调参数、被否决时的行为；不包含 stage 归属、其他任务名称、产物文件路径。|用户原始要求|AC\-1、AC\-2|
|FR\-ATOM\-2|上下文依赖反转：上游任务完成后向运行时黑板登记产物角色；下游任务只声明需要的产物角色，由运行时匹配并注入实际路径；下游不明确去拿上游的具体文件。|用户原始要求|AC\-1、AC\-4|
|FR\-PIPE\-1|pipeline 是 atom\-task 的唯一集成方式：执行顺序、确认门、节点参数只定义在 pipeline 中；atom\-task 定义不感知自己属于哪个 pipeline。|用户原始要求|AC\-2|
|FR\-RESP\-1|四层职责划分：atom\-task 只描述业务、pipeline 只描述编排、config\.json 只承载全局配置与覆写、runtime（SKILL\.md）只承载执行机制；同一机制全仓库只描述一处。|用户原始要求|AC\-5|
|FR\-RULE\-1|\.claude 中新增仓库编码规则：层职责矩阵、禁止事项清单、新增 atom\-task / pipeline 的自查清单，可被 agent 会话引用。|用户原始要求|AC\-6|
|FR\-RULE\-2|编码规则中可机械校验的条目落成契约测试，违反即自动失败，保证职责混乱不依赖人工自觉。|agent 解释|AC\-3、AC\-6|
|FR\-MIG\-1|现有 16 个 atom\-task、4 个 pipeline、2 个 schema 与契约测试全部迁移到 v4 契约，测试全绿。|项目事实|AC\-3|
|FR\-MIG\-2|修复审计发现的 issue\-driven 断链：issue 正文流入 spec、跨仓库参数正确传递、远端门不与本地门双重确认、远端门消费真实阶段产物。|项目事实|AC\-4|
|FR\-DOC\-1|README、SKILL\.md、metrics 文档与 v4 现实一致：无结构误描、无断链、版本号体系有统一解释。|项目事实|AC\-7|
|FR\-META\-1|本次需求的 spec 与 plan 按项目原子任务产物规范生成并落盘到指定报告目录。|用户原始要求|AC\-8|
|FR\-DEPLOY\-1|三地解耦与全局只读：skill 目录是只读程序体，任何 run 运行期不向其写入；项目以 \.ddo/ 工作区承载 ddo 配置与 run；run 状态与产物自包含于 worktree，位置可配置。|用户原始要求|AC\-9|
|FR\-DEPLOY\-2|配置单一来源：项目只维护一份 \.ddo/config\.json；全局默认（skill 内）仅作初始模板与缺省回退；运行期按「全局默认 ← \.ddo/config\.json ← run 参数」在内存合成，不物化落盘、不产生每 run 一份的配置副本；全局 skill 不再保存每项目可变配置。|用户原始要求|AC\-9|
|FR\-DEPLOY\-3|worktree（run 目录）位置可配置：以单一 worktreeDir 字段指定目标目录，所有 run 的 worktree 都在其下创建；默认为项目父目录（worktree 与项目同级）；单个 run 的全部变更都在其对应 worktree 内；产物随分支合并后归属项目级 \.ddo/runs/\<type\>/\<dateDescription\>/（不放 docs/），\.ddo/runs/ 只存产物信息、不承载 worktree/src。|用户修订|AC\-10|
|FR\-DEPLOY\-4|git 可见性交还用户：\.ddo/ 跟随项目提交入库，其中哪些内容入库由用户通过 \.gitignore 自定义；skill 不参与 git 可见性管理，不写 \.gitignore 或 git exclude。|用户修订|AC\-10|
|FR\-DEPLOY\-5|状态可移植与续跑解析：状态文件只保留最小绝对锚点与 skill 身份（名称/版本），其余引用相对化；续跑优先按名称重新解析 skill 位置，版本不匹配时告警。|agent 解释|AC\-11|
|FR\-DEPLOY\-6|自动引导：首次 run 时 skill 在项目自动创建 \.ddo/（含最小可用的 \.ddo/config\.json），使配置位置可见、可编辑。|用户修订|AC\-10|
|FR\-DEPLOY\-7|调用参数（最小集）：`--model <workflow-id>` 显式选择流水线；`--feature` / `--bugfix` 为无值布尔标志，分别标识输入为需求（run 类型 feat）或 bug（run 类型 fix），run 类型决定分支前缀与产物 `<type>` 目录；未指定时回退选择规则自动匹配与默认 run 类型。参数保持精简，当前不引入其他调用参数；配置统一归 config\.json。|用户修订|AC\-12|



---



## 约束与保留术语



- 保留用户术语：atom\-task、pipeline、确认门、远端确认门、产物、worktree、指令型 runtime。

- 项目事实约束：运行时保持指令型——agent 即引擎，无自研执行器、无后台进程。

- 项目事实约束：产物为 git 可跟踪的 MD/JSON；路径协议 skill:// 与 run:// 归运行时独占。

- 用户明确约束：仓库编码规则必须放在 \.claude 中。

- 用户明确约束：本次 spec / plan 的输出格式遵循项目现有原子任务的产物规范。

- 用户明确约束：本项目无需考虑兼容性问题——运行中的实例均由各自 run 目录内的 \.state\.json 驱动，契约更新对已有运行无影响，据此不保留任何兼容层。

- 用户明确决策：worktree 创建位置以单一 worktreeDir 目标目录字段配置，默认项目父目录（worktree 与项目同级），指向任意目录即切换落点。

- 用户明确决策：项目只维护一份 \.ddo/config\.json；配置仅运行期内存合成，不物化 \.effective\-config\.json 之类的每 run 副本。

- 用户明确决策：产物归属项目级 \.ddo/runs/\<type\>/\<dateDescription\>/（不放 docs/）；\.ddo/runs/ 只存产物信息、不装 worktree/src；\.ddo/ 聚合配置与全部 run 产物，docs/ 不再被 ddo 占用。

- 用户明确决策：\.ddo/ 跟随项目提交入库，入库范围由用户以 \.gitignore 自定义；skill 不参与 git 可见性管理。

- 用户明确决策：项目级配置文件位于项目根 \.ddo/config\.json；首次 run 由 skill 自动创建 \.ddo/（含 config\.json）。

- 用户明确决策：调用参数仅提供最小集——`--model` 显式选流水线、`--feature` / `--bugfix` 标识需求/bug 的 run 类型；不引入其他调用参数。

- 用户明确决策：不引入动态调用配置参数（原 REQ\-B 取消）；repo 对应 GitHub 可经命令查询，所有配置统一抽象到 config\.json。

- 用户明确决策：issue 流水线全自治（免手动输需求、label 驱动）与 headless 设备挂载（免手动 bash 确认、纯 issue 交互）另立文档，在本次解耦改造之后实施，不纳入本 spec/plan。

---



## 解释与假设



|类型|内容|依据或原因|若错误的影响|
|---|---|---|---|
|Interpretation|「上游通知下游需要接受哪些产物」落地为黑板登记 \+ 运行时匹配注入，而非在 pipeline 连线上显式携带产物载荷。|用户原始要求的最小等价解释；与现有「文件系统 \+ \.state\.json 即状态机」哲学一致。|若用户要求连线显式载荷，pipeline 结构与 schema 需改为边携带数据。|
|Assumption|v4 一次性切换：旧 io 声明与新角色声明不做长期双轨共存。|用户已明确无需考虑兼容性（见约束）；契约层已破裂，双轨会延长不一致。|若需两阶段过渡，需追加兼容层与迁移脚本工作。|
|Assumption|Studio UI 本次只做「不写坏配置」止血，v4 功能支持不在范围。|用户变更清单未提及 UI。|若 UI 需同步支持 v4，范围与工作量扩大。|
|Interpretation|确认门归属收敛到 pipeline 单一来源：任务定义不再声明是否需要确认，只声明被否决后的行为。|FR\-RESP\-1 职责划分的直接推论。|若任务需保留默认门声明，pipeline 需增加覆写语义。|



---



## 对齐变化摘要



|变更类型|ID|修改前|修改后|依据|
|---|---|---|---|---|
|新增|约束|（无）|本项目无需考虑兼容性问题：运行中的实例由各自 run 目录内的 \.state\.json 驱动，契约更新对已有运行无影响|用户修订（rev2）|
|新增|Non\-goals 条目|（无）|不做任何向后兼容或双轨过渡设计|用户修订（rev2）|
|修改|假设（一次性切换）|依据为「用户未反对；契约层已破裂」|依据强化为「用户已明确无需考虑兼容性」|用户修订（rev2）|
|新增|FR\-DEPLOY\-1\~5|（无）|三地解耦与全局只读、配置三层合并、run 层默认外置、状态默认不入库、状态可移植与续跑再解析|用户修订（rev3）|
|新增|AC\-9\~11|（无）|全局 skill 只读且多项目互扰、默认零侵入且状态不入库、skill 搬家后续跑可用|用户修订（rev3）|
|新增|约束 ×3|（无）|run 层默认外置到用户级目录；\.state\.json 默认不入库；项目级配置位于项目根 \.ddo/config\.json|用户修订（rev3）|
|修改|FR\-DEPLOY\-3 / FR\-DEPLOY\-4 / AC\-10|run 层默认外置到用户级目录；\.state\.json 默认不入库|worktree 位置可配置（默认项目内 \.ddo/runs/）；\.ddo/ 随项目入库、范围由用户 \.gitignore 决定；skill 不管 git 可见性|用户修订（rev4）|
|新增|FR\-DEPLOY\-6 / 约束|（无）|首次 run 自动创建 \.ddo/（含 config\.json），使配置位置可见可编辑|用户修订（rev4）|
|修改|FR\-DEPLOY\-3 / PD\-6|worktreeLocation 枚举 \+ worktreeDir 模板|收敛为单一 worktreeDir 目标目录字段（默认 \.ddo/runs）|用户修订（rev5）|
|修改|FR\-DEPLOY\-2 / PD\-7 / AC\-10|三层合并物化 \.effective\-config\.json|项目只维护一份 \.ddo/config\.json；仅内存合成，不物化副本|用户修订（rev5）|
|修改|FR\-DEPLOY\-3|产物未明确归属（沿用 docs/）|产物随分支合并后归属项目级 \.ddo/\<type\>/\<date\>/；docs/ 不再被 ddo 占用|用户修订（rev6）|
|修改|FR\-DEPLOY\-3 / AC\-10|worktree 默认项目内 \.ddo/runs/；产物归 \.ddo/\<type\>/\<date\>/|worktree 默认项目父目录（与项目同级）；产物归 \.ddo/runs/\<type\>/\<date\>/，runs 只存产物不装 worktree/src|用户修订（rev7）|
|新增|FR\-DEPLOY\-7 / AC\-12|（无调用参数约定）|最小调用参数集：\-\-model 选流水线、\-\-feature/\-\-bugfix 标识需求/bug run 类型|用户修订（rev8）|
|取消|（REQ\-B 动态配置参数）|曾考虑按服务动态配置参数|取消：repo 信息可命令查询，无需动态参数；配置统一归 config\.json|用户修订（rev8）|
|延后|（REQ\-C issue 全自治 / REQ\-D headless）|——|另立文档，在本次解耦改造之后实施，不纳入本 spec/plan|用户修订（rev8）|



---



## 留给 Planning



- **PD\-1**：黑板匹配（推荐）还是 pipeline 边携带产物——实现方式选择，不改变 What/Why。

- **PD\-2**：产物角色目录的载体形态（独立目录文件 \+ 元 schema，或内嵌于现有 schema）。

- **PD\-3**：v4 frontmatter 字段命名（produces/consumes 或带角色的 io）。

- **PD\-4**：四套版本号（skill / config / pipeline / task）的统一与解释口径。

- **PD\-5**：运行时注入在任务正文中的引用语法（如 \{\{inputs\.\<role\>\}\}）。

- **PD\-6**：worktreeDir 目标目录的缺省值与冲突后缀规则（已定：缺省项目父目录/worktree 与项目同级，冲突 \-2）。

- **PD\-7**：Metrics 插件等外部消费方的配置读取方式（读项目 \.ddo/config\.json 或由 runtime 传入内存合成值，不物化）。

---



## 成功结果



|ID|用户可观察的结果|Validates|来源|
|---|---|---|---|
|AC\-1|任一 atom\-task 定义文件中检索不到其他 atom\-task 的名称，也没有具体产物路径；契约校验通过。|FR\-ATOM\-1、FR\-ATOM\-2|用户原始要求|
|AC\-2|用现有 atom\-task 集合组装一个新的 pipeline（不同顺序），不修改任何任务定义即通过校验并可执行。|FR\-ATOM\-1、FR\-PIPE\-1|用户原始要求|
|AC\-3|pytest 契约测试全部通过；全部任务定义通过 v4 schema 校验。|FR\-MIG\-1、FR\-RULE\-2|项目事实|
|AC\-4|issue\-driven 重放：issue 正文可被 spec 生成使用；\-\-repo 作用于正确仓库；远端门通过后无重复本地确认；远端门消费当前阶段真实产物。|FR\-ATOM\-2、FR\-MIG\-2|项目事实|
|AC\-5|延迟写入、状态字段管理等机制描述全仓库只出现在运行时文档一处；任务正文与 pipeline 描述不再复述。|FR\-RESP\-1|用户原始要求|
|AC\-6|\.claude 编码规则文件存在且可被会话引用；故意构造违反解耦的任务定义（如引用其他任务名）时契约测试报错。|FR\-RULE\-1、FR\-RULE\-2|用户原始要求|
|AC\-7|README 配置说明与实际配置结构一致；metrics 文档存在且全仓库无断链；版本号有统一解释。|FR\-DOC\-1|项目事实|
|AC\-8|本次 spec\.md / plan\.md 按原子任务产物规范生成，结构通过对应产物规范核对。|FR\-META\-1|用户原始要求|
|AC\-9|两个项目使用同一全局 skill，各自的项目级配置互不干扰；一次 run 前后 skill 目录内容无任何变化。|FR\-DEPLOY\-1、FR\-DEPLOY\-2|用户原始要求|
|AC\-10|默认设置下完成一次 run：worktree 创建在项目同级；项目内新增 \.ddo/ 工作区（唯一一份 config\.json \+ runs/ 只存产物，无 worktree/src、无配置副本）；worktreeDir 指向任意目录即切换 worktree 落点；skill 不写 \.gitignore 或 git exclude，\.ddo/ 入库范围由用户控制。|FR\-DEPLOY\-2、FR\-DEPLOY\-3、FR\-DEPLOY\-4、FR\-DEPLOY\-6|用户修订|
|AC\-11|skill 目录被移动或升级后，旧 run 续跑成功；skill 版本与状态记录不一致时有明确告警。|FR\-DEPLOY\-5|agent 解释|
|AC\-12|`--model <workflow-id>` 使 run 以指定流水线执行；`--feature` / `--bugfix` 分别产生 feat / fix 的 run 类型（体现在分支前缀与产物 `<type>` 目录）；二者均未指定时回退自动匹配选择与默认类型。|FR\-DEPLOY\-7|用户修订|



---



## 用户确认



若不存在未解决 BQ，请确认以下任一选项：



- ✅ **同意**：批准当前 spec，进入 **Planning**。

- ❌ **修改：\<反馈\>**：修改当前 spec，展示对齐变化摘要后重新确认。

- ❓ **提问：\<问题\>**：仅回答问题，不修改 spec、revision、确认状态或修订历史；答复后询问是否需要转为 `修改`。

