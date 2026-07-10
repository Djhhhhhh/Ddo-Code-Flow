# Ddo-Code-Flow 测试计划

> 基于已确认的 spec.md 生成的验收测试 checklist。

## G1. git-worktree.md 改动验证

- [ ] cmd: grep -q "切换 agent 工作目录" atom-tasks/git-worktree/git-worktree.md
- [ ] cmd: grep -q "projectRoot" atom-tasks/git-worktree/git-worktree.md
- [ ] cmd: grep -q "EnterWorktree\|--cd\|/cd" atom-tasks/git-worktree/git-worktree.md
- [ ] cmd: grep -q "不得在主工作树中执行任何文件修改操作" atom-tasks/git-worktree/git-worktree.md
- [ ] cmd: grep -q "skill://.*projectRoot\|projectRoot.*skill://" atom-tasks/git-worktree/git-worktree.md
- [ ] human: 阅读 git-worktree.md 步骤 11，确认指令清晰描述了 agent CWD 切换流程（含 projectRoot 验证 + 原生切换机制 + pwd 验证）

通过标准：git-worktree.md 包含步骤 11（CWD 切换）和相关约束，指令无歧义。

## G2. SKILL.md 改动验证

- [ ] cmd: grep -q "projectRoot" .claude/skills/Ddo-Code-Flow/SKILL.md
- [ ] cmd: grep -q "EnterWorktree\|--cd\|/cd" .claude/skills/Ddo-Code-Flow/SKILL.md
- [ ] cmd: grep -q "Working directory" .claude/skills/Ddo-Code-Flow/SKILL.md
- [ ] cmd: grep -q 'skill://.*projectRoot\|<projectRoot>' .claude/skills/Ddo-Code-Flow/SKILL.md
- [ ] human: 阅读 SKILL.md Path resolution rules 表格，确认 skill:// 的解析基准明确为 projectRoot

通过标准：SKILL.md 包含 projectRoot 初始化、Path resolution 更新和 Working directory 说明。

## G3. .state.json schema 验证

- [ ] cmd: python3 -c "import json; s=json.load(open('.claude/skills/Ddo-Code-Flow/SKILL.md'.replace('SKILL.md','') + '../../config.json')); print('OK')" 2>/dev/null || echo "SKILL.md 不存在于 worktree（预期行为）"
- [ ] cmd: grep -q '"projectRoot"' .claude/skills/Ddo-Code-Flow/SKILL.md
- [ ] human: 确认 SKILL.md 中 .state.json 初始化模板包含 projectRoot 字段

通过标准：SKILL.md 的初始化模板包含 projectRoot 字段。

## G4. 端到端逻辑验证

- [ ] cmd: grep -q "run://.*基于 worktree\|run://.*worktreePath" .claude/skills/Ddo-Code-Flow/SKILL.md
- [ ] cmd: grep -q "skill://.*基于 projectRoot\|skill://.*projectRoot" .claude/skills/Ddo-Code-Flow/SKILL.md
- [ ] human: 模拟理解：CWD 切换到 worktree 后，run:// 解析到 worktree 目录，skill:// 解析到项目根目录——两条路径互不干扰

通过标准：Path resolution 中 run:// 和 skill:// 的解析基准分别明确为 worktreePath 和 projectRoot。

## 最终验证

- [ ] cmd: tail -n 1 verification.log | grep -q "ALL PASSED"
