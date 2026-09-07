'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { ROOT, tmp, write } = require('./_fixtures');
const { validateOutput, validateOutputContent } = require('../lib/output-validator');

function schemaFile(schema) {
  const directory = tmp();
  const file = path.join(directory, 'schema.json');
  write(file, JSON.stringify(schema));
  return file;
}

function baseSchema(overrides) {
  return {
    description: '测试 schema',
    outputFormat: 'markdown',
    document: { title: '测试', titleFormat: '固定文本', description: '测试' },
    sections: [],
    ...overrides,
  };
}

describe('output validator', () => {
  it('先拒绝非法 output schema 自身', () => {
    const file = schemaFile({ outputFormat: 'bogus' });
    const result = validateOutputContent({ content: 'x', outputSchemaRef: file, skillRoot: ROOT });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes('schema.json')));
  });
  it('校验 JSON required/type/nested/enum/pattern/date-time', () => {
    const schema = baseSchema({
      outputFormat: 'json',
      jsonFields: [
        { name: 'status', type: 'string', required: true, description: '状态', enum: ['ok'] },
        { name: 'at', type: 'string', required: true, description: '时间', format: 'date-time' },
        { name: 'items', type: 'array', required: true, description: '项目', items: { type: 'string', pattern: '^x' } },
      ],
    });
    const good = validateOutputContent({ content: JSON.stringify({ status: 'ok', at: '2026-08-29T00:00:00Z', items: ['x1'] }), outputSchemaRef: schemaFile(schema), skillRoot: ROOT });
    assert.equal(good.valid, true, good.errors.join('\n'));
    const bad = validateOutputContent({ content: JSON.stringify({ status: 'bad', at: 'no', items: ['a'] }), outputSchemaRef: schemaFile(schema), skillRoot: ROOT });
    assert.equal(bad.valid, false);
    assert.ok(bad.errors.length >= 3);
  });
  it('Markdown heading level、subsection 与非空正文严格匹配', () => {
    const schema = baseSchema({ sections: [{ heading: '主节', level: 2, required: true, format: 'group', subsections: [{ heading: '子节', level: 3, required: true, format: 'text' }] }] });
    const file = schemaFile(schema);
    assert.equal(validateOutputContent({ content: '# 测试\n\n## 主节\n\n内容\n\n### 子节\n\n正文', outputSchemaRef: file, skillRoot: ROOT }).valid, true);
    assert.equal(validateOutputContent({ content: '# 测试\n\n### 主节\n\n正文', outputSchemaRef: file, skillRoot: ROOT }).valid, false);
    assert.equal(validateOutputContent({ content: '# 测试\n\n## 主节\n', outputSchemaRef: file, skillRoot: ROOT }).valid, false);
    assert.equal(validateOutputContent({ content: '# 错误标题\n\n## 主节\n\n正文\n\n### 子节\n\n正文', outputSchemaRef: file, skillRoot: ROOT }).valid, false);
  });
  it('字符串形式的 subsection 也会递归校验', () => {
    const schema = baseSchema({ sections: [{ heading: '主节', level: 2, required: true, format: 'group', subsections: ['子节'] }] });
    const file = schemaFile(schema);
    assert.equal(validateOutputContent({ content: '# 测试\n\n## 主节\n\n正文', outputSchemaRef: file, skillRoot: ROOT }).valid, false);
    assert.equal(validateOutputContent({ content: '# 测试\n\n## 主节\n\n正文\n\n### 子节\n\n正文', outputSchemaRef: file, skillRoot: ROOT }).valid, true);
  });
  it('verification 阻止虚假 ALL PASSED', () => {
    const schema = path.join(ROOT, 'atom-tasks', 'verification', 'verification.output.schema.json');
    const content = '# 验证日志\n\n## G1. X\n\n### 执行结果\n\n- [FAIL] x\n\n### 组摘要\n\nGROUP G1 FAILED: 1 failing\n\n## 最终结果\n\nALL PASSED';
    const result = validateOutputContent({ content, outputSchemaRef: schema, skillRoot: ROOT });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes('ALL PASSED')));
  });
  it('task-group 拒绝坏依赖、环和批次重复', () => {
    const schema = path.join(ROOT, 'atom-tasks', 'tasking', 'task-group.output.schema.json');
    const data = { version: '1.0.0', tasks: [{ id: 'task-01', file: 'task-01.md', title: 'a', dependsOn: ['task-02'] }, { id: 'task-02', file: 'task-02.md', title: 'b', dependsOn: ['task-01'] }], parallelGroups: [['task-01'], ['task-01']] };
    const result = validateOutputContent({ content: JSON.stringify(data), outputSchemaRef: schema, skillRoot: ROOT });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes('环')));
    assert.ok(result.errors.some((error) => error.includes('恰好覆盖')));
  });
  it('worktree-info 拒绝相对路径', () => {
    const schema = path.join(ROOT, 'atom-tasks', 'git-worktree', 'worktree-info.output.schema.json');
    const data = { runId: 'x', branchName: 'feat/x', worktreePath: 'relative', worktreeDir: 'relative', type: 'feat', dateDescription: '2026-08-29-x', baseRef: 'main', createdAt: '2026-08-29T00:00:00Z' };
    const result = validateOutputContent({ content: JSON.stringify(data), outputSchemaRef: schema, skillRoot: ROOT });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes('绝对路径')));
  });
  it('validateOutput 读取文件', () => {
    const directory = tmp();
    const artifact = path.join(directory, 'out.md');
    write(artifact, '# 测试\n\n## A\n\n正文');
    const schema = schemaFile(baseSchema({ sections: [{ heading: 'A', level: 2, required: true, format: 'text' }] }));
    assert.equal(validateOutput({ artifactPath: artifact, outputSchemaRef: schema, skillRoot: ROOT }).valid, true);
  });
  it('text 输出只要求非空，不要求 Markdown 标题', () => {
    const schema = schemaFile(baseSchema({ outputFormat: 'text' }));
    assert.equal(validateOutputContent({ content: 'plain log', outputSchemaRef: schema, skillRoot: ROOT }).valid, true);
    assert.equal(validateOutputContent({ content: '  \n', outputSchemaRef: schema, skillRoot: ROOT }).valid, false);
  });
});
