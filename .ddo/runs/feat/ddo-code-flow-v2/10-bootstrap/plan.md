# 工作项 10 · bootstrap — 设计方案

> 版本：**v1.0（2026-09-24 定版并实现）**——D1–D6 需求定版后直接实现（无剩余开放评审点）
> 需求依据：[requirement.md](./requirement.md)（D1–D6）
> 契约基线：[../03-tools/plan.md](../03-tools/plan.md) §3.4（list 域命名）、[../07-exec-loop/plan.md](../07-exec-loop/plan.md)（错误即提示原则的发现层延伸）、[../05-atom-tasks/plan.md](../05-atom-tasks/plan.md) D9（configurable 预填是其部分落地）

## 1. 定位

补齐**冷启动引导层**：skill 触发时无参数/参数不合法不再依赖 agent 自由发挥，而是走结构化初始化协议（目标 → 预设或自定义 → 类型 → 启动）。三个支柱：

1. **数据面**：`list tasks`（原子任务注册表）+ `list workflows`（预设清单）——desc/configurable 直读 config.json，不另建注册表文件（D4）；
2. **预标记**：run start 物化时把链内任务 configurable 的 default 预填进 `state.atomTasks`——用户打开 state 即知可改哪些旋钮（D3）；
3. **指路**：错误信息联动发现层——未知预设列现有，任务不存在指向 list tasks（D5）。

## 2. 命令契约

### 2.1 `list tasks`（list 域，D1）

```text
用法:   list tasks [--tasks-dir <path>]
输出:   { tasks: [ { name, version, desc, phases: [ { id, summary?, type } ],
                    configurable?: [ { key, desc, default? } ] } ] }
来源:   atom-tasks/*/config.json 直读（name/version/desc/phases/configurable），
        无 config.json 的目录（_schema）跳过；解析失败的预设不在发现层报错
```

### 2.2 `list workflows`（list 域，D1）

```text
用法:   list workflows [--workflows-dir <path>]
输出:   { workflows: [ { name, version, description?, stages: [task…] } ] }
来源:   workflows/*.json（name/version/description/stages[].task）；解析失败的跳过
        （run start 加载时才 fail fast——发现层保持只读容错）
```

### 2.3 `run start` 扩展：configurable 预填（D3）

- 物化 state 时遍历 preset.stages，读各任务 `configurable`；**有 `default` 的项**写入
  `state.atomTasks[task][key] = default`；无 default 仅呈现（list tasks），不预填；
- 语义注意：预填值即 run 级事实（exec 三层合并的最高层）——只应预填「默认值即安全值」的旋钮
  （如 `test-plan.tdd: false`）；现盘点：tdd（default）+ issueNumber/repo（无 default，缺省走
  prompt 内的解析逻辑，不预填）；
- basic 链不含 test-plan → `atomTasks: {}` 属正确输出。

### 2.4 错误联动（D5）

| 场景 | 行为 |
|---|---|
| `run start --workflow 未知` | 报错并列出该目录现有预设 +「完整清单用 list workflows」 |
| exec/validate 任务不存在 | 错误尾部追加「可用任务见 list tasks」 |

## 3. SKILL 冷启动协议（随实现落地）

```text
无参数/参数不合法 → 不自由发挥，走引导：
  ① 问目标（一句话 → --title）
  ② 问模式（数据来自发现命令，原样呈现）：
     预设   → list workflows → 用户选定
     自定义 → list tasks（desc/相位/人审位/可配置项）→ 商定阶段链 →
              写临时预设 JSON（os.tmpdir）→ run start --workflows-dir 指向
              （物化进 state 即自包含，临时文件用后即弃——D2，不落预设文件）
  ③ 问 run 类型（缺省 feat）
  ④ 启动后把 state.atomTasks 预填的可配置项告知用户（可改旋钮一目了然）
```

## 4. schema 扩展（task-config.schema.json）

- `desc`（可选 string）：任务一句话描述——注册表数据源，与 prompt.md 首部引言保持同义；
- `configurable`（可选数组 `{ key, desc, default? }`）：run 级可配置项声明；
- 17 任务全部补写 desc（文案取自各自 prompt 首部引言）；4 任务声明 configurable。

## 5. 与其他工作项的联动

| 联动 | 说明 |
|---|---|
| 05-D9 部分落地 | run start 现在会写 state.atomTasks（configurable 预填）；用户级配置（~/.ddo/atom-tasks.json）的启动合并仍悬置（O1） |
| 02 §5.2 atomTasks | 写入方扩展：run start 预填（02 台账 v1.4 记录） |
| 04-D5 | list 域开启（tasks/workflows）；`list history` 仍悬置（O2） |
| O3（下一轮） | 产物生命周期：结束脚本归档 state 到 ~/.ddo/history、自定义链频次驱动的预设自我进化（D2 预留概念） |

## 6. 测试（tools/tests/list.test.js，4 例）

| 用例 | 断言 |
|---|---|
| list tasks | ≥17 任务；spec（desc/两相位含 human/无 configurable）；test-plan（tdd default false）；create-pr（issueNumber 无 default） |
| list workflows | 默认目录 basic（version/description/五阶段链）；--workflows-dir 自定义目录 |
| run start 预填 | 混合链（test-plan + create-pr）→ atomTasks 仅 `test-plan.tdd:false`；basic → `{}` |
| 错误指路 | 未知预设 stderr 列 basic + list workflows；任务不存在 stderr 含 list tasks |

## 7. 开放问题

| # | 问题 | 状态 |
|---|---|---|
| O1 | run 级配置注入命令（用户级配置 run start 合并） | 后续轮 |
| O2 | `list history` | 后续轮 |
| O3 | **产物生命周期**（state 归档 + 自定义链频次 → 预设自我进化） | **下一轮**（用户预告） |

## 变更记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.1 | 2026-09-24 | 初版：三支柱定位、命令契约、SKILL 协议、schema 扩展、联动与测试计划 |
| **v1.0** | 2026-09-24 | **定版并实现完毕**：list tasks / list workflows 登记（list 域开启）；run start configurable 预填；错误指路两处；17 任务 desc + 4 任务 configurable + schema 纳管；SKILL 冷启动协议 + README 同步；测试 68/68（新增 list.test.js 4 例）；冒烟（自定义临时预设链 → 预填 tdd:false → list 双清单 → 错误指路）通过 |
