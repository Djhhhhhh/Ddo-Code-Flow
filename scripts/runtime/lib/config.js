'use strict';
const path = require('path');
const { readJson, readJsonIfExists } = require('./json');

// 深合并：对象递归合并、数组整体替换、标量替换。
function deepMerge(base, override) {
  if (override === undefined) return base === undefined ? undefined : base;
  if (Array.isArray(override)) return override;
  if (override === null) return null;
  if (typeof override !== 'object') return override;
  const out = base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {};
  for (const [k, v] of Object.entries(override)) {
    out[k] = deepMerge(out[k], v);
  }
  return out;
}

// 组合有效配置：config.default.json <- .ddo/config.json <- run 参数。仅内存，不落盘。
function composeConfig({ skillRoot, projectRoot, argsJson }) {
  const defaults = readJson(path.join(skillRoot, 'config.default.json'));
  const projectConfig = readJsonIfExists(path.join(projectRoot, '.ddo', 'config.json')) || {};
  let args = {};
  if (argsJson) args = JSON.parse(argsJson);
  return deepMerge(deepMerge(defaults, projectConfig), args);
}

module.exports = { deepMerge, composeConfig };
