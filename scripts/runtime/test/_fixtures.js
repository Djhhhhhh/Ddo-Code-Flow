'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-test-')); }

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function copy(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function makeSkillRoot({ tasks = {}, roles = {}, workflow, config }) {
  const root = tmp();
  copy(path.join(ROOT, 'config.schema.json'), path.join(root, 'config.schema.json'));
  copy(path.join(ROOT, 'state.schema.json'), path.join(root, 'state.schema.json'));
  copy(path.join(ROOT, 'atom-tasks', '_schema', 'atom-task-md.schema.json'), path.join(root, 'atom-tasks', '_schema', 'atom-task-md.schema.json'));
  copy(path.join(ROOT, 'atom-tasks', '_schema', 'output-schema.schema.json'), path.join(root, 'atom-tasks', '_schema', 'output-schema.schema.json'));
  for (const [name, task] of Object.entries(tasks)) {
    const markdown = task.md.replace(/^name:\s*t$/m, `name: ${name}`);
    write(path.join(root, 'atom-tasks', name, `${name}.md`), markdown);
  }
  write(path.join(root, 'atom-tasks', 'artifacts.json'), JSON.stringify({ version: '5.0.0', roles }, null, 2));
  const normalizedWorkflow = normalizeWorkflow(workflow);
  write(path.join(root, 'workflows', 'test.json'), JSON.stringify(normalizedWorkflow, null, 2));
  const defaults = config || {
    version: '5.0.0',
    base: {
      worktreeDir: '', defaultRunType: 'feat', contextPaths: [], contextOptional: true,
      respGenerator: { maxLength: 64, case: 'kebab', stripStopwords: true },
      metrics: { enabled: false, provider: 'tokscale', failurePolicy: 'warn', report: { enabled: false, path: 'x' }, pricing: { model: '', inputPerMillionUsd: 0, outputPerMillionUsd: 0 } },
    },
    workflows: {
      default: 'test', selection: { allowUserOverride: true, argumentNames: ['model'], rules: [{ workflow: 'test', fallback: true }] },
      items: [{ id: 'test', name: 'Test', path: 'workflows/test.json' }],
    },
    atomTaskOverrides: {},
  };
  write(path.join(root, 'config.default.json'), JSON.stringify(defaults, null, 2));
  return root;
}

function normalizeWorkflow(workflow = {}) {
  const normalized = {
    id: workflow.id || 'test', version: workflow.version || '1.0.0', name: workflow.name || 'Test',
    confirmationGates: workflow.confirmationGates || [], atomTaskOverrides: workflow.atomTaskOverrides || {},
    pipeline: (workflow.pipeline || []).map((stage) => ({
      description: stage.description || stage.stage,
      enabled: stage.enabled !== false,
      ...stage,
      atomTasks: {
        entry: (stage.atomTasks && stage.atomTasks.entry) || [],
        nodes: Object.fromEntries(Object.entries((stage.atomTasks && stage.atomTasks.nodes) || {}).map(([name, node]) => [name, {
          next: node.next || [], parallelApprove: node.parallelApprove || false, parallelWith: node.parallelWith || [], ...node,
        }])),
      },
    })),
  };
  return normalized;
}

function taskMd({ produces = [], consumes = [], options = [], body = '指令正文' } = {}) {
  const lines = ['---', 'name: t', 'version: "5.0.0"', 'enabled: true', 'timeoutSec: 0', 'concurrency:', '  parallelizable: false', 'confirmation:', '  rejectAction: abort'];
  lines.push(consumes.length ? 'consumes:' : 'consumes: []');
  for (const item of consumes) {
    lines.push(`  - role: ${item.role}`, `    required: ${item.required === true}`);
  }
  lines.push(produces.length ? 'produces:' : 'produces: []');
  for (const item of produces) {
    lines.push(`  - role: ${item.role}`, `    kind: ${item.kind || 'markdown'}`);
    if (item.primary) lines.push('    primary: true');
  }
  if (options.length) {
    lines.push('options:');
    for (const item of options) {
      lines.push(`  - key: ${item.key}`, `    type: ${item.type || 'string'}`);
      if (item.enum) {
        lines.push('    enum:');
        for (const value of item.enum) lines.push(`      - ${serializeYaml(value)}`);
      }
      if (item.items) lines.push('    items:', `      type: ${item.items.type}`);
      if (Array.isArray(item.default) && item.default.length) {
        lines.push('    default:');
        for (const value of item.default) lines.push(`      - ${serializeYaml(value)}`);
      } else {
        lines.push(`    default: ${serializeYaml(item.default)}`);
      }
      lines.push(`    label: "${item.label || item.key}"`, `    description: "${item.description || item.key}"`);
    }
  }
  lines.push('---', '', body);
  return lines.join('\n');
}

function serializeYaml(value) {
  if (value === undefined) return '""';
  if (Array.isArray(value) && value.length === 0) return '[]';
  if (value && typeof value === 'object' && Object.keys(value).length === 0) return '{}';
  return JSON.stringify(value);
}

module.exports = { ROOT, tmp, write, copy, makeSkillRoot, normalizeWorkflow, taskMd };
