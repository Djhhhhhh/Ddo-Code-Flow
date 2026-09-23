'use strict';
// .output.schema.json 驱动的产出规范化（05 plan v1.2）：
// 加载（含 meta-schema 校验）→ 渲染 md 产出契约（生成侧注入）→ 硬校验产物（稳定性）。
// 沿用 v4 的 schema 结构（_schema/output-schema.schema.json 为准），零依赖。

const fs = require('fs');
const path = require('path');
const { validate: validateJsonSchema } = require('./jsonschema');

// meta-schema 是仓库级资产：从 lib 自身定位，不随 --tasks-dir 覆盖漂移
const META_SCHEMA_FILE = path.join(__dirname, '..', '..', 'atom-tasks', '_schema', 'output-schema.schema.json');

/** 加载任务的 output schema；不存在返回 null；存在但不符合 meta-schema 抛错（硬失败）。 */
function loadTaskSchema(taskDir, taskName) {
  const file = path.join(taskDir, `${taskName}.output.schema.json`);
  if (!fs.existsSync(file)) return null;
  const schema = JSON.parse(fs.readFileSync(file, 'utf8'));
  const meta = JSON.parse(fs.readFileSync(META_SCHEMA_FILE, 'utf8'));
  const r = validateJsonSchema(meta, schema);
  if (!r.valid) {
    throw new Error(`${file} 不符合 meta-schema:\n  ${r.errors.join('\n  ')}`);
  }
  return schema;
}

/** 渲染产出契约为 md 块（生成侧软约束——agent 只读 md，D7）。 */
function renderContract(schema, artifact) {
  const lines = [`## Output Contract（产出契约：${artifact}）`, '', '产物生成后由 `validate` 按本契约硬校验，不合格会进入修正循环。结构要求：'];
  const walk = (sections, indent) => {
    for (const s of sections) {
      const bits = [s.required ? '必需' : '可选（无真实内容时省略）', `格式 ${s.format}`];
      if (s.columns) bits.push(`列：${s.columns.join(' / ')}`);
      if (s.idPattern) bits.push(`条目 ID 格式 \`${s.idPattern}\``);
      lines.push(`${indent}- **${'#'.repeat(s.level || 2)} ${s.heading}**（${bits.join('；')}）${s.description ? `——${s.description}` : ''}`);
      if (s.subsections) walk(s.subsections, `${indent}  `);
    }
  };
  walk(schema.sections || [], '');
  if (schema.rules && schema.rules.length) {
    lines.push('', '### 全局规则', ...schema.rules.map((r) => `- ${r}`));
  }
  if (schema.example) {
    lines.push('', '### 完整示例（格式参照，内容按实际需求填充）', '', '```markdown', schema.example.trim(), '```');
  }
  return lines.join('\n');
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * heading → 匹配正则源：`{{ 占位符 }}` 段视作「同一行内的任意非空内容」（模板语义），
 * 其余字面转义（eval dogfooding 修复：review/test-plan/verification 的契约声明了
 * 占位符 heading，字面匹配导致任何真实产物都过不了 validate）。
 */
function headingPattern(heading) {
  return String(heading)
    .split(/(\{\{[^}]*\}\})/)
    .map((p) => (p.startsWith('{{') && p.endsWith('}}') ? '[^\\n]+?' : escapeRe(p)))
    .join('');
}

function hasSection(content, heading, level) {
  return new RegExp(`^#{${level || 2}}\\s+${headingPattern(heading)}\\s*$`, 'm').test(content);
}

/** 提取 section 正文：从标题行到下一个同级或更高级标题。 */
function sectionBody(content, heading, level) {
  const lv = level || 2;
  const re = new RegExp(`^#{${lv}}\\s+${headingPattern(heading)}\\s*\\n([\\s\\S]*?)(?=^#{1,${lv}}\\s|\\s*$)`, 'm');
  const m = content.match(re);
  return m ? m[1].trim() : '';
}

/** idPattern（如 "BQ-{N}"）→ 正则源（BQ-\d+）。 */
function idPatternRe(idPattern) {
  return escapeRe(idPattern).replace(/\\\{N\\\}/, '\\d+');
}

/**
 * 硬校验产物内容。返回错误数组（空 = 通过）。
 * markdown：required section 存在 + 无占位填充 + table 列齐 + structured-list ID 格式；
 * json+markdown：jsonFields 字段存在与类型。
 */
function validateArtifact(schema, content) {
  const errors = [];
  if (schema.jsonFields) {
    let json;
    try {
      json = JSON.parse(content);
    } catch (e) {
      return [`产物不是合法 JSON: ${e.message}`];
    }
    for (const f of schema.jsonFields) {
      const has = Object.prototype.hasOwnProperty.call(json, f.name);
      if (f.required && !has) errors.push(`缺少必需字段 "${f.name}"`);
      if (has && f.type) {
        const t = typeof json[f.name];
        const ok = Array.isArray(f.type)
          ? f.type.some((x) => (Array.isArray(json[f.name]) ? x === 'array' : t === x))
          : f.type === 'array' ? Array.isArray(json[f.name]) : t === f.type;
        if (!ok) errors.push(`字段 "${f.name}" 类型应为 ${JSON.stringify(f.type)}`);
      }
    }
    return errors;
  }
  const walk = (sections) => {
    for (const s of sections) {
      const lv = s.level || 2;
      if (s.required && !hasSection(content, s.heading, lv)) {
        errors.push(`缺少必需 section "${'#'.repeat(lv)} ${s.heading}"`);
        continue;
      }
      if (!hasSection(content, s.heading, lv)) continue; // 可选 section 缺失 = 合法省略
      const body = sectionBody(content, s.heading, lv);
      if (/^(无|待定|TBD|N\/A)[。.]?$/.test(body)) {
        errors.push(`section "${s.heading}" 为占位填充（无/待定/TBD）——无真实内容应整体省略`);
      }
      if (s.format === 'table' && s.columns && body) {
        for (const col of s.columns) {
          if (!body.includes(col)) errors.push(`section "${s.heading}" 表格缺少列 "${col}"`);
        }
      }
      if (s.format === 'structured-list' && s.idPattern && body) {
        if (!new RegExp(idPatternRe(s.idPattern)).test(body)) {
          errors.push(`section "${s.heading}" 条目不符合 ID 格式 ${s.idPattern}`);
        }
      }
      if (s.subsections) walk(s.subsections);
    }
  };
  walk(schema.sections || []);
  return errors;
}

module.exports = { loadTaskSchema, renderContract, validateArtifact };
