'use strict';
const fs = require('fs');
const path = require('path');
const { readJson } = require('./json');
const { validate } = require('./jsonschema');
const { resolveProtocol } = require('./protocol');

const VALIDATORS = {
  'task-group': validateTaskGroup,
  'worktree-info': validateWorktreeInfo,
  'verification-final-result': validateVerificationFinalResult,
  'verification-group-summary': validateVerificationGroupSummary,
  'code-change-manifest': validateCodeChangeManifest,
};

function validateOutput({ artifactPath, outputSchemaRef, skillRoot }) {
  const content = fs.readFileSync(artifactPath, 'utf8');
  return validateOutputContent({ content, outputSchemaRef, skillRoot });
}

function validateOutputContent({ content, outputSchemaRef, skillRoot }) {
  const schemaPath = resolveProtocol(outputSchemaRef, { skillRoot });
  const outputSchema = readJson(schemaPath);
  const metaResult = validateOutputSchema({ outputSchema, skillRoot, schemaPath });
  if (!metaResult.valid) return metaResult;
  const errors = [];
  let parsedJson = null;
  if (outputSchema.outputFormat === 'json') {
    try { parsedJson = JSON.parse(content); } catch (error) {
      return { valid: false, errors: [`产物不是合法 JSON: ${error.message}`] };
    }
    validateJsonFields(outputSchema.jsonFields || [], parsedJson, errors);
  }
  if (outputSchema.outputFormat === 'markdown') validateMarkdown(outputSchema, content, errors);
  if (outputSchema.outputFormat === 'text' && !content.trim()) errors.push('text 产物不能为空');
  for (const entry of outputSchema.validators || []) {
    const validator = VALIDATORS[entry.name];
    if (!validator) errors.push(`未知 output validator: ${entry.name}`);
    else validator({ content, data: parsedJson, schema: outputSchema, errors });
  }
  return { valid: errors.length === 0, errors };
}

function validateOutputSchema({ outputSchema, skillRoot, schemaPath = '<output-schema>' }) {
  const metaPath = path.join(skillRoot, 'atom-tasks', '_schema', 'output-schema.schema.json');
  const result = validate(readJson(metaPath), outputSchema);
  return result.valid ? result : { valid: false, errors: result.errors.map((error) => `${schemaPath}: ${error}`) };
}

function validateJsonFields(fields, data, errors) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push('JSON 产物顶层必须是 object');
    return;
  }
  for (const field of fields) {
    const exists = Object.prototype.hasOwnProperty.call(data, field.name);
    if (field.required && !exists) { errors.push(`缺少必需字段 "${field.name}"`); continue; }
    if (!exists) continue;
    validateJsonValue(field, data[field.name], `$.${field.name}`, errors);
  }
}

function validateJsonValue(schema, value, fieldPath, errors) {
  if (schema.type && !matchesType(schema.type, value)) errors.push(`${fieldPath} 类型应为 ${schema.type}`);
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${fieldPath} 长度小于 ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${fieldPath} 不匹配 pattern ${schema.pattern}`);
    if (schema.format === 'date-time' && Number.isNaN(Date.parse(value))) errors.push(`${fieldPath} 不是合法 date-time`);
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${fieldPath} 不在 enum 中`);
  if (Array.isArray(value) && schema.items) value.forEach((item, index) => validateJsonValue(schema.items, item, `${fieldPath}[${index}]`, errors));
  if (value && typeof value === 'object' && !Array.isArray(value) && schema.properties) {
    for (const required of schema.required || []) if (!Object.prototype.hasOwnProperty.call(value, required)) errors.push(`${fieldPath} 缺少 ${required}`);
    for (const [key, childSchema] of Object.entries(schema.properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) validateJsonValue(childSchema, value[key], `${fieldPath}.${key}`, errors);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!Object.prototype.hasOwnProperty.call(schema.properties, key)) errors.push(`${fieldPath} 不允许额外字段 ${key}`);
    }
  }
}

function validateMarkdown(schema, content, errors) {
  const headings = parseHeadings(content);
  const title = schema.document && schema.document.title;
  const documentTitle = headings.find((heading) => heading.level === 1);
  if (!documentTitle) errors.push('缺少 level 1 document title');
  else if (schema.document.titleFormat === '固定文本' && title && !headingPattern(title).test(documentTitle.text)) {
    errors.push(`document title 应为 "${title}"`);
  }
  validateSections(schema.sections || [], headings, content, 0, content.length, errors);
}

function validateSections(sections, headings, content, start, end, errors) {
  const normalized = sections.map((section) => normalizeSection(section));
  for (const section of normalized) validateSection(section, normalized, headings, content, start, end, errors);
}

function validateSection(section, siblings, headings, content, start, end, errors) {
  const reserved = siblings
    .filter((candidate) => candidate !== section && candidate.level === section.level && !hasTemplate(candidate.heading))
    .map((candidate) => headingPattern(candidate.heading));
  const matches = headings.filter((heading) => heading.start >= start && heading.start < end
    && heading.level === section.level
    && headingPattern(section.heading).test(heading.text)
    && (!hasTemplate(section.heading) || !reserved.some((pattern) => pattern.test(heading.text))));
  if (section.required && matches.length === 0) {
    errors.push(`缺少 level ${section.level} section "${section.heading}"`);
    return;
  }
  for (const match of matches) {
    const bodyEnd = nextBoundary(headings, match, end);
    const body = content.slice(match.lineEnd, bodyEnd).trim();
    if (section.required && body.length === 0) errors.push(`section "${match.text}" 正文为空`);
    validateSections(section.subsections || [], headings, content, match.lineEnd, bodyEnd, errors);
  }
}

