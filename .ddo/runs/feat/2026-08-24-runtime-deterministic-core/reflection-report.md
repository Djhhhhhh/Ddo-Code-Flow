# 反思报告 — Ddo-Code-Flow-feat-2026-08-24-runtime-deterministic-core

> 检查项目未完结项、推荐后续动作与本次 run 经验教训。

---

## 未完结项（Open items）

> 来源：worktreePath 中的 TODO / FIXME / XXX 标记，以及本 run 未完成的任务。
> 说明：scripts/runtime 与 SKILL.md 中无 TODO/FIXME/XXX 标记；以下为 review 阶段识别的 lint 级未用导入/变量，建议后续清理（非阻断，功能与测试均不受影响）。

- [ ] scripts/runtime/lib/nodes.js:5 — 导入 `topoOrder` 但未使用
- [ ] scripts/runtime/lib/nodes.js:32 — 声明 `entry` 变量但未使用
- [ ] scripts/runtime/ddo.js:6 — 导入 `readJsonIfExists` 但未使用

---

## 推荐后续动作（Follow-ups）

- 删除 `scripts/runtime/lib/nodes.js` 中未使用的 `topoOrder` 导入与 `entry` 变量，并重跑 `node --test scripts/runtime/test/`。
- 删除 `scripts/runtime/ddo.js` 中未使用的 `readJsonIfExists` 导入，并重跑 CLI smoke test。
- 修复 `register-artifact` 的 history `node` 默认取 `role` 而非工作流节点名的问题（`taskRef` 场景下节点名≠任务名会记错 done 节点；当前 `guarded.json` 因二者同名被掩盖）。
- 非法 `--args-json` 抛裸 `SyntaxError` 应归一为用法错误 exit 2（当前被 `fail()` 归为 exit 1）。
- `validate-dag` 用单一全局 `produced` 集合，同一角色在两个阶段合法生产会被误判「重复生产」；改为按阶段作用域收敛。
- （P1/P2，本 run Non-goals，视后续演进排期）实现 `next-node` 预计算 per-node prompt 的分层加载，进一步消除长跑漂移。

---

## 本次 run 经验（Lessons learned）

- runtime 化不是开荒：复用 `scripts/metrics/plugin.js` 的「子命令 + stdout JSON + exit 码 + 读写 .state.json」范式，代码风格与依赖零新引入。
- 退出码是受控失败，不是崩溃：`validate-output` / `validate-dag` / `advance-stage` 故意 exit 1，让模型读 stderr 进入修正循环，门是否通过由代码说了算。
- 用「真实 .state.json dogfood」验证比单测更有说服力：`advance-stage` 端到端推进，证明 applyMutation 写守卫 + schema 校验 + 原子写全链路可用。
- 对抗性测试（独立 subagent 逐项 smoke + 契约核对）能暴露单测覆盖不到的真违约：裸 `--help` exit 码、`77=pending` 通道、`gate`/`advance-stage` 原地变异 latent bug 均由它抓出，随后修复并补齐回归测试。
- 纯函数化写命令（返回 patch delta、不原地改 state）能消除「patch 不是 delta」的 latent bug，代价是调用方须显式用 `applyMutation(state, patch)` 持久化。
- 终态也要用硬约束兜住：`advance-stage` 把终端 `done` 伪阶段当可运行阶段（`stages.done=running`）是 finishing 阶段踩到的坑，已在终态推进时直接落 `done` 而非 `running`。
- Node 16.20.2 的 `node --test` 仍是实验性、`--test-reporter=spec` 不可用，统计断言数需从测试文件手工核对。

---

## 与原始 requirement 的偏差

无。本次 run 严格交付 BQ-1 确认的范围（P0.5 + P0）：runtime 确定性内核（10 个子命令 + 四通道契约 + applyMutation 写守卫 + 协议解析）+ SKILL.md Step 1–7 委托改写，P1/P2 按 Non-goals 未实施。期间针对对抗性测试暴露的 5 个契约缺口（裸 `--help` exit 码、`-h` 识别、`77=pending`、纯函数化、rejected 标 rework）做了修复并补回归测试，仍属 P0 交付质量内，不构成范围偏差。

---

## 用户确认

请确认以下任一选项：

- ✅ **同意**：本 reflection 符合预期，可标记本次 run 为 **Done**。
- ❌ **修改**：请在下方/对话中列出需要调整的条目与意见，AI 将基于反馈重新生成本文档。
