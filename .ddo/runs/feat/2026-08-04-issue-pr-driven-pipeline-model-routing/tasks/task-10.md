# Task 10: gh-watcher.sh 轮询脚本

> 关联验收点：G2（远端确认门）

## 目标

创建 `gh-watcher.sh` 轮询脚本，支持双模式：扫描新触发 issue + 等待特定门信号。

## 变更文件

- `scripts/gh-watcher.sh`（新建）

## 具体改动

### 1. 创建 gh-watcher.sh

```bash
#!/bin/bash
# scripts/gh-watcher.sh — 双模式巡检脚本
# 模式 1: 扫描新触发 issue（无参数）
# 模式 2: 等待特定门信号（传入 ISSUE_NUMBER）
ISSUE=${1:-""}
INTERVAL=${3:-30}

if [ -z "$ISSUE" ]; then
  # 模式 1: 扫描新触发 issue
  while true; do
    issues=$(gh issue list --label "ddo:trigger" --json number,title --jq '.[].number')
    for num in $issues; do
      if ! find . -path "*/docs/*/*/.state.json" -exec grep -l "\"issueNumber\":$num" {} \; 2>/dev/null | head -1; then
        echo "NEW_ISSUE:$num"
      fi
    done
    sleep "$INTERVAL"
  done
else
  # 模式 2: 等待特定门信号
  while true; do
    labels=$(gh issue view "$ISSUE" --json labels --jq '.labels[].name')
    if echo "$labels" | grep -q "ddo:approved"; then
      echo "GATE_APPROVED"
      exit 0
    fi
    if echo "$labels" | grep -q "ddo:changes-requested"; then
      echo "GATE_REJECTED"
      exit 0
    fi
    if echo "$labels" | grep -q "ddo:failed"; then
      echo "GATE_FAILED"
      exit 1
    fi
    sleep "$INTERVAL"
  done
fi
```

### 2. 功能说明

- 模式 1（无参数）：扫描带 ddo:trigger label 的新 issue，检查是否已有 run 在处理
- 模式 2（传入 ISSUE_NUMBER）：等待特定门的信号变化
- 轮询间隔默认 30 秒，可配置
- 容忍瞬时网络失败

## 约束

- 轮询间隔不低于 30 秒
- 脚本容忍瞬时失败（失败不退出、下轮重试）
- Watcher 仅为加速器，不是正确性来源
- 任何时候手动恢复会话同样能推进
