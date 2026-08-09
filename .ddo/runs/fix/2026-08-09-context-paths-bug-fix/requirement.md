# Requirement

## 需求来源

用户触发提示词

## 需求内容

读取 https://github.com/Djhhhhhh/Ddo-Code-Flow/issues/30 这个 issue，修复其中描述的 bug。

## 需求分析

Issue #30 描述了 `contextPaths` 无法承载按需求变化的上下文的问题：

1. **问题**: `contextPaths` 是项目级基线上下文，对项目内每一次 run 都加载同一份内容
2. **根因**: 没有 per-run 或 per-requirement 的上下文注入通道
3. **影响**: 用户无法按需求切换上下文路径，只能手动改配置或靠提示词承载

## 修复方向

1. **文档层面**: 在 context.md / SKILL.md 明确 `contextPaths` 的定位为"跨需求稳定基线"
2. **能力层面**: 为 run 参数增加 per-run 上下文覆盖能力（如 `--context <path>`）
3. **配置校验**: 修正 `.ddo/config.json` 的 `$schema` 指向真实 schema
