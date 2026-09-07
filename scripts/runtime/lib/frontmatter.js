'use strict';
const yaml = require('./yaml');

function splitFrontmatter(mdText, options = {}) {
  const normalized = String(mdText).replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!match) return null;
  return {
    frontmatter: yaml.parse(match[1], {
      source: options.source || options.filePath || '<markdown>',
      lineOffset: 1,
    }),
    instructionBody: normalized.slice(match[0].length),
  };
}

function parseFrontmatter(mdText, options = {}) {
  const result = splitFrontmatter(mdText, options);
  return result ? result.frontmatter : null;
}

module.exports = { parseFrontmatter, splitFrontmatter };
