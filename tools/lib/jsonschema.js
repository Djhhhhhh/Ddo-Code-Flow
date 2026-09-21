'use strict';
// 最小 draft-2020-12 子集校验器（零依赖）。
// 覆盖本仓库 schema 实际用到的关键字；未知关键字忽略，以保证对现有 schema 全部放行。

const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function validate(schema, data) {
  const errors = [];
  validateNode(schema, data, schema, '#', errors);
  return { valid: errors.length === 0, errors };
}

function validateNode(schema, data, root, path, errors) {
  if (schema === true) return;
  if (schema === false) {
    errors.push(`${path}: schema 为 false（不允许）`);
    return;
  }
  if (typeof schema !== 'object' || schema === null) return;

  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, root);
    if (!resolved) errors.push(`${path}: 无法解析 $ref ${schema.$ref}`);
    else validateNode(resolved, data, root, path, errors);
    return;
  }
  if (schema.oneOf) {
    const matched = schema.oneOf.some((sub) => {
      const subErrors = [];
      validateNode(sub, data, root, path, subErrors);
      return subErrors.length === 0;
    });
    if (!matched) errors.push(`${path}: 不匹配 oneOf 任一分支`);
    return;
  }
  if (schema.anyOf) {
    const matched = schema.anyOf.some((sub) => {
      const subErrors = [];
      validateNode(sub, data, root, path, subErrors);
      return subErrors.length === 0;
    });
    if (!matched) errors.push(`${path}: 不匹配 anyOf 任一分支`);
    return;
  }
  if (schema.allOf) {
    for (const sub of schema.allOf) validateNode(sub, data, root, path, errors);
    return;
  }

  if (Object.prototype.hasOwnProperty.call(schema, 'const') && data !== schema.const) {
    errors.push(`${path}: 期望 const ${JSON.stringify(schema.const)}`);
  }
  if (Object.prototype.hasOwnProperty.call(schema, 'enum') && !schema.enum.includes(data)) {
    errors.push(`${path}: 不在 enum 中`);
  }

  if (schema.type) checkType(schema.type, data, path, errors);

  if (data === null || data === undefined) return;

  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) errors.push(`${path}: 短于 minLength ${schema.minLength}`);
    if (schema.maxLength !== undefined && data.length > schema.maxLength) errors.push(`${path}: 长于 maxLength ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) errors.push(`${path}: 不匹配 pattern ${schema.pattern}`);
    if (schema.format === 'date-time' && !DATE_TIME_RE.test(data)) errors.push(`${path}: 非 date-time 格式`);
    return;
  }
  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) errors.push(`${path}: 低于 minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && data > schema.maximum) errors.push(`${path}: 高于 maximum ${schema.maximum}`);
    return;
  }
  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) errors.push(`${path}: 少于 minItems ${schema.minItems}`);
    if (schema.maxItems !== undefined && data.length > schema.maxItems) errors.push(`${path}: 多于 maxItems ${schema.maxItems}`);
    if (schema.uniqueItems === true) {
      const seen = new Set(data.map((x) => JSON.stringify(x)));
      if (seen.size !== data.length) errors.push(`${path}: 存在重复项`);
    }
    if (schema.items) {
      if (Array.isArray(schema.items)) {
        schema.items.forEach((sub, idx) => {
          if (idx < data.length) validateNode(sub, data[idx], root, `${path}[${idx}]`, errors);
        });
      } else {
        data.forEach((item, idx) => validateNode(schema.items, item, root, `${path}[${idx}]`, errors));
      }
    }
    return;
  }
  if (typeof data === 'object') {
    if (schema.minProperties !== undefined) {
      const n = Object.keys(data).length;
      if (n < schema.minProperties) errors.push(`${path}: 少于 minProperties ${schema.minProperties}`);
    }
    if (schema.required) {
      for (const key of schema.required) {
        if (!Object.prototype.hasOwnProperty.call(data, key)) errors.push(`${path}: 缺少 required "${key}"`);
      }
    }
    if (schema.properties) {
      for (const [key, sub] of Object.entries(schema.properties)) {
        if (Object.prototype.hasOwnProperty.call(data, key)) validateNode(sub, data[key], root, `${path}.${key}`, errors);
      }
    }
    if (schema.additionalProperties !== undefined) {
      const declared = schema.properties ? Object.keys(schema.properties) : [];
      for (const key of Object.keys(data)) {
        if (declared.includes(key)) continue;
        if (schema.additionalProperties === false) errors.push(`${path}: 额外的属性 "${key}" 不允许`);
        else if (typeof schema.additionalProperties === 'object') validateNode(schema.additionalProperties, data[key], root, `${path}.${key}`, errors);
      }
    }
    return;
  }
}

function checkType(t, data, path, errors) {
  const types = Array.isArray(t) ? t : [t];
  const ok = types.some((tt) => matchesType(tt, data));
  if (!ok) errors.push(`${path}: 期望类型 ${JSON.stringify(t)}，实际 ${typeOf(data)}`);
}

function matchesType(t, data) {
  switch (t) {
    case 'null': return data === null;
    case 'string': return typeof data === 'string';
    case 'number': return typeof data === 'number';
    case 'integer': return typeof data === 'number' && Number.isInteger(data);
    case 'boolean': return typeof data === 'boolean';
    case 'object': return typeof data === 'object' && data !== null && !Array.isArray(data);
    case 'array': return Array.isArray(data);
    default: return true; // 未知类型忽略
  }
}

function typeOf(data) {
  if (data === null) return 'null';
  if (Array.isArray(data)) return 'array';
  return typeof data;
}

function resolveRef(ref, root) {
  if (!ref.startsWith('#')) return null;
  let cur = root;
  const parts = ref.slice(1).split('/').filter(Boolean).map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  for (const p of parts) {
    if (cur && typeof cur === 'object' && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
    else return null;
  }
  return cur;
}

module.exports = { validate };
