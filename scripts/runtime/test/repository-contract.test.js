'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./_fixtures');
const { readJson } = require('../lib/json');
const { loadAtomTask } = require('../lib/atom-task');
const { loadWorkflow } = require('../lib/workflow');
const { validateOutputSchema, validateOutputContent } = require('../lib/output-validator');
const { buildFieldOwner } = require('../lib/state');
const { loadSkillMetadata } = require('../lib/skill-metadata');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

describe('仓库级 v5 契约', () => {
  const config = readJson(path.join(ROOT, 'config.default.json'));
  const catalog = readJson(path.join(ROOT, 'atom-tasks', 'artifacts.json'));

  it('workflow、taskRef、role 与 output schema 全部可解析', () => {
    for (const item of config.workflows.items) {
      assert.equal(fs.existsSync(path.join(ROOT, item.path)), true, item.path);
      const workflow = loadWorkflow(ROOT, item.path);
      assert.equal(workflow.id, item.id);
      for (const stage of workflow.pipeline) {
        assert.notEqual(stage.stage, 'done');
        for (const [nodeName, node] of Object.entries(stage.atomTasks.nodes)) {
          const task = loadAtomTask({ skillRoot: ROOT, taskName: node.taskRef || nodeName });
          for (const declaration of [...(task.frontmatter.produces || []), ...(task.frontmatter.consumes || [])]) {
            assert.ok(catalog.roles[declaration.role], `${task.name}: ${declaration.role}`);
          }
          if (task.frontmatter.outputSchemaRef) {
            const schemaPath = path.join(ROOT, task.frontmatter.outputSchemaRef.slice('skill://'.length));
            assert.equal(fs.existsSync(schemaPath), true, task.frontmatter.outputSchemaRef);
            const result = validateOutputSchema({ outputSchema: readJson(schemaPath), skillRoot: ROOT, schemaPath });
            assert.equal(result.valid, true, result.errors.join('\n'));
          }
        }
      }
    }
  });

  it('所有 output schema 的 meta 与示例通过校验', () => {
    for (const schemaPath of walk(path.join(ROOT, 'atom-tasks')).filter((file) => file.endsWith('.output.schema.json'))) {
      const schema = readJson(schemaPath);
      const meta = validateOutputSchema({ outputSchema: schema, skillRoot: ROOT, schemaPath });
      assert.equal(meta.valid, true, meta.errors.join('\n'));
      if (schema.example) {
        const ref = `skill://${path.relative(ROOT, schemaPath).split(path.sep).join('/')}`;
        const result = validateOutputContent({ content: schema.example, outputSchemaRef: ref, skillRoot: ROOT });
        assert.equal(result.valid, true, `${ref}\n${result.errors.join('\n')}`);
      }
    }
  });

  it('state writer、版本与衍生文档保持一致', () => {
    const stateSchema = readJson(path.join(ROOT, 'state.schema.json'));
    const owners = buildFieldOwner(stateSchema);
    assert.equal(Object.keys(owners).length, Object.keys(stateSchema.properties).length);
    const metadata = loadSkillMetadata(ROOT);
    assert.equal(config.version, metadata.version);
    assert.equal(catalog.version, metadata.version);
    const runtimeSource = fs.readFileSync(path.join(ROOT, 'scripts', 'runtime', 'ddo.js'), 'utf8');
    assert.match(runtimeSource, /loadSkillMetadata/);
    const docs = ['README.md', 'show_case.md'].map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n');
    for (const item of config.workflows.items) assert.match(docs, new RegExp(`\\b${item.id}\\b`));
  });

  it('已删除的 gate 业务产物在活动契约中没有残留', () => {
    const forbidden = ['gate', 'result'].join('-');
    const activeFiles = walk(ROOT).filter((file) => !file.includes(`${path.sep}.git${path.sep}`)
      && !file.includes(`${path.sep}.ddo${path.sep}runs${path.sep}`)
      && !file.includes(`${path.sep}docs${path.sep}change-logs${path.sep}`)
      && !file.includes(`${path.sep}eval${path.sep}`)
      && !file.endsWith('repository-contract.test.js'));
    for (const file of activeFiles) {
      if (!/\.(?:js|json|md)$/.test(file)) continue;
      assert.equal(fs.readFileSync(file, 'utf8').includes(forbidden), false, path.relative(ROOT, file));
    }
  });
});
