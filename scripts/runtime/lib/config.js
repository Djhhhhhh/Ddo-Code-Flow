'use strict';
const path = require('path');
const { readJson, readJsonIfExists } = require('./json');
const { validate } = require('./jsonschema');

const RUN_SELECTION_KEYS = new Set(['ctx', 'context', 'model', 'feature', 'bugfix', 'atom', 'issueRef', 'issueNumber', 'repo', 'text']);
const CONFIG_OVERRIDE_KEYS = new Set(['base', 'workflows', 'atomTaskOverrides']);

function deepMerge(base, override) {
  if (override === undefined) return clone(base);
  if (Array.isArray(override)) return clone(override);
  if (override === null || typeof override !== 'object') return override;
  const out = base && typeof base === 'object' && !Array.isArray(base) ? clone(base) : {};
  for (const [key, value] of Object.entries(override)) out[key] = deepMerge(out[key], value);
  return out;
}

function composeConfig({ skillRoot, projectRoot, argsJson }) {
  const schema = readJson(path.join(skillRoot, 'config.schema.json'));
  const defaults = readJson(path.join(skillRoot, 'config.default.json'));
  assertValid('config.default.json', schema, defaults);

  const projectPath = path.join(projectRoot, '.ddo', 'config.json');
  const projectConfig = readJsonIfExists(projectPath) || {};
  validateProjectConfig(projectConfig, schema, projectPath);
  const normalizedProject = normalizeProjectConfig(projectConfig);

  let runArgs = {};
  if (argsJson) {
    try { runArgs = JSON.parse(argsJson); } catch (error) {
      throw usageError(`--args-json 不是合法 JSON: ${error.message}`);
    }
  }
  const runOverrides = normalizeRunConfigOverrides(runArgs);
  const effective = deepMerge(deepMerge(defaults, normalizedProject), runOverrides);
  assertValid('effective config', schema, effective);
  return effective;
}

function normalizeProjectConfig(projectConfig) {
  const baseKeys = ['worktreeDir', 'defaultRunType', 'contextPaths', 'contextOptional', 'respGenerator', 'metrics'];
  const base = {};
  for (const key of baseKeys) if (Object.prototype.hasOwnProperty.call(projectConfig, key)) base[key] = projectConfig[key];
  const normalized = {};
  if (Object.keys(base).length) normalized.base = base;
  if (projectConfig.atomTaskOverrides) normalized.atomTaskOverrides = projectConfig.atomTaskOverrides;
  return normalized;
}

function normalizeRunConfigOverrides(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw usageError('run args 必须是 JSON object');
  const overrides = {};
  for (const [key, value] of Object.entries(args)) {
    if (RUN_SELECTION_KEYS.has(key)) continue;
    if (key === 'configOverrides') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw usageError('configOverrides 必须是 object');
      for (const nestedKey of Object.keys(value)) {
        if (!CONFIG_OVERRIDE_KEYS.has(nestedKey)) throw usageError(`未知配置 override: ${nestedKey}`);
      }
      Object.assign(overrides, value);
      continue;
    }
    if (!CONFIG_OVERRIDE_KEYS.has(key)) throw usageError(`未知 run 参数: ${key}`);
    overrides[key] = value;
  }
  return overrides;
}

function validateProjectConfig(projectConfig, schema, source = '.ddo/config.json') {
  const projectSchema = { ...schema.$defs.projectConfig, $defs: schema.$defs };
  assertValid(source, projectSchema, projectConfig);
}

function assertValid(label, schema, value) {
  const result = validate(schema, value);
  if (!result.valid) throw Object.assign(new Error(`${label} 校验失败:\n${result.errors.join('\n')}`), { exitCode: 1 });
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function usageError(message) {
  return Object.assign(new Error(message), { exitCode: 2 });
}

module.exports = {
  deepMerge,
  composeConfig,
  normalizeProjectConfig,
  normalizeRunConfigOverrides,
  validateProjectConfig,
};
