'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

// 仓库根即 skillRoot。
const ROOT = path.resolve(__dirname, '../../..');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-test-'));
}

function write(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
}

// 构造最小 skillRoot：atom-tasks/*.md + artifacts.json + workflows/test.json。
function makeSkillRoot({ tasks = {}, roles = {}, workflow }) {
  const root = tmp();
  for (const [name, t] of Object.entries(tasks)) {
    write(path.join(root, 'atom-tasks', name, `${name}.md`), t.md);
  }
  write(path.join(root, 'atom-tasks', 'artifacts.json'), JSON.stringify({ version: '4.0.0', roles }, null, 2));
  write(path.join(root, 'workflows', 'test.json'), JSON.stringify(workflow, null, 2));
  return root;
}

// 简单 atom-task .md：frontmatter + body（body 可含 {{inputs.*}}）。
function taskMd({ produces = [], consumes = [], options = [], body = '指令正文' }) {
  const lines = ['---'];
  lines.push('name: t');
  lines.push('version: 1.0.0');
  lines.push('enabled: true');
  if (produces.length) {
    lines.push('produces:');
    for (const p of produces) {
      lines.push(`  - role: ${p.role}`);
      if (p.primary) lines.push('    primary: true');
    }
  }
  if (consumes.length) {
    lines.push('consumes:');
    for (const c of consumes) {
      lines.push(`  - role: ${c.role}`);
      if (c.required) lines.push('    required: true');
    }
  }
  if (options.length) {
    lines.push('options:');
    for (const o of options) {
      lines.push(`  - key: ${o.key}`);
      if (o.default !== undefined) lines.push(`    default: ${o.default}`);
    }
  }
  lines.push('---');
  lines.push('');
  lines.push(body);
  return lines.join('\n');
}

module.exports = { ROOT, tmp, write, makeSkillRoot, taskMd };
