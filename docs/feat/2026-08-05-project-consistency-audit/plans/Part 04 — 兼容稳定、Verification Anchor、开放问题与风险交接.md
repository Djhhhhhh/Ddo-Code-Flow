# Part 04 — 兼容稳定、Verification Anchor、开放问题与风险交接

# Part 04 — 兼容稳定、Verification Anchor、开放问题与风险交接



> 隶属《Ddo\-Code\-Flow 技术 Plan》revision 7；本册覆盖：兼容、稳定性与回滚；Verification Anchor；开放问题与 Spec 对应；风险与下游交接。
> 
> 



---



## 兼容、稳定性与回滚



|关注点|适用性|设计/理由|回滚信号|AI 索引|
|---|---|---|---|---|
|兼容性（历史 run / 旧配置）|不适用|用户明确无需兼容：运行中实例由各自 \.state\.json 驱动，契约更新无影响|无|FR\-MIG\-1|
|一次性切换风险|适用|独立分支；测试全绿后合入；回滚 git revert 整集|pytest 红 / 校验失败|FR\-MIG\-1|
|run 位置默认项目内 \.ddo/|适用|旧 run 续跑依赖 state 的 worktreePath 锚点，不受默认值变化影响|续跑失败|FR\-DEPLOY\-3|
|全局 skill 升级|适用|state 记 skillName/skillVersion，版本不匹配告警不阻断|明显行为异常|FR\-DEPLOY\-5|
|Studio 可用性|部分|仅止血；README 明示暂不支持项目级配置与 v4 编辑|UI 写出非法配置|FR\-DOC\-1|
|skill 加载|适用|SKILL\.md 入口与 name 不变；metadata\.version 升 4\.0\.0|skill 解析失败|FR\-DOC\-1|



---



## Verification Anchor



|需验证契约|可观察结果|证据位置|AI 索引|
|---|---|---|---|
|v4 frontmatter 有效性|16 任务全部通过 jsonschema 校验|pytest 输出|FR\-MIG\-1|
|角色可达性|4 个 workflow 校验通过；缺生产者反例必被拒绝|tests 正反用例|FR\-ATOM\-2|
|解耦断言|atom\-tasks/\*\.md grep 其他任务名零命中；frontmatter 无 run:// 字面量|tests grep 断言|FR\-ATOM\-1|
|机制单一真相源|pendingOutputs 等机制关键词仅 SKILL\.md 一处|grep 输出|FR\-RESP\-1|
|issue\-driven 链路|issue 正文可被 spec 使用；远端门通过后无重复本地确认；\-\-repo 作用正确仓库|重放验证|FR\-MIG\-2|
|全局只读|一次 run 前后 skill 目录文件树校验和不变|tests / 手工|FR\-DEPLOY\-1|
|\.ddo/ 工作区|run 完成：项目内新增 \.ddo/（含 config\.json 与 runs/）；skill 不写 \.gitignore/exclude，入库范围由用户控制|重放验证|FR\-DEPLOY\-3、FR\-DEPLOY\-4、FR\-DEPLOY\-6|
|配置合成|三层 fixture 输出预期内存有效配置；运行目录无配置文件副本落盘|tests|FR\-DEPLOY\-2|
|续跑再解析|skill 目录移动后续跑成功；版本不匹配告警|重放验证|FR\-DEPLOY\-5|
|Studio 止血|config 打开\-保存前后无 pipeline/confirmationGates 注入|手工 / UI|FR\-DOC\-1|
|\.claude 规则有效性|故意构造违反解耦的定义，契约测试报错|tests|FR\-RULE\-2|



---



## 开放问题与 Spec 对应



