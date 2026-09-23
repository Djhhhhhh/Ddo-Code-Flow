# ddo-code-flow 可视化工具 — 测试计划

> 基于已确认的 spec.md（AC-1 / AC-2）与 plan.md Verification Anchor（VA-1～3）生成的验收 checklist。

## G1. 发现与渲染（AC-1）

### Checklist

- [ ] cmd: node visualize.js --out ddo-visual.html && node -e "const h=require('fs').readFileSync('ddo-visual.html','utf8');if(!h.includes('<svg'))process.exit(1)"
- [ ] cmd: node visualize.js | node -e "const o=JSON.parse(require('fs').readFileSync(0));if(!(o.runs>=1))process.exit(1);console.log('runs='+o.runs)"
- [ ] human: 浏览器打开 ddo-visual.html，确认本 run（visualizer-v2beta）出现在页面中，且可见阶段链、各阶段状态色与当前执行位置（应停在 test-plan 相位附近）

### 通过标准

工具对运行中 run 产出可视化 HTML，页面包含 SVG 图与阶段/位置信息，本 run 出现在页面中。

## G2. 连线不相交（AC-2）

### Checklist

- [ ] cmd: node visualize.js | node -e "const o=JSON.parse(require('fs').readFileSync(0));if(o.crossings!==0){console.error('crossings='+o.crossings);process.exit(1)}console.log('crossings=0')"
- [ ] human: 浏览器中目检流程图：任意两条连线不存在交叉点

### 通过标准

自检摘要 crossings=0，且人工目检确认无相交连线。

## G3. 容错（VA-3：stale 索引跳过）

### Checklist

- [ ] cmd: T=$(mktemp -d) && printf '{"ghost-run":{"statePath":"%s/ghost/.state.json","startedAt":"2026-09-24T00:00:00+08:00"}}' "$T" > "$T/index.json" && DDO_HOME=$T node visualize.js --out "$T/out.html" && DDO_HOME=$T node visualize.js | node -e "const o=JSON.parse(require('fs').readFileSync(0));if(o.stale<1||o.runs!==0)process.exit(1);console.log('stale='+o.stale)"

### 通过标准

含失效指针的 index 不导致崩溃：exit 0，stale 计入摘要，产物仍生成。

## G4. 空索引

### Checklist

- [ ] cmd: T=$(mktemp -d) && DDO_HOME=$T node visualize.js --out "$T/empty.html" && DDO_HOME=$T node visualize.js | node -e "const o=JSON.parse(require('fs').readFileSync(0));if(o.runs!==0||o.stale!==0)process.exit(1)"

### 通过标准

无 index.json 时给出人话提示且不崩溃，runs/stale 均为 0。
