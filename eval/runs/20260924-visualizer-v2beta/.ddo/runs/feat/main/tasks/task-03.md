# task-03 · 验收执行（test-plan G1–G4）

> 目标：跑通全部验收 checklist 并留证。引用：test-plan.md G1（发现渲染）/ G2（无相交）/ G3（stale 容错）/ G4（空索引）。

## 涉及文件
- `verification.log`（新增，验收产物）；被测：`visualize.js` / `layout.js`

## 执行步骤
1. 逐条执行 G1–G4 的 cmd: 项，记录命令与 exit code；
2. G1/G2 的 human: 项交用户浏览器目检；
3. 汇总写入 verification.log，全部通过以 `ALL PASSED` 收尾。

## 完成标准
- verification.log 含 G1–G4 全部条目结果；cmd 全 exit 0；human 项经用户确认。
