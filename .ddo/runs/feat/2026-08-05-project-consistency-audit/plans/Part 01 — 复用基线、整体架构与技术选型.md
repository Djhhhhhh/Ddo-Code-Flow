# Part 01 — 复用基线、整体架构与技术选型

# Part 01 — 复用基线、整体架构与技术选型



> 隶属《Ddo\-Code\-Flow 技术 Plan》revision 7；本册覆盖：现有设计与复用基线、整体架构与流程、技术选型与方案对比。
> 
> 



---



## 现有设计与复用基线



|能力|文件路径|符号|证据类型|采用方式|适用边界|AI 索引|
|---|---|---|---|---|---|---|
|路径协议|SKILL\.md|Path resolution rules（skill://、run://）|Repository Fact|复用现有实现|路径解析仍是 runtime 独占职责|FR\-RESP\-1|
|状态机|SKILL\.md|\.state\.json / history / pendingOutputs|Repository Fact|扩展现有实现|新增 artifacts 清单；锚点模型重构|FR\-ATOM\-2、FR\-DEPLOY\-5|
|节点参数化|config\.schema\.json|$defs/workflowDefinition（taskRef/options）|Repository Fact|复用现有实现|保留节点级 options 覆盖|FR\-PIPE\-1|
|确认门|workflows/\*\.json|confirmationGates|Repository Fact|复用现有实现|门唯一真相源；含 remote\-gate 的 stage 豁免本地门|FR\-PIPE\-1、FR\-MIG\-2|
|产物格式规范|atom\-tasks/\*/\*\.output\.schema\.json|outputSchemaRef|Repository Fact|复用现有实现|与契约改造无关，不动|FR\-MIG\-1|
|契约测试基建|tests/test\_workflow\_contracts\.py|pytest \+ jsonschema|Repository Fact|扩展现有实现|新增角色可达性、解耦与部署断言|FR\-RULE\-2|
|git worktree 机制|git 原生|git worktree add（可指向任意路径）|Repository Fact|复用现有实现|worktree 位置可配置；入库范围交还用户 \.gitignore|FR\-DEPLOY\-3、FR\-DEPLOY\-4|
|v2→v3 config 迁移|SKILL\.md|Step 1\.3 auto\-migration|Repository Fact|不适用|用户明确无需兼容，迁移逻辑随 v4 删除|FR\-MIG\-1|



---



## 整体架构与流程



```Plain Text
flowchart TB
    subgraph skill["skillRoot（全局 skill 库 · 只读）"]
        SKB["SKILL.md runtime"]
        ATK["atom-tasks/*"]
        WFT["workflows/*.json"]
        CFGD["config.default.json（模板 / 缺省回退）"]
        CAT["artifacts.json 产物目录"]
    end
    subgraph proj["projectRoot（用户仓库）"]
        REPO["源码仓库"]
        subgraph ddo[".ddo/（首次 run 自动创建 · 随项目入库）"]
            DDOC["config.json（项目唯一一份配置）"]
            RUNS["runs/（只存产物 · 随分支合并而来）"]
        end
    end
    WT["worktree（与项目同级 · 分支完整检出：代码+产物+.state.json 黑板）"]
    CFGD -->|"内存合成（不落盘）"| SKB
    DDOC -->|"内存合成（不落盘）"| SKB
    SKB -.->|"续跑按名再解析"| skill
    SKB -->|"注入 inputs.role"| ATK
    ATK -->|"交付登记"| WT
    WT -->|"黑板匹配 consumes"| SKB
    SKB -->|"worktree 默认落项目同级（worktreeDir 可配置）"| WT
    WT -.->|"分支合并：产物"| RUNS
    WT -.->|"分支合并：源码"| REPO
```



三地职责清晰：skill 全局只读、项目 \.ddo/ 承载 config 与产物（runs 只存产物）、worktree 默认与项目同级承载代码检出；以合并规则与按名再解析连接。



---



## 技术选型与方案对比



|方案|来源|仓库适配性|代价与风险|状态|结论|AI 索引|
|---|---|---|---|---|---|---|
|黑板匹配：consumes/produces \+ runtime 匹配注入|初始 Plan|契合「\.state\.json 即状态机」哲学；新增 workflow 零接线|runtime 增加注入逻辑；manifest 必须可视化防黑箱|accepted|采用（DEC\-1）|FR\-ATOM\-2|
|pipeline 边携带载荷|初始 Plan|接线最显式|4 个 workflow 手工接线；新增 workflow 重复接线|rejected|不采用|FR\-ATOM\-2|
|保留 io refs 仅强化校验|初始 Plan|改动最小|无法消除孤儿输入与点名耦合|rejected|不采用|FR\-ATOM\-1|
|独立产物目录 artifacts\.json \+ 元 schema|初始 Plan|单一真相源；tests/README 可引用|新增一个文件|accepted|采用（DEC\-2）|FR\-ATOM\-2|
|目录内嵌 schema $defs|初始 Plan|不新增文件|schema 膨胀，难引用|rejected|不采用|FR\-ATOM\-2|
|一次性切换|用户修订|用户明确无需兼容|回滚以 git revert 整集|accepted|采用（DEC\-3）|FR\-MIG\-1|
|双轨过渡|初始 Plan|平滑|两套契约并存必然漂移|rejected|不采用|FR\-MIG\-1|
|\.claude/rules \+ CLAUDE\.md 引用|用户修订|会话期可加载|需保持精简|accepted|采用（DEC\-6）|FR\-RULE\-1|
|worktree 默认项目同级，\.ddo/runs/ 只存产物|用户修订|\.ddo/ 恒为「config\+产物」清爽结构；笨重 worktree 在项目外，侵入低|产物经分支合并入 \.ddo/runs/，入库范围用户 \.gitignore 控制|accepted|采用（DEC\-8）|FR\-DEPLOY\-3|
|worktree 落点可配置（用户级 / 自定义）|初始 Plan|满足「worktree 放哪因人而异」的使用习惯|以 worktreeDir 指向相应目录即可，非默认|accepted|保留为可配置选项|FR\-DEPLOY\-3|
|三层配置合并（全局默认→项目级→run 参数）|用户修订|与 Claude Code 配置分层哲学一致|合并规则需明确|accepted|采用（DEC\-9）|FR\-DEPLOY\-2|
|git 可见性交还用户（\.gitignore），skill 不参与|用户修订|职责清晰，skill 不管理 git；\.ddo/ 随项目入库|用户需自行配置 \.gitignore（README 给建议）|accepted|采用（DEC\-10）|FR\-DEPLOY\-4|



