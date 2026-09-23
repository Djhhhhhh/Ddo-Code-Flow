# 反思报告 — 20260924-014319-025b

> 检查项目未完结项、推荐后续动作与本次 run 经验教训。eval dogfooding（v2 内测）。

---

## 未完结项（Open items）

- [ ] tools/lib/output-schema.js:56-60（skill 仓库）——占位符 heading 通配修复与 atom-tasks/test-plan/test-plan.output.schema.json 的字面量归一**尚未提交**（本 run 期间在工作区修复并回归测试 80/80，随 showcase 归档一并提交）
- [ ] eval/runs/20260924-visualizer-v2beta/ddo-visual.html——工具产物为某一时刻快照（静态 HTML 语义如此，BQ-2 定版），刷新需重跑 visualize.js

---

## 推荐后续动作（Follow-ups）

- 提交 dogfooding 期间的 skill 修复（output-schema 占位符通配 + test-plan schema 归一 + validate 回归测试 2 例），commit message 引用本 run 的发现
- 将本 run 的 timeline / 决议留痕 / 产物汇编进 eval/showcases/v2-beta/，附 ASSESSMENT.md（内测 → 转正式评估结论）
- （可选，真实需要再做）把 visualize.js 提升为仓库级工具（tools/ 下）并补 history run 可视化（BQ-1 当时收窄的范围）

---

## 本次 run 经验（Lessons learned）

- **dogfooding 在第一个全链 run 就挖出阻断级缺陷**：review/test-plan/verification 三个契约的占位符 heading 字面匹配导致任何真实产物过不了 validate——78 例单命令测试全绿也没覆盖「真实产物 × 契约」的组合路径；修复后 80/80。结论：每版本至少一次真实全链 dogfooding 是必要的回归层
- 布局算法第一版（通道正交路由）被自检当场拦下（走廊水平线穿越竖直边），换虚拟节点链方案后全部现实形态 0 交叉——「自检 + 诚实标注」的失败语义比「假装成功」更有价值
- BQ 机制运转符合设计：spec 门先以「回答 BQ」形式澄清范围与形态，写回后展示对齐变化摘要再批准——两次澄清改变了交付物形态（省掉 HTTP server 分支）
- 修正循环真实触发过两次（plan 标题后缀、test-plan 结构预判），校验器的错误信息足以自定位，无需求助

---

## 与原始 requirement 的偏差

无功能偏差。一处文档级偏差已记录于 review-report.md：plan API 表写「index 不存在 → exit 1」，实现与 test-plan G4 为 exit 0 + stderr 人话提示（以更晚批准的 test-plan 为准，空状态对可视化工具不是错误）。

---

## 用户确认

请确认以下任一选项：

- ✅ **同意**：本 reflection 符合预期，可标记本次 run 为 **Done**。
- ❌ **修改**：请在下方/对话中列出需要调整的条目与意见，AI 将基于反馈重新生成本文档。
