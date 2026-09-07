'use strict';
const fs = require('fs');
const path = require('path');
const { readJson } = require('./json');
const { validate } = require('./jsonschema');
const { splitFrontmatter } = require('./frontmatter');

function loadAtomTask({ skillRoot, taskName }) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(taskName || '')) throw failure(`非法 atom-task 名称: ${taskName}`);
  const filePath = path.resolve(skillRoot, 'atom-tasks', taskName, `${taskName}.md`);
  if (!fs.existsSync(filePath)) throw failure(`找不到 atom-task "${taskName}": ${filePath}`);
  const markdown = fs.readFileSync(filePath, 'utf8');
  const parsed = splitFrontmatter(markdown, { source: filePath });
  if (!parsed) throw failure(`${filePath}: 缺少 YAML frontmatter`);

  const schemaPath = path.resolve(skillRoot, 'atom-tasks', '_schema', 'atom-task-md.schema.json');
  if (!fs.existsSync(schemaPath)) throw failure(`缺少 atom-task schema: ${schemaPath}`);
  const result = validate(readJson(schemaPath), parsed.frontmatter);
  if (!result.valid) throw failure(`${filePath}: atom-task schema 校验失败\n${result.errors.join('\n')}`);
  validateAtomTaskIdentity({ taskName, filePath, frontmatter: parsed.frontmatter });
  return { name: taskName, filePath, markdown, frontmatter: parsed.frontmatter, instructionBody: parsed.instructionBody };
}

function validateAtomTaskIdentity({ taskName, filePath, frontmatter }) {
  const directoryName = path.basename(path.dirname(filePath));
  const fileName = path.basename(filePath, path.extname(filePath));
  if (directoryName !== taskName || fileName !== taskName || frontmatter.name !== taskName) {
    throw failure(`${filePath}: taskName、目录名、文件名和 frontmatter.name 必须一致（期望 ${taskName}，实际 ${frontmatter.name}）`);
  }
  for (const key of ['produces', 'consumes']) {
    const roles = (frontmatter[key] || []).map((item) => item.role);
    if (new Set(roles).size !== roles.length) throw failure(`${filePath}: ${key} 中存在重复 role`);
  }
  if ((frontmatter.produces || []).filter((item) => item.primary === true).length > 1) {
    throw failure(`${filePath}: produces 中最多允许一个 primary:true`);
  }
  const primaryCount = (frontmatter.produces || []).filter((item) => item.primary === true).length;
  if (frontmatter.outputSchemaRef && primaryCount !== 1) throw failure(`${filePath}: 声明 outputSchemaRef 时必须恰有一个 primary:true 产物`);
  const optionKeys = new Set();
  for (const option of frontmatter.options || []) {
    if (optionKeys.has(option.key)) throw failure(`${filePath}: options 中存在重复 key ${option.key}`);
    optionKeys.add(option.key);
    if (!matchesType(option.type, option.default)) throw failure(`${filePath}: option ${option.key} 的 default 不符合 ${option.type}`);
    if (option.enum && !option.enum.includes(option.default)) throw failure(`${filePath}: option ${option.key} 的 default 不在 enum 中`);
    if (option.type === 'array' && option.items && option.items.type) {
      for (const item of option.default) if (!matchesType(option.items.type, item)) throw failure(`${filePath}: option ${option.key} 的数组项不符合 ${option.items.type}`);
    }
  }
}

function matchesType(type, value) {
  if (type === 'array') return Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

function failure(message) {
  return Object.assign(new Error(message), { exitCode: 1 });
}

module.exports = { loadAtomTask, validateAtomTaskIdentity };