function normalizeSection(section, parentLevel = 2) {
  if (typeof section === 'string') return { heading: section, level: Math.min(parentLevel + 1, 6), required: true, subsections: [] };
  const normalized = { ...section };
  normalized.subsections = (section.subsections || []).map((child) => normalizeSection(child, section.level));
  return normalized;
}

function hasTemplate(heading) { return /{{\s*[^}]+\s*}}/.test(String(heading)); }

function parseHeadings(content) {
  const headings = [];
  const pattern = /^(#{1,6})[ \t]+(.+?)[ \t]*$/gm;
  let match;
  while ((match = pattern.exec(content))) {
    headings.push({ level: match[1].length, text: match[2].trim(), start: match.index, lineEnd: pattern.lastIndex });
  }
  return headings;
}

function nextBoundary(headings, current, fallback) {
  const next = headings.find((heading) => heading.start > current.start && heading.level <= current.level);
  return next ? next.start : fallback;
}

function headingPattern(template) {
  const token = /{{\s*[^}]+\s*}}/g;
  let source = '';
  let index = 0;
  for (const match of String(template).matchAll(token)) {
    source += escapeRegex(String(template).slice(index, match.index).replace(/\\(.)/g, '$1')) + '.+?';
    index = match.index + match[0].length;
  }
  source += escapeRegex(String(template).slice(index).replace(/\\(.)/g, '$1'));
  return new RegExp(`^${source}$`);
}

function validateTaskGroup({ data, errors }) {
  if (!data || !Array.isArray(data.tasks)) return;
  const ids = data.tasks.map((task) => task.id);
  if (new Set(ids).size !== ids.length) errors.push('task-group: task id 必须唯一');
  const idSet = new Set(ids);
  for (const task of data.tasks) {
    if (!/^task-\d{2}$/.test(task.id || '')) errors.push(`task-group: 非法 task id ${task.id}`);
    if (task.file !== `${task.id}.md`) errors.push(`task-group: ${task.id} 的 file 必须是 ${task.id}.md`);
    for (const dependency of task.dependsOn || []) if (!idSet.has(dependency)) errors.push(`task-group: ${task.id} 依赖不存在的 ${dependency}`);
  }
  if (hasCycle(data.tasks)) errors.push('task-group: dependsOn 存在环');
  if (data.parallelGroups) {
    const flattened = data.parallelGroups.flat();
    if (flattened.length !== ids.length || new Set(flattened).size !== ids.length || flattened.some((id) => !idSet.has(id))) {
      errors.push('task-group: parallelGroups 必须恰好覆盖每个 task 一次');
    }
  }
}

function hasCycle(tasks) {
  const dependencies = new Map(tasks.map((task) => [task.id, task.dependsOn || []]));
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dependency of dependencies.get(id) || []) if (dependencies.has(dependency) && visit(dependency)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  return [...dependencies.keys()].some(visit);
}

function validateWorktreeInfo({ data, errors }) {
  if (!data) return;
  if (!path.isAbsolute(data.worktreePath || '')) errors.push('worktree-info: worktreePath 必须是绝对路径');
  if (!path.isAbsolute(data.worktreeDir || '')) errors.push('worktree-info: worktreeDir 必须是绝对路径');
  if (!['feat', 'fix'].includes(data.type)) errors.push('worktree-info: type 必须是 feat 或 fix');
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*$/.test(data.dateDescription || '')) errors.push('worktree-info: dateDescription 格式非法');
  if (Number.isNaN(Date.parse(data.createdAt || ''))) errors.push('worktree-info: createdAt 不是 date-time');
}

function validateVerificationFinalResult({ content, errors }) {
  const allPassed = /(^|\n)ALL PASSED\s*($|\n)/.test(content);
  if (allPassed && /\[FAIL\]/.test(content)) errors.push('verification: 存在 FAIL 时不得写 ALL PASSED');
  if (allPassed && /^\s*[-*]\s+(?!\[(?:PASS|FAIL)\]).*human:/mi.test(content)) errors.push('verification: 人工检查未确认时不得写 ALL PASSED');
}

function validateVerificationGroupSummary({ content, errors }) {
  const groups = [...content.matchAll(/^##\s+G(\d+)\./gm)].map((match) => match[1]);
  for (const group of groups) if (!new RegExp(`GROUP G${group} (?:PASSED|FAILED: \\d+ failing)`).test(content)) errors.push(`verification: G${group} 缺少合法组摘要`);
}

function validateCodeChangeManifest({ data, errors }) {
  if (!data || !Array.isArray(data.files)) return;
  for (const file of data.files) {
    if (typeof file !== 'string' || path.isAbsolute(file) || file.split(/[\\/]/).includes('..')) errors.push(`code-change: files 必须是仓库相对路径: ${file}`);
  }
}

function matchesType(type, value) {
  if (Array.isArray(type)) return type.some((entry) => matchesType(entry, value));
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'null') return value === null;
  return typeof value === type;
}

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

module.exports = { validateOutput, validateOutputContent, validateOutputSchema, headingPattern };
