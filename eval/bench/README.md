# model-quick-eval — 模型能力快速评测编排器

输入一个 `model_id` + 题单（任意 1–n 题、形态自由）+ 两个 session ID，自动跑 A/B 双分支（纯 prompt vs prompt + Ddo-Code-Flow auto 模式），
提取结果层 / 过程层 / 成本层数据，输出对比卡片与汇总报告。混合形态（BQ-1 决议 c）：编排在本地，引擎只提供通用 `gate auto` 能力。
题组策略由使用者经 profile 预设（`--profile`/`--tasks`）自行定义，编排器不对数量/顺序/形态做硬校验。

## 数据流

```
profile 装配 ─→ 题库取题 ─→ 双臂沙箱 ─→ headless 执行 ─→ 三层采集 ─→ 报告渲染 ─→ 发布
 (src/profile)   (bank/)    (src/sandbox)  (src/driver     (src/collect)   (src/report)   (reports/<轮次>)
                                            + src/policy)
```

## 目录语义

| 目录 | 语义 | 提交 |
|---|---|---|
| `cli.js` | 唯一入口（`run` / `clean`），preflight 硬校验 | ✅ |
| `src/` | 代码，按流水线阶段：`profile`（装配）→ `sandbox`（沙箱）→ `policy`（对等澄清策略）→ `driver`（双臂驱动）→ `collect/`（trajectory·process·token·result 四采集器）→ `report/`（渲染器 + `templates/` 五报告形式模板） | ✅ |
| `bank/` | 题库（输入资产）：`core/` 冻结核心集。每题（`q_<slug>/`，目录名 = 题名）= `qpack.json`（唯一机器契约：title/form/track/changeWhitelist/meta）+ `prompt.md`（唯一题面）+ `clarify.json`（同源澄清清单）+ `fixture/`（code 题被测基线，进沙箱）+ `acceptance/`（**不进沙箱**的隐藏验收：`CHECKS.md` 计分总纲；code 题另有 `verify.js`，页面题另有 `probe.js` + `testdata/` 黄金样例与可选 `stub.js` dry-run 桩） | ✅ |
| `docs/` | 人读规则：`rubric.md`（判定口径）、`prompt-rules.md`（出题层修正规则）、`model-quick-eval.subflow`（流水线机器可读声明） | ✅ |
| `tests/` | bench 单测 | ✅ |
| `.ddo/eval/runs/<轮次Id>/` | 运行产物（仓库级 `.ddo/` 下，不落 bench 源码树）：沙箱、stream 轨迹、`metrics/*.json`、`round.json`（清理：`cli.js clean --run <id>`） | ❌ 不提交 |
| `.ddo/eval/reports/<轮次Id>/` | 对外发布物：卡片集、汇总页、平台物料（含 PNG） | ❌ 不提交 |
| `node_modules/` | playwright devDependency 安装产物 | ❌ 不提交 |

## 常用命令

```bash
# 真实轮（需 cc-switch 日志库可读 + 两个真实 session ID）
node eval/bench/cli.js run --model <model_id> --tasks q_threejs-orbit-scene,q_regression-trap \
  --baseline-sid <sid-b> --ddo-sid <sid-d>

# 链路自验（stub 会话 + 黄金样例页，token 为模拟值）
node eval/bench/cli.js run --model test-model --tasks … --baseline-sid s1 --ddo-sid s2 --dry-run

# 运行装配（DEC-9）：维度 / 题单 / 报告形式（注册表 card·sheet·summary·wechat·xiaohongshu）
#   --profile <profile.json>，缺省全维度 + card/sheet/summary

# 探针自检（reference 应 33/33，flawed 部分失败）
node bank/core/q_threejs-orbit-scene/acceptance/probe.js \
  bank/core/q_threejs-orbit-scene/acceptance/testdata/reference/index.html /tmp/probe-out

# 单测 / 清理轮次
npm test            # eval/bench 下
node eval/bench/cli.js clean --run <轮次Id>
```

## 用 Ddo-Code-Flow 工作流触发（推荐入口）

评测可以作为一个受管理的 run 直接触发（状态、人工确认门、reporting 收口归档全走引擎）。
所需预设随本仓库分发：`workflows/model-quick-eval.json` + `atom-tasks/eval-prepare` + `atom-tasks/eval-run`。

```bash
# 在任意项目目录（skill 快照未含新任务时，显式指向本仓库）：
node ~/.claude/skills/Ddo-Code-Flow/tools/cli.js run start \
  --title "评测 <model_id>" \
  --workflow model-quick-eval \
  --tasks-dir <本仓库>/atom-tasks \
  --workflows-dir <本仓库>/workflows \
  --config eval-prepare.model='"<model_id>"'          # 其余参数由 eval-prepare 阶段问询收集
```

链路：`eval-prepare`（问询收集 model / 双 sid / 题单 / 报告形式 → `eval-config.json`）
→ `eval-run:01`（自动执行本编排器 → `eval-result.json`）→ `eval-run:02`（确认门送审报告）
→ `reporting`（收口归档）。

> 注：`~/.claude/skills/Ddo-Code-Flow` 是仓库快照（软链到 `~/.cc-switch/skills/`）。
> 快照同步包含新任务后，可省略 `--tasks-dir`/`--workflows-dir` 直接 `--workflow model-quick-eval`。

## 判定总纲（详见 docs/rubric.md）

结果层不做加权总分；过程层只呈现「有/无 + 数字 + 负面计数」；增益按题呈现；负增益/无差异如实写入；
不合成单一性价比分数。一切报告形式固定携带小样本声明 + 诚实边界 + token 口径声明。
