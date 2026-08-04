# Task 05: coding/verification 更新（Loop 自检）

> 关联验收点：G3（Loop 自检）

## 目标

更新 `coding` 和 `verification` 原子任务，新增 `maxSelfCheckRounds` / `maxRetries` options 和 loop 自检逻辑。

## 变更文件

- `atom-tasks/coding/coding.md`（更新）
- `atom-tasks/verification/verification.md`（更新）

## 具体改动

### 1. 更新 coding.md

新增 options：
```yaml
options:
  - name: maxSelfCheckRounds
    type: integer
    default: 3
    description: "自检最大轮次"
```

指令部分新增：
```
round = 0
WHILE round < maxSelfCheckRounds:
  执行编码
  运行测试/静态检查
  IF 全部通过 → break
  round++
  自行修复失败项
IF round >= maxSelfCheckRounds AND 仍有失败：
  gh issue edit --add-label "ddo:failed"
  gh issue comment --body "自检超限，转人工：{失败原因}"
  暂停
```

### 2. 更新 verification.md

新增 options：
```yaml
options:
  - name: maxRetries
    type: integer
    default: 2
    description: "最大重试次数"
```

指令部分新增：
```
retry = 0
WHILE retry < maxRetries:
  执行验收
  IF 全部通过 → break
  retry++
  回到 coding 修复
IF retry >= maxRetries AND 仍有失败：
  gh issue edit --add-label "ddo:failed"
  gh issue comment --body "验收超限，转人工：{失败原因}"
  暂停
```

## 约束

- 向后兼容：未配置 maxSelfCheckRounds/maxRetries 时行为不变
- 超限时必须打 ddo:failed label 并评论原因
- 轮次记录到 .state.json 供审计
