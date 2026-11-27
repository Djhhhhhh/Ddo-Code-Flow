# 报告输入/产物契约（report-contract）

> 本文件是评测报告层输入与产物契约的**唯一事实源**（issue #94 DEC-7；#100 跟进定位重构）。报告任务
> （`atom-tasks/report-align|draft|sheet|wechat|xiaohongshu`）与编排器文档一律**引用**本文件，不复制字段口径。
> 契约变更规则：输入字段或发布布局变更须先改本文件再改代码；与代码不一致时以本文件为准并修代码。
> 流程契约：平台物料渲染前必经 **report-align（对齐确认门）→ report-draft（审阅底稿门）**（工作流 dependOn 保证）。

## 1. 输入文件清单与字段口径

渲染输入全部来自轮次工作区（`<仓库根>/.ddo/eval/runs/<roundId>/`），与 ddo run 的 runDir 解耦：

| 输入 | 字段口径 |
|---|---|
| `runs/<roundId>/round.json` | `model`（展示标签，可空）/ `resolvedModel`（回执解析的真实模型，可空）/ `questions[].qName`·`form`·`track`（旧轮次为 `trackHint`，兼容读取）/ `tasks[]`（题数来源）/ `dryRun` |
| `runs/<roundId>/report-brief.json` | 报告对齐稿（`brief` 子命令生成/人工修改）：`subject`（`model`=被测模型能力为主体，工作流=方法；`workflow`=工作流收益为主体）、`angle`/`audience`/`coreQuestion`/`tone`。渲染器消费定位文案；字段口径单源 = `src/report/brief.js` |
| `runs/<roundId>/<q>/metrics/result.json` | `baseline`·`ddo` 的 `ok/pass/total`（page 题达标率；`ok=false` 渲染「失败」）；`delta.结果层`（逐字保留）；`raw.<arm>.checks[]`（逐项探针：`id/pass/actual/expected`——draft 逐项表与分类小计来源）；`raw.<arm>.page`（交付页路径，GIF 录制输入） |
| `runs/<roundId>/<q>/metrics/process.json` | `signals[].signal`·`rows[].arm/binary/metrics/negative`（过程信号，draft 过程表与 F3 process 页来源） |
| `runs/<roundId>/<q>/metrics/token.json` | `groups[].key`（`baseline`/`ddo`）· `total_tokens`（短格式 `fmtK` 呈现，同模型内对照）；`calls`/`input_tokens`/`output_tokens`/`cache_fields.total`（成本全景） |
| `runs/<roundId>/<q>/report/<arm>/shots/*` | 页面题展示资产：`*.png`（initial/rotated/narrow 等）与 `demo.gif`（report 阶段录制，缓存复用；缺省回退 PNG） |
| 题包 `bank/**/qpack.json`（经 `sandboxLib.resolvePack`/`readQpack`） | `title`（展示标题与字数截断基准）、`meta.expectedBehaviors`（card 对照表行来源） |
| `eval-result.json`（ddo run 的 runDir 产物） | **任务侧定位与核对输入**：`round_id`/`publish_dir`/`questions`。`report` 子命令不依赖（签名保持 `--form --round`） |

## 2. 发布布局

`reports/<roundId>/`（`<仓库根>/.ddo/eval/reports/`）：

```
reports/<roundId>/
├── summary.md                     # 核心集（run 恒产）：平铺总览表 + 对称性 + 适用边界 + 声明
├── card-<q>.md                    # 核心集（run 恒产）：直观区 + 量化区 + token + 预期行为对照 + 声明
├── <arm>/shots/                   # 核心集截图资产（card 相对链接）
└── report-<form>/                 # 平台物料（report 子命令产出；历史轮次既有文件只读）
    ├── draft-<roundId>.md + shots/<q>/<arm>/*                                # F0 审阅底稿（完整数据/打分标准/附录A文案/附录B平台说明）
    ├── sheet.html / sheet.png / shots/<q>/<arm>/*                            # F1 快览大图（1080 宽，高自适应；每题含分类小计行）
    ├── cover-round.html/.png                                                  # F2 轮级封面（900×383，模型主题）
    ├── article-<q>.html（+ article-<q>.png 或 article-<q>-part<N>.png）       # F2 正文长图（内容宽 900；含分类小计/过程/成本段；>600 万像素分段）
    ├── xhs-<no>-<name>.html/.png（轮级 cover/rubric + 每题 compare/results/process，3:4 1080×1440）# F3 图组（<no> 为两位全局页序；results 页右卡带 Δ 标注、分类行带 ▲▼◆ 方向符；process 页 ✓ 青绿/✗ 品红语义色，token 含 input/output/total/倍率明细行）
    ├── note-<q>.md                                                            # F3 文字包（标题 ≤20 硬限）
    └── shots/<q>/<arm>/*（*.png 与 demo.gif）                                 # 平台物料自管截图/GIF
```

GIF 产物：`runs/<roundId>/<q>/report/<arm>/shots/demo.gif`（录制缓存，`wechat|xiaohongshu` 形式渲染时
按需生成；`BENCH_SKIP_GIF=1` 或 ffmpeg 缺失时跳过并回退 PNG，notes 如实记录）。

不变式：`run` 结束后 `summary.md` 与全部 `card-<q>.md` 必在（eval-run 送审链依赖，不可断）；
`report` 子命令对既有文件不修改不删除，新增仅落 `report-<form>/` 子目录（幂等：同数据重跑产物一致）；
平台文案唯一来源 = `src/report/forms.js` 的 `wechatCopyFor`/`noteBodyFor`（draft 附录A 为其逐字投影）。

## 3. 声明登记（不复制）

固定声明三段（小样本[n 题参数化] / 诚实边界 / token 口径）唯一事实源 =
`eval/bench/src/report/render.js` 的 `declarationsFor(n)`。模板（核心集与平台形式）、任务 prompt、
README 一律引用本条登记，不得内嵌副本；题数 `n` 一律取轮次实际题数，不写死。

## 4. report / brief 入口用法与 exit 码

```
node eval/bench/cli.js brief --round <轮次Id>                    # 对齐：生成/查看 report-brief.json（stdout=对齐五要素）
node eval/bench/cli.js report --form <draft|sheet|wechat|xiaohongshu> --round <轮次Id>
```

| 通道 | 行为 |
|---|---|
| stdout | JSON：`{ form, round_id, publish_dir, outputs[], skipped, notes[] }`（outputs = publish_dir 相对路径，均真实存在） |
| stderr | 人话产物清单与跳过说明 |
| exit 0 | 成功 |
| exit 1 | 失败：轮次不存在、metrics/模板缺失、渲染器声称产物不存在等（如实报错，不虚构） |
| exit 2 | 用法错误：缺 `--form`/`--round`、`--form` 未注册（注册表 = `src/report/forms.js` `FORMS`，含 `draft`） |

`brief` 子命令同表 exit 约定（stdout 为对齐五要素文本而非 JSON；`report-brief.json` 非法 → exit 1）。

`skipped` 语义：该形式主产物（PNG）全部未产出时 `true`（wechat 的 HTML、xhs 的 note.md 仍如实列入
outputs）；部分跳过 → `skipped: false` + notes 逐项记录。字数硬限（xhs 标题 ≤20 等）由渲染器确定性
截断保证，截断事实记 notes。
