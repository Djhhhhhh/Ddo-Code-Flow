# Task-02: 重写 create-pr.md

## 标题
重写 create-pr 原子任务流程

## 关联验收点
- G1: create-pr 流程重构
- G6: 约束完整性

## 变更文件
- atom-tasks/create-pr/create-pr.md

## 具体改动
1. 保留 frontmatter 和解析参数步骤
2. 新增 git-push 步骤（git add -A → diff --cached --stat → 生成提交信息 → commit → push）
3. 保留 PR 创建、issue 评论、label 更新步骤
4. 新增用户确认提示步骤
5. 更新约束：声明 worktree 清理由 done 阶段负责，git-push 必须在 PR 创建前完成
