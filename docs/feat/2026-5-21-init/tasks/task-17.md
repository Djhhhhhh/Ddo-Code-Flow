# task-17 — 端到端冒烟：跑通 test-plan 所有 group

## 目标
准备一份最小化 `requirement.md`，作为 ddo-swe 自己的"目标项目"，端到端跑一遍 12 阶段流水线，并按 `docs/test-plan.md` 的 G1 ~ G11 逐项核对。

## 范围
- 创建临时目标目录 `<target>/`（可在仓库外的 sandbox 路径，或仓库内一个 `.scratch/` 子目录）
- 在该目录放一份最小 `requirement.md`
- 调用 ddo-swe skill 完整跑一次
- 跑出 `<target>/YYYY-MM-DD-<desp>/` 下的全部产物
- 对 G1 ~ G11 的每一条 checklist 勾选 / 自动执行

## 依赖
- task-01 ~ task-16 全部完成

## 关联验收点
- 全部 G1 ~ G11
- G12 最终验收：`verification.log` 末尾出现 `ALL PASSED`

## 步骤
1. 准备最小化 requirement：例如 `实现一个 reverseString(s: string): string 的纯函数模块`。
2. 启动 ddo-swe；在每个确认门检查产物，"同意"通过。
3. 在 Specification 阶段故意先回复一次"修改：增加单元测试一节"，确认能正确回退重生（G5.2）。
4. 在 Verification 阶段故意保留一个一定失败的 cmd 条目，确认 agent 能识别并回到 Coding 重做（G5.3）。
5. 启动一个 UI 实例：手动操作 Base / Pipeline / Atom-tasks 三个 Tab，并触发：
   - 构造一个 DAG 环，确认 Save 变灰、红线高亮（G6.4）。
   - 在 Atom-tasks Tab 添加一个 `review` 阶段的 atom-task 到 pipeline，跳转高亮验证（G7.4）。
6. 跨会话恢复：中途强制关闭 agent 会话，重启后从 `.state.json` 续跑（G9）。
7. 解耦验证：用 git diff 验证只动了 `config.json` 与新增 atom-task 子目录（G10）。
8. 把全部 G1 ~ G11 的勾选状态记录到 `<run>/verification.log`，结尾写 `ALL PASSED`。

## 产物
- 一次完整的 run 工作目录（保留为后续 demo / regression）
- `verification.log` 末尾 `ALL PASSED`
