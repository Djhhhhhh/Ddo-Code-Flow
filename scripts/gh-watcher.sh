#!/bin/bash
# scripts/gh-watcher.sh — 双模式巡检脚本
# 模式 1: 扫描新触发 issue（无参数）
# 模式 2: 等待特定门信号（传入 ISSUE_NUMBER）
#
# 用法:
#   ./gh-watcher.sh              # 扫描新触发 issue
#   ./gh-watcher.sh <issue_num>  # 等待特定门信号
#   ./gh-watcher.sh <issue_num> <interval>  # 自定义轮询间隔
#
# 环境要求:
#   - gh CLI 已认证
#   - jq 已安装

set -euo pipefail

ISSUE=${1:-""}
INTERVAL=${2:-30}

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"
}

# 检查依赖
check_deps() {
  if ! command -v gh &> /dev/null; then
    log_error "gh CLI 未安装"
    exit 1
  fi
  if ! command -v jq &> /dev/null; then
    log_error "jq 未安装"
    exit 1
  fi
}

# 模式 1: 扫描新触发 issue
scan_new_issues() {
  log_info "启动扫描模式，轮询间隔: ${INTERVAL}s"

  while true; do
    # 查找带 ddo:trigger label 的 issue
    issues=$(gh issue list --label "ddo:trigger" --json number,title --jq '.[].number' 2>/dev/null || echo "")

    if [ -n "$issues" ]; then
      for num in $issues; do
        # 检查是否已有 run 在处理该 issue（防重复）
        if ! find . -path "*/docs/*/*/.state.json" -exec grep -l "\"issueNumber\":$num" {} \; 2>/dev/null | head -1 | grep -q .; then
          log_info "发现新 issue: #$num"
          echo "NEW_ISSUE:$num"
        fi
      done
    fi

    sleep "$INTERVAL"
  done
}

# 模式 2: 等待特定门信号
wait_for_gate() {
  log_info "等待门信号: issue #${ISSUE}，轮询间隔: ${INTERVAL}s"

  while true; do
    # 获取 issue labels
    labels=$(gh issue view "$ISSUE" --json labels --jq '.labels[].name' 2>/dev/null || echo "")

    if echo "$labels" | grep -q "ddo:approved"; then
      log_info "检测到批准信号: ddo:approved"
      echo "GATE_APPROVED"
      exit 0
    fi

    if echo "$labels" | grep -q "ddo:changes-requested"; then
      log_warn "检测到修改请求: ddo:changes-requested"
      echo "GATE_REJECTED"
      exit 0
    fi

    if echo "$labels" | grep -q "ddo:failed"; then
      log_error "检测到失败信号: ddo:failed"
      echo "GATE_FAILED"
      exit 1
    fi

    if echo "$labels" | grep -q "ddo:suspended"; then
      log_warn "检测到挂起信号: ddo:suspended"
      echo "GATE_SUSPENDED"
      exit 2
    fi

    sleep "$INTERVAL"
  done
}

# 主逻辑
main() {
  check_deps

  if [ -z "$ISSUE" ]; then
    scan_new_issues
  else
    wait_for_gate
  fi
}

main "$@"
