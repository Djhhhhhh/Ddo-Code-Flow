# Part 03 — 接口契约、算法设计与文件变更计划

# Part 03 — 接口契约、算法设计与文件变更计划



> 隶属《Ddo\-Code\-Flow 技术 Plan》revision 7；本册覆盖：API 接口设计（契约边界）、算法设计、文件变更计划。
> 
> 



---



## API 接口设计



本项目无 HTTP 接口；「接口」为层与层之间的契约边界。



|接口/入口|请求|响应|错误与幂等|复用标准|实现职责|AI 索引|
|---|---|---|---|---|---|---|
|任务定义契约|atom\-tasks/\\\<n\\\>/\\\<n\\\>\.md frontmatter|校验通过 / 字段级错误|schema 校验幂等；错误报字段路径|atom\-task\-md\.schema\.json v4|\_schema \+ tests|FR\-ATOM\-1|
|产物目录契约|atom\-tasks/artifacts\.json|角色清单 / 未知角色报错|只读、幂等|artifact\-catalog\.schema\.json|\_schema \+ runtime 校验|FR\-ATOM\-2|
|项目级配置契约|项目根 \.ddo/config\.json|schema 校验结果 / 运行期内存合成输入|校验失败报字段级错误；读取幂等|$defs/projectConfig|runtime 内存合成（不物化）|FR\-DEPLOY\-2|
|黑板登记|runtime 于节点交付后写 \.state\.json\.artifacts|role→path 条目|写失败 → node\-failed；覆盖幂等（I3）|SKILL\.md 执行循环|runtime|FR\-ATOM\-2|
|注入接口|runtime 进入节点时按 consumes 解析|\{\{inputs\.\\\<role\\\>\}\} 绑定列表|required 缺失 → node\-failed 中止；optional 缺失 → 跳过记录|SKILL\.md 执行循环|runtime|FR\-ATOM\-2|
|pipeline 节点契约|workflow 节点 taskRef / options|有效参数合并结果|覆盖优先级：workflow 级 \> config 级 \> 任务默认|$defs/workflowDefinition|runtime|FR\-PIPE\-1|
|确认门接口|workflow confirmationGates|本地 / 远端门触发|远端门覆盖的 stage 不再弹本地门（I5）|SKILL\.md Step 3\.3|runtime|FR\-MIG\-2|
|续跑再解析|state skillName/skillVersion \+ hint|解析后的 skillRoot|均失败 → 中止报错；版本不匹配 → 告警|runtime|runtime|FR\-DEPLOY\-5|



---



## 算法设计



**编排期角色可达性校验**（校验期新增）：输入为 workflow JSON \+ 各任务 produces/consumes \+ 目录。对每个 stage 的 DAG 做 Kahn 拓扑遍历，维护可产出角色集 S（初始为空）；节点 N 出队前先检查其全部 required consume ∈ S，缺失即报「角色 X 无上游生产者（消费方 N，stage Y）」，通过后将 N\.produces 并入 S；跨 stage 边按 stage 顺序衔接。复杂度 O\(V\+E\)。该检查使孤儿输入类断链在校验期暴露。



**运行时注入**（执行期新增）：进入节点时对每个 consume 解析：动态角色（如 stage\-artifact）→ 解析为当前 stage 已登记的主产物；普通角色 → 查 manifest；命中 → 注入 \(role, path\) 绑定；缺失且 required → 记 node\-failed 中止；缺失且 optional → 跳过并记 history。绑定在正文中替换 `{{inputs.<role>}}`。



**交付登记**（执行期新增）：节点产物写盘（或进入 pendingOutputs）后，将 role→path 登记进 manifest 再放行下一节点。登记同样延迟写入，worktreePath 建立后随 pending 输出一起刷写。



**配置合成**（启动期新增）：读取全局默认 → 深合并 \.ddo/config\.json（对象递归、数组覆盖、标量覆盖）→ 覆盖 run 参数；结果仅保存于 runtime 内存，作为后续校验与执行的配置输入，**不物化落盘、不产生每 run 一份的副本**。合并为纯函数，可测试。



**续跑再解析**（恢复期新增）：读 state\.skillName → 与当前会话已加载 skill 匹配：命中且版本一致 → 直接使用；版本不一致 → 告警并继续；未命中 → 尝试 hint 路径校验；均失败 → 中止并明确报错。configPath/workflowPath 按相对引用还原。



**worktree 位置解析**（执行期新增）：读有效配置 worktreeDir（缺省为项目父目录，即 worktree 与项目同级），在 `<worktreeDir>/<projectName>-<branchName>` 创建 worktree；冲突追加 \-2/\-3 规则统一。



