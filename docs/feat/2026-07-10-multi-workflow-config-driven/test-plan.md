# Ddo-Code-Flow Multi-Workflow 测试计划

> 基于已确认的 spec.md 生成的验收测试 checklist。每条验收项标记为 cmd（自动化）或 human（手动）。

## G1. Workflow 定义文件存在性与可索引性（AC-1, AC-2）

- [ ] cmd: test -f workflows/lightweight.json && test -f workflows/standard.json && test -f workflows/guarded.json
- [ ] cmd: node -e "const c=JSON.parse(require('fs').readFileSync('config.json','utf8')); const ids=c.workflows.items.map(i=>i.id); ['lightweight','standard','guarded'].forEach(n=>{if(!ids.includes(n)){console.error(n+' missing');process.exit(1)}})"
- [ ] cmd: node -e "const c=JSON.parse(require('fs').readFileSync('config.json','utf8')); c.workflows.items.forEach(i=>{const wf=JSON.parse(require('fs').readFileSync(i.path,'utf8')); if(!wf.pipeline||!wf.pipeline.length){console.error(i.id+' has no pipeline');process.exit(1)}})"
- [ ] cmd: node -e "const fs=require('fs'); const atomTasks=fs.readdirSync('atom-tasks').filter(d=>fs.statSync('atom-tasks/'+d).isDirectory()); const c=JSON.parse(fs.readFileSync('config.json','utf8')); c.workflows.items.forEach(item=>{const wf=JSON.parse(fs.readFileSync(item.path,'utf8')); wf.pipeline.forEach(s=>{if(s.atomTasks&&s.atomTasks.nodes){Object.keys(s.atomTasks.nodes).forEach(n=>{if(!atomTasks.includes(n)){console.error(item.id+': atom-task '+n+' not found');process.exit(1)}})}})})"

通过标准：3 个 workflow 文件存在，均可被 config.json 索引，且只引用现有 atom-task。

## G2. config.json 结构与 Schema 校验（AC-3, AC-8）

- [ ] cmd: node -e "const c=JSON.parse(require('fs').readFileSync('config.json','utf8')); if(!c.workflows){console.error('missing workflows');process.exit(1)} if(!c.workflows.default){console.error('missing default');process.exit(1)} if(!c.workflows.items||!c.workflows.items.length){console.error('missing items');process.exit(1)}"
- [ ] cmd: node -e "const c=JSON.parse(require('fs').readFileSync('config.json','utf8')); if(c.pipeline){console.error('old pipeline field still present');process.exit(1)}"
- [ ] cmd: node -e "const c=JSON.parse(require('fs').readFileSync('config.json','utf8')); const def=c.workflows.default; const ids=c.workflows.items.map(i=>i.id); if(!ids.includes(def)){console.error('default workflow not in items');process.exit(1)}}"
- [ ] cmd: node -e "const c=JSON.parse(require('fs').readFileSync('config.json','utf8')); if(c.workflows.selection&&c.workflows.selection.rules){const ids=c.workflows.items.map(i=>i.id); c.workflows.selection.rules.forEach(r=>{if(r.workflow&&!ids.includes(r.workflow)){console.error('rule references missing workflow: '+r.workflow);process.exit(1)}})}"
- [ ] cmd: node -e "const Ajv=require('ajv'); if(!Ajv){process.exit(0)} try{const s=JSON.parse(require('fs').readFileSync('config.schema.json','utf8')); const c=JSON.parse(require('fs').readFileSync('config.json','utf8')); const ajv=new Ajv(); const v=ajv.compile(s); if(!v(c)){console.error(JSON.stringify(v.errors,null,2));process.exit(1)}}catch(e){console.log('ajv not installed, skip')}"
- [ ] cmd: node -e "const fs=require('fs'); const c=JSON.parse(fs.readFileSync('config.json','utf8')); c.workflows.items.forEach(i=>{try{JSON.parse(fs.readFileSync(i.path,'utf8'))}catch(e){console.error(i.path+' parse failed: '+e.message);process.exit(1)}})"

通过标准：config.json 符合 v3 schema，无旧 pipeline 字段，默认 workflow 有效，selection 规则引用有效。

## G3. Workflow DAG 无环校验（AC-8）

