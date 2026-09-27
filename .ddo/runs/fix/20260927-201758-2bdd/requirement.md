# 用户需求

> 用户触发此流水线的原始需求描述。

## 原始需求

现在存在个问题，现在worktree会创建worktree-info.json的机制，但现在我的设计应该是注册到.state.json中，你检查一下这个问题。

（检查结论：注册链路已正确落在 state.git——run start 时 git-info 推断链第三档自动捕获 branch / worktreePath，所有消费方均读 state；worktree-info.json 定位为「审计登记产物」，代码零读取。）

去掉这个审计产物，注册信息全收敛进 state。

## 需求摘要

删除 git-worktree 任务的 worktree-info.json 登记产物机制（含 output 声明、schema、后置登记步骤与相关文档/测试），worktree 注册信息唯一收敛进 state.git。
