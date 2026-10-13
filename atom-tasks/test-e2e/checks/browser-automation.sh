#!/usr/bin/env bash
# 依赖检查（DEC-E）：宿主浏览器自动化能力——Playwright CLI 可用即视为支持。
# 约定：exit 0 = 支持；非 0 = 不支持（deps check 汇总为 supported:false，不视为命令错误）。
set -u

# 1) 全局 playwright
if command -v playwright >/dev/null 2>&1; then
  playwright --version >/dev/null 2>&1 && exit 0
fi

# 2) 项目/本地依赖内的 playwright（npx --no-install 不触发下载，纯探测）
if command -v npx >/dev/null 2>&1; then
  npx --no-install playwright --version >/dev/null 2>&1 && exit 0
fi

echo "playwright CLI 不可用（全局与 npx --no-install 均未检出）" >&2
exit 1
