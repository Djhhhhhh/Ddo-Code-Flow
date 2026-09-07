'use strict';
const fs = require('fs');
const path = require('path');

function loadSkillMetadata(skillRoot) {
  const filePath = path.join(skillRoot, 'SKILL.md');
  const source = fs.readFileSync(filePath, 'utf8');
  const block = source.match(/^---\s*\n([\s\S]*?)\n---/);
  const name = block && block[1].match(/^name:\s*["']?([^"'\r\n]+)["']?\s*$/m);
  const version = block && block[1].match(/^\s*version:\s*["']?([0-9]+\.[0-9]+\.[0-9]+)["']?\s*$/m);
  if (!name || !version) throw Object.assign(new Error(`${filePath}: 缺少 name/version frontmatter`), { exitCode: 1 });
  return { name: name[1].trim(), version: version[1] };
}

module.exports = { loadSkillMetadata };
