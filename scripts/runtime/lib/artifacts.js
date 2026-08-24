'use strict';
const path = require('path');
const fs = require('fs');
const { readJson } = require('./json');
const { resolveProtocol } = require('./protocol');

// stdin 产出文本 → 落盘 + 返回 artifactRecord / historyEvent（由调用方经 applyMutation 持久化）。
function registerArtifact({ stdin, role, state, skillRoot, producer, stage }) {
  const catalog = readJson(path.join(skillRoot, 'atom-tasks', 'artifacts.json'));
  const roleDef = catalog.roles[role];
  if (!roleDef) throw Object.assign(new Error(`role "${role}" 未在 artifacts.json 登记`), { exitCode: 1 });
  if (!state.artifactDir) throw Object.assign(new Error('artifactDir 尚未可用（git-worktree 未完成）'), { exitCode: 1 });

  let relPath = roleDef.file;
  if (relPath === null) relPath = `${role}.${roleDef.kind === 'json' ? 'json' : 'md'}`;

  const absPath = path.join(path.resolve(state.artifactDir), relPath);
  if (roleDef.kind === 'dir' || relPath.endsWith('/')) {
    fs.mkdirSync(absPath, { recursive: true });
  } else {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, stdin || '', 'utf8');
  }

  const relToWorktree = path.relative(state.worktreePath || '', absPath).split(path.sep).join('/');
  const runRef = `run://${relToWorktree}`;
  const now = new Date().toISOString();
  const artifactRecord = { path: runRef, producer: producer || role, stage: stage || state.currentStage, at: now };
  const historyEvent = { event: 'node-done', at: now, stage: stage || state.currentStage, node: producer || role };
  return { path: runRef, absPath, artifactRecord, historyEvent };
}

// 按 outputSchemaRef 校验产物（json 校验 jsonFields，markdown 校验 required section）。
function validateOutput({ artifactPath, outputSchemaRef, skillRoot }) {
  const schemaPath = resolveProtocol(outputSchemaRef, { skillRoot });
  const outputSchema = readJson(schemaPath);
  const content = fs.readFileSync(artifactPath, 'utf8');
  const errors = [];

  if (outputSchema.outputFormat === 'json' || outputSchema.jsonFields) {
    let json;
    try { json = JSON.parse(content); } catch (e) {
      return { valid: false, errors: [`产物不是合法 JSON: ${e.message}`] };
    }
    for (const field of outputSchema.jsonFields || []) {
      if (field.required && !Object.prototype.hasOwnProperty.call(json, field.name)) {
        errors.push(`缺少必需字段 "${field.name}"`);
      } else if (field.type && Object.prototype.hasOwnProperty.call(json, field.name) && !matchesFieldType(field.type, json[field.name])) {
        errors.push(`字段 "${field.name}" 类型应为 ${JSON.stringify(field.type)}`);
      }
    }
  } else if (outputSchema.outputFormat === 'markdown' || outputSchema.sections) {
    for (const section of outputSchema.sections || []) {
      if (section.required && !hasSection(content, section.heading)) {
        errors.push(`缺少必需 section "${section.heading}"`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function matchesFieldType(t, value) {
  if (Array.isArray(t)) return t.some((x) => matchesFieldType(x, value));
  switch (t) {
    case 'string': return typeof value === 'string';
    case 'array': return Array.isArray(value);
    case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'integer': return typeof value === 'number' && Number.isInteger(value);
    case 'number': return typeof value === 'number';
    case 'boolean': return typeof value === 'boolean';
    case 'null': return value === null;
    default: return true;
  }
}

function hasSection(md, heading) {
  const staticHeading = String(heading).replace(/\\\./g, '.').replace(/\\/g, '').replace(/{{.*?}}/g, '').trim();
  if (!staticHeading) return true;
  const lines = md.split('\n');
  return lines.some((l) => {
    const m = l.match(/^#{1,6}\s+(.*)$/);
    return m && m[1].trim().startsWith(staticHeading);
  });
}

module.exports = { registerArtifact, validateOutput };
