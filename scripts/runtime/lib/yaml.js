'use strict';

function parseYaml(text, context = {}) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const [value] = parseBlock(lines, 0, -1, context);
  return value;
}

function indentOf(line) {
  const match = line.match(/^\s*/);
  return match ? match[0].length : 0;
}

function parseBlock(lines, index, parentIndent, context) {
  let first = index;
  while (first < lines.length && isBlankOrComment(lines[first])) first++;
  if (first >= lines.length) return [{}, lines.length];

  if (lines[first].trim().startsWith('- ')) {
    const list = [];
    while (index < lines.length) {
      const line = lines[index];
      if (isBlankOrComment(line)) { index++; continue; }
      const indent = indentOf(line);
      if (indent <= parentIndent) break;
      const trimmed = line.trim();
      if (!trimmed.startsWith('- ')) break;
      const item = trimmed.slice(2).trim();
      if (item === '') {
        const [nested, nextIndex] = parseBlock(lines, index + 1, indent, context);
        list.push(nested);
        index = nextIndex;
      } else if (item.includes(':')) {
        const object = {};
        const colon = item.indexOf(':');
        const key = item.slice(0, colon).trim();
        object[key] = parseScalar(item.slice(colon + 1), location(context, index));
        index++;
        const [rest, nextIndex] = parseMap(lines, index, indent, context);
        Object.assign(object, rest);
        list.push(object);
        index = nextIndex;
      } else {
        list.push(parseScalar(item, location(context, index)));
        index++;
      }
    }
    return [list, index];
  }
  return parseMap(lines, index, parentIndent, context);
}

function parseMap(lines, index, parentIndent, context) {
  const map = {};
  while (index < lines.length) {
    const line = lines[index];
    if (isBlankOrComment(line)) { index++; continue; }
    const indent = indentOf(line);
    if (indent <= parentIndent) break;
    const trimmed = line.trim();
    const colon = trimmed.indexOf(':');
    if (colon < 0) throw syntaxError(location(context, index), '映射项缺少冒号');
    const key = trimmed.slice(0, colon).trim();
    if (!key) throw syntaxError(location(context, index), '映射键不能为空');
    const rest = trimmed.slice(colon + 1);
    if (rest.trim() === '') {
      const [nested, nextIndex] = parseBlock(lines, index + 1, indent, context);
      map[key] = nested;
      index = nextIndex;
    } else {
      map[key] = parseScalar(rest, location(context, index));
      index++;
    }
  }
  return [map, index];
}

function parseScalar(raw, context = {}) {
  const value = String(raw).trim();
  if (value === '[]') return [];
  if (value === '{}') return {};
  if (value.startsWith('[')) throw syntaxError(context, '不支持 flow-style array，请改为 block list');
  if (value.startsWith('{')) throw syntaxError(context, '不支持 flow-style object，请改为 block mapping');
  if (value === '') return null;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  return value;
}

function isBlankOrComment(line) {
  const trimmed = line.trim();
  return trimmed === '' || trimmed.startsWith('#');
}

function location(context, zeroBasedLine) {
  return { source: context.source || context.filePath || '<yaml>', line: zeroBasedLine + 1 + (context.lineOffset || 0) };
}

function syntaxError(context, message) {
  const source = context.source || context.filePath || '<yaml>';
  const line = context.line ? `:${context.line}` : '';
  return Object.assign(new Error(`${source}${line}: ${message}`), { exitCode: 1 });
}

module.exports = { parse: parseYaml, parseScalar };
