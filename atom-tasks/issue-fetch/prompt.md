# issue-fetch

> 认领 issue 并拉取内容：先打认领锁 label，再拉取 issue，最后做需求完整性检查，产出 issue-context.md。

## 指令

1. **解析仓库**：run 配置（state.atomTasks.issue-fetch.repo）非空用之，否则用当前仓库；
2. **选定 issue**：配置 issueRef 非空（编号或 URL）直接使用；否则扫描带触发 label（默认 `ddo:trigger`）的 open issue；多个候选时列出并请用户选择；
3. **认领锁**：为选中 issue 打认领 label（默认 `ddo:in-progress`）；已被认领（label 已存在且非本次）则跳过并报告；
4. **拉取**：读取 issue 标题、正文、评论、label；
5. **完整性检查**：正文为空或无法从标题+正文得出可执行需求时，在产物中标注「需求不完整」并列出缺失项（不代替用户补全）；
6. 将 issue 内容组织为 `issue-context.md`：编号、标题、正文全文、关键评论、label、认领状态。