- [ ] cmd: node -e "const fs=require('fs'); function hasCycle(nodes){const adj={};Object.entries(nodes).forEach(([k,v])=>{adj[k]=v.next||[]});const visited=new Set(),stack=new Set();function dfs(n){if(stack.has(n))return true;if(visited.has(n))return false;visited.add(n);stack.add(n);for(const m of(adj[n]||[])){if(dfs(m))return true}stack.delete(n);return false}return Object.keys(adj).some(dfs)} const c=JSON.parse(fs.readFileSync('config.json','utf8')); c.workflows.items.forEach(item=>{const wf=JSON.parse(fs.readFileSync(item.path,'utf8')); wf.pipeline.forEach(s=>{if(s.atomTasks&&s.atomTasks.nodes&&hasCycle(s.atomTasks.nodes)){console.error(item.id+'/'+s.stage+' has cycle');process.exit(1)}})})"

通过标准：所有 workflow 的所有 stage DAG 均无环。

## G4. Workflow 选择逻辑（AC-3 的运行时部分）

- [ ] cmd: node -e "const c=JSON.parse(require('fs').readFileSync('config.json','utf8')); const sel=c.workflows.selection; if(!sel||!sel.rules){console.error('no selection rules');process.exit(1)} if(!sel.argumentNames||!sel.argumentNames.length){console.error('no argumentNames');process.exit(1)}"
- [ ] cmd: node -e "const c=JSON.parse(require('fs').readFileSync('config.json','utf8')); const rules=c.workflows.selection.rules; const fallbacks=rules.filter(r=>r.fallback); if(fallbacks.length!==1){console.error('expected exactly 1 fallback rule, got '+fallbacks.length);process.exit(1)}}"
- [ ] cmd: grep -c 'workflowRules\|workflow.*mode.*profile\|显式参数.*分类规则.*默认' SKILL.md

通过标准：config.json 含有效 selection 结构（含 argumentNames、rules、唯一 fallback），SKILL.md 描述了选择算法。

## G5. 渐进式加载说明（AC-5）

- [ ] cmd: grep -c '渐进式\|progressive\|按.*stage.*读取\|进入.*atom-task.*前.*读取' SKILL.md
- [ ] cmd: grep -c '.state.json.*currentStage\|currentStage.*恢复\|恢复.*stage' SKILL.md
- [ ] cmd: grep -c 'outputSchemaRef\|io.inputs.*声明\|声明.*输入文件' SKILL.md

通过标准：SKILL.md 明确描述了渐进式加载逻辑：按 stage/node 读取、state 驱动恢复、按声明读取输入。

## G6. SKILL.md 配置驱动说明（AC-4, AC-5）

- [ ] cmd: grep -c 'config.json.*唯一事实\|唯一事实.*config.json\|唯一.*事实来源' SKILL.md
- [ ] cmd: grep -c 'workflow.*解析\|resolveWorkflow\|workflow.*选择' SKILL.md
- [ ] cmd: grep -c 'atomTaskOverrides.*合并\|workflow.*级.*优先\|override.*优先级' SKILL.md

通过标准：SKILL.md 以 config.json 为唯一事实来源，描述 workflow 解析、参数覆盖、规则匹配和默认回退逻辑。

## G7. UI Workflow 切换控件（AC-6, AC-7）

- [ ] cmd: grep -c 'workflow.*select\|workflow.*switch\|workflow.*切换\|panel__head.*workflow' ui/studio.js
- [ ] cmd: grep -c 'workflows.*items\|loadWorkflow\|renderWorkflow\|activeWorkflow' ui/studio.js
- [ ] human: 打开 Studio UI（浏览器 file:// 打开 ui/index.html），Open folder 选中 skill 根目录，在中间 topology 面板的 panel__head 区域确认存在 workflow 下拉切换控件
- [ ] human: 在 Studio UI 中切换 workflow（从 Standard 切换到 Lightweight 再切换到 Guarded），观察中间面板 DAG 预览随之变化
- [ ] human: 在 Studio UI 中确认当前 workflow 的基础信息（名称、描述）可见

通过标准：Studio UI 在 panel__head 提供 workflow 切换控件，切换后 DAG 预览正确更新，基础信息可见。

## G8. UI 保存一致性（AC-8）

- [ ] cmd: grep -c 'saveConfig\|saveWorkflow\|writeFile.*workflow\|persistWorkflow' ui/studio.js
- [ ] human: 在 Studio UI 中修改某个 workflow 的 atom-task 开关状态，点击 Save，重新打开 UI 确认修改已持久化到对应 workflow JSON 文件

通过标准：UI 保存逻辑将修改写入 config.json 和对应的 workflow JSON 文件，而非仅更新预览状态。

## 最终验证

- [ ] cmd: tail -n 1 verification.log | grep -q "ALL PASSED"
