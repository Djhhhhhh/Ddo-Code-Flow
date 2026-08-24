'use strict';
// 极简 YAML 子集解析器：仅覆盖 atom-task frontmatter 用到的形式（标量、嵌套 map、`- ` 对象列表）。

function parseYaml(text) {
  const lines = text.split('\n');
  const [value] = parseBlock(lines, 0, -1);
  return value;
}

function indentOf(line) {
  const m = line.match(/^\s*/);
  return m ? m[0].length : 0;
}

function parseBlock(lines, i, parentIndent) {
  let first = i;
  while (first < lines.length && lines[first].trim() === '') first++;
  if (first >= lines.length) return [{}, lines.length];

  const trimmed = lines[first].trim();
  if (trimmed.startsWith('- ')) {
    const list = [];
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === '') { i++; continue; }
      const ind = indentOf(line);
      if (ind <= parentIndent) break;
      const t = line.trim();
      if (!t.startsWith('- ')) break;
      const afterDash = t.slice(2).trim();
      if (afterDash === '') {
        const [sub, ni] = parseBlock(lines, i + 1, ind);
        list.push(sub);
        i = ni;
      } else if (afterDash.includes(':')) {
        const obj = {};
        const colon = afterDash.indexOf(':');
        obj[afterDash.slice(0, colon).trim()] = parseScalar(afterDash.slice(colon + 1).trim());
        i++;
        const [rest, ni] = parseMap(lines, i, ind);
        Object.assign(obj, rest);
        i = ni;
        list.push(obj);
      } else {
        list.push(parseScalar(afterDash));
        i++;
      }
    }
    return [list, i];
  }
  return parseMap(lines, i, parentIndent);
}

function parseMap(lines, i, parentIndent) {
  const map = {};
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i++; continue; }
    const ind = indentOf(line);
    if (ind <= parentIndent) break;
    const t = line.trim();
    const colon = t.indexOf(':');
    if (colon < 0) { i++; continue; }
    const key = t.slice(0, colon).trim();
    const rest = t.slice(colon + 1).trim();
    if (rest === '') {
      const [sub, ni] = parseBlock(lines, i + 1, ind);
      map[key] = sub;
      i = ni;
    } else {
      map[key] = parseScalar(rest);
      i++;
    }
  }
  return [map, i];
}

function parseScalar(s) {
  if (s === '') return null;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~') return null;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  return s;
}

module.exports = { parse: parseYaml };
