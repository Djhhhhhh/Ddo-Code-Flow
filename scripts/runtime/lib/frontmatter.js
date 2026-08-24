'use strict';
const yaml = require('./yaml');

// 提取并解析 atom-task .md 的 YAML frontmatter；无 frontmatter 返回 null。
function parseFrontmatter(mdText) {
  const m = mdText.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!m) return null;
  return yaml.parse(m[1]);
}

module.exports = { parseFrontmatter };
