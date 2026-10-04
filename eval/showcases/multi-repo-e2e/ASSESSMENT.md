# 多仓库隔离模式 E2E Showcase（20261004）

## 结论

**通过**。双仓库沙箱（svc-api@main + svc-web@develop）全链路验证 multi 模式：前置建容器 → run start 注册 → basic 链四阶段驱动 → run finish 归档 → 逐仓库清理。未发现与 plan（revision 1）设计不符的行为。

## AC 核对

| AC | 验证方式 | 结果 |
|---|---|---|
| AC-1 容器存在：.ddo + 各仓库 worktree | `run start --multi-repos` 后检查容器布局 | ✅ svc-api、svc-web 两 worktree 并列，runDir 在容器 .ddo |
| AC-2 先容器后 worktree | 前置动作步骤序（mkdir 容器 → 逐仓库 worktree add） | ✅ |
| AC-3 启动问询含隔离选择 | guide payload 含 `multi` 选项与 followUps（guide.test.js 断言） | ✅ |
| AC-4 不选则行为不变 | 存量测试 134/134 全绿（仅枚举断言按 AC-3 扩展） | ✅ |
| AC-5 state git/dirs 多仓库表达 | artifacts/state-multirepo.json | ✅ repos 主仓库首位、成员 mainBranch=develop 独立推断、dirs.projects 同序 |
| AC-6 容器位置与命名 | 容器 = 主检出父目录/`svc-api-feat-api-web-version`（<主仓名>-<分支名>） | ✅ |
| AC-7 交付链逐仓库 | deliver-pr/closeout prompt multi 段（delivery.test.js 断言；真实 gh 流程需远程仓库，沙箱不覆盖） | ✅ prompt 面 / ⚠ 真机 PR 待实际交付 run 验证 |

## 关键观察

1. **ctx 映射注入**：coding exec 的「Context: 工作目录」列出主仓库锚点 + 全部仓库↔工作目录映射（artifacts/coding-ctx.md）。
2. **清理拦截语义**：worktree 含未提交改动时 `git worktree remove` 被拒——与 closeout/cleanup prompt「先向用户确认」的设计一致；提交后逐仓库移除成功。
3. **容器持久化**：清理后容器仅剩 `.ddo`（产物留存磁盘，= 处置询问缺省「保留」）；两仓库分支 `feat/api-web-version` 均保留。
4. **单仓库零回归**：同一 CLI 跑存量 134 用例全绿。

## 边界说明

- 沙箱无远程仓库：deliver-pr 的 push/gh pr create 与合并门为 prompt 级验证，真实 PR 流程留待首次实际多仓库交付 run。
- E2E 中 spec/plan/reporting 为演示内容（结构合规、内容最小化），门决议由驱动脚本代行。
