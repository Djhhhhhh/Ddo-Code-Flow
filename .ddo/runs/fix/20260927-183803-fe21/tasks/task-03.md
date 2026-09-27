# task-03 spec 任务 present 钩子（动态 BQ 选项）

## 目标

让 spec 确认门的动态选项（回答BQ-N）由 CLI 现算进统一 payload，替代 prompt 散文自拼。

## 涉及文件

- atom-tasks/spec/spec.js

## 执行步骤

1. 同文件新增导出 `present({ phase, statePath, config })`：
   - phase 非 '02' 返回 {options:[]}；
   - 读 `<runDir>/spec.md`（runDir = dirname(statePath)）；缺失或无「## 需要用户确认」section → {options:[]}（降级不阻塞）；
   - 解析该 section 内 `- **BQ-N**：` 行（含全角冒号变体），产出 `{name:'回答BQ'+N 无空格, desc:BQ 原文, action:'in-phase'}`；
   - 不与静态选项重名（静态无此形态，理论无冲突，仍防御性过滤）。
2. 保持既有 assemble 钩子不动。

## 完成标准

- spec 门（相位 02、spec.md 含未解决 BQ）跑 gate present，payload options 含静态四项+动态回答BQ-N；无 BQ 时 payload 不含动态项。
