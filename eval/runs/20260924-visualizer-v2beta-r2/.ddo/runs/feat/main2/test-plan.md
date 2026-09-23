# ddo-code-flow 可视化工具 测试计划

> 基于已确认的 spec.md 生成的验收测试 checklist。

## G1. 运行发现

### Checklist

- [ ] cmd: node visualize.js | grep -q "20260924-023150-94cb"
- [ ] cmd: node visualize.js --home /tmp/ddo-nonexistent-home | grep -qi "no running\|empty\|0 run"; test $? -eq 0

### 通过标准

工具能从索引发现本机运行中的 run（含当前 run），空索引时输出空态且 exit 0。

## G2. 渲染产出

### Checklist

- [ ] cmd: test -f ddo-visual.html && grep -q "<svg" ddo-visual.html
- [ ] cmd: grep -q "20260924-023150-94cb" ddo-visual.html && grep -q "当前\|current" ddo-visual.html
- [ ] human: 用浏览器打开 ddo-visual.html，能看到运行中 run 的执行流程：阶段链、当前位置高亮、确认门标记，且图形为 SVG 绘制

### 通过标准

生成的 HTML 存在且内联 SVG；页面呈现阶段链、当前位置与门状态；用户目检确认可读。

## G3. 连线无相交

### Checklist

- [ ] cmd: node visualize.js | grep -q "crossings: 0"
- [ ] human: 目检 ddo-visual.html 流程图，确认任意两条连线不相交

### 通过标准

内置自检交叉计数为 0，用户目检确认图上无相交连线。