|问题|确定答案或阻塞原因|解决位置|AI 索引|
|---|---|---|---|
|PD\-1 黑板 vs 边载荷|已定：黑板匹配|Part 01 技术选型 DEC\-1|FR\-ATOM\-2|
|PD\-2 目录载体|已定：独立 artifacts\.json \+ 元 schema|Part 01 技术选型 DEC\-2|FR\-ATOM\-2|
|PD\-3 frontmatter 命名|已定：produces/consumes（DEC\-4）|Part 02 数据模型|FR\-ATOM\-1|
|PD\-4 版本体系|已定：metadata\.version 为主版本（本次升 4\.0\.0）；config/pipeline/task version 为各自契约版本，README 说明（DEC\-7）|Part 04 兼容章节|FR\-DOC\-1|
|PD\-5 注入语法|已定：\{\{inputs\.\\\<role\\\>\}\}（DEC\-5）|Part 02 不变量 I4|FR\-ATOM\-2|
|PD\-6 worktree 位置|已定：单一 worktreeDir 目标目录字段；默认项目父目录（worktree 与项目同级），指向任意目录即切换落点，冲突 \-2|Part 02 worktree 位置|FR\-DEPLOY\-3|
|PD\-7 有效配置载体|已定：不物化——仅 runtime 内存合成；项目只维护 \.ddo/config\.json 一份配置|Part 02 配置解析 I8|FR\-DEPLOY\-2|
|项目级配置位置|已定：项目根 \.ddo/config\.json|用户修订|FR\-DEPLOY\-2|
|run 层默认位置|已定：worktree 与项目同级；\.ddo/runs/ 只存产物（不含 worktree/src）；可切换用户级/自定义|用户修订|FR\-DEPLOY\-3|
|状态入库策略|已定：git 可见性交还用户（\.gitignore），skill 不参与|用户修订|FR\-DEPLOY\-4|
|\.ddo/ 自动创建|已定：首次 run 由 skill 创建 \.ddo/（含 config\.json）|用户修订|FR\-DEPLOY\-6|
|远端门豁免|已定：含 remote\-gate 节点的 stage 不弹本地门；Step 3\.3 豁免条件扩展|Part 03 接口 I5|FR\-MIG\-2|
|options key 风格|已定：camelCase（schema pattern 与 description 同步修正）|Part 02 数据模型|FR\-ATOM\-1|



---



## 风险与下游交接



**风险与缓解**：① 改动面大（35\+ 文件）→ 独立分支内按「schema → 目录 → 任务 → workflow → SKILL\.md/tests → 部署机制 → docs/UI」分组提交，每组可独立校验；② runtime 注入隐式化、调试困难 → manifest 与注入事件记入 \.state\.json\.history，review/verification 可直接读取；③ 正文清理误删业务语义 → 只删机制复述与点名引用，业务表述原样保留，review 对照检查；④ \.ddo/runs/ 产物累积 → README 提供手动清理说明，不做自动清理；⑤ 状态与 run 入库范围交还用户 \.gitignore、skill 不参与 → 跨成员续跑依赖对方本地 worktree 与 \.state\.json（产物经仓库 \.ddo/runs/ 共享），属设计意图非缺陷。



**Tasking / Coding 读取范围**：Parts Manifest 全部四册；拆分以 Part 03 文件变更计划为准，每个任务对应 Part 04 明确的 Verification Anchor。



**事实失效处理**：编码中若发现任务的业务输入无法用目录角色表达，先在 artifacts\.json 增加角色再改任务；禁止绕过契约私加 io 引用；部署机制如遇平台差异（如用户主目录解析），在 runtime 层兜底并记录，不改任务契约。



---



## 后续演进（另立文档，本次不实施）



以下为用户明确提出、但决定在**本次解耦改造完成之后**另立 spec/plan 实施的需求，本册仅作登记，不展开设计：



- **issue 流水线全自治**（原 REQ\-C）：issue\-driven 免手动输入需求（requirement = issue body，自动从配置仓库拉取）；按 label 决策是否启动、是否拉起 coding subagent 自动开发。

- **headless 设备挂载 / 纯 issue 交互**（原 REQ\-D）：`.claude/settings.json` permissions 预放行流水线 bash 命令实现免手动确认；集成 watcher 轮询 trigger label 自动拉起 run；所有人机确认经远端门（GitHub），本地零 prompt。

另：**动态调用配置参数**（原 REQ\-B）已取消——repo 对应 GitHub 可经命令查询，无需按服务动态配置，相关配置统一抽象到 config\.json。