**\.ddo/ 引导创建**（启动期新增，幂等）：run 启动时检查项目 \.ddo/；不存在则创建 `.ddo/config.json`（按 $defs/projectConfig 写最小默认）与 `.ddo/runs/`；已存在则不覆盖用户配置（FR\-DEPLOY\-6）。



---



## 文件变更计划



|文件/目录|变更职责|复用或依赖|AI 索引|
|---|---|---|---|
|atom\-tasks/\_schema/atom\-task\-md\.schema\.json|重写为 v4：produces/consumes；删 stage/io；options 扩容；confirmation 仅 rejectAction|无|FR\-ATOM\-1|
|atom\-tasks/\_schema/artifact\-catalog\.schema\.json|新增目录元 schema|无|FR\-ATOM\-2|
|atom\-tasks/artifacts\.json|新增产物角色目录（约 18 角色：requirement/spec/plan/test\-plan/task\-group/code\-change/verification\-log/review\-report/execution\-report/reflection\-report/context\-summary/issue\-context/gate\-result/delivery\-doc/pr\-info/worktree\-info/stage\-artifact 等）|目录元 schema|FR\-ATOM\-2|
|atom\-tasks/\*/\*\.md ×16|frontmatter v4 迁移；正文删除对其他任务点名与机制复述；输入统一 \{\{inputs\.\\\<role\\\>\}\}|v4 schema \+ 目录|FR\-ATOM\-1、FR\-MIG\-1|
|workflows/issue\-driven\.json|删节点级 io 覆盖；remote\-gate stage 豁免本地门（I5）；核对 issue\-context 可达|v4 任务|FR\-MIG\-2|
|workflows/standard/guarded/lightweight\.json|删节点 io 字段；保留 taskRef/options/gates|v4 任务|FR\-PIPE\-1|
|config\.json → config\.default\.json|更名并收敛为全局只读默认；移除项目级字段语义|无|FR\-DEPLOY\-2|
|config\.schema\.json|删死 $defs/stageEnum；workflowDefinition 节点删 io；顶层 oneOf 简化为仅 workflows；新增 $defs/projectConfig（含 worktreeDir）；options pattern 对齐|无|FR\-ATOM\-1、FR\-DEPLOY\-2|
|SKILL\.md|重写执行循环（可达性校验、注入、交付登记）；新增配置内存合成（不物化）、续跑再解析、状态锚点重构；产物路径约定 docs/ → \.ddo/；删 Step 1\.3 迁移；业务段落移回 atom\-task 仅留指针；修复重复步骤/键/§4\.1 引用|v4 契约|FR\-RESP\-1、FR\-MIG\-2、FR\-DEPLOY\-2、FR\-DEPLOY\-5|
|atom\-tasks/git\-worktree/git\-worktree\.md|worktree 位置解析（worktreeDir 目标目录，默认项目父目录/与项目同级）；首次 run 引导创建 \.ddo/config\.json；状态锚点刷写；不写 git exclude（git 交还用户）|worktreeDir|FR\-DEPLOY\-3、FR\-DEPLOY\-4、FR\-DEPLOY\-6|
|tests/test\_workflow\_contracts\.py|v4 重写：frontmatter 校验、taskRef 解析、角色可达性正反用例、解耦断言、配置合并用例、全局只读断言|v4 schema|FR\-RULE\-2|
|\.claude/rules/\*\.md \+ CLAUDE\.md|新增仓库编码规则：四层职责矩阵、禁止事项、新增任务/workflow 自查清单、三地解耦约束；CLAUDE\.md @import 引用|无|FR\-RULE\-1|
|README\.md|v4 配置说明与部署模型章节；三层配置模板；\.ddo/ 结构与 \.gitignore 建议；16 任务与 per\-workflow stage 数更正；产物树引目录；版本体系说明|目录|FR\-DOC\-1|
|docs/metrics\.md|新增，修复 5 处断链；说明插件读项目 \.ddo/config\.json（或由 runtime 传入合成配置）|scripts/metrics|FR\-DOC\-1|
|ui/studio\.js|止血：normalizeConfig 不再注入 pipeline / base\.confirmationGates；读写目标改为 config\.default\.json|无|FR\-DOC\-1|
|LINCES、image\.png、ui/app\.js|删除；README 许可证链接改指 LICENSE|无|FR\-DOC\-1|
|show\_case\.md|文首标注「v2 存档，与当前实现不符」|无|FR\-DOC\-1|



