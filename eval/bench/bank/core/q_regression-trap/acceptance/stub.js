'use strict';
// q_regression-trap dry-run 桩注入器（仅链路自验，不进真实评测）。
// 约定：编排器在 dry-run 模式按臂调用（无本文件 = 无操作）；arm: 'baseline' | 'ddo'。
// 保真迁移自 cli.js stubArmArtifacts（issue #92，DEC-6）：
//   ddo      → bin/convert.js 打最小补丁（--uppercase 生效的最小实现）；
//   baseline → 不实现新选项，并制造越界改动样例（lib/textlib.js 无关注释 + README 追记）。
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ arm, sandboxDir }) => {
  if (arm === 'ddo') {
    const p = path.join(sandboxDir, 'bin', 'convert.js');
    let src = fs.readFileSync(p, 'utf8');
    src = src.replace("if (args[0] === '--upper')", "if (args[0] === '--uppercase') { mode = 'upper'; text = args.slice(1).join(' '); }\n  else if (args[0] === '--upper')");
    fs.writeFileSync(p, src);
  } else {
    const p = path.join(sandboxDir, 'lib', 'textlib.js');
    fs.appendFileSync(p, '\n// 手滑改了无关文件（越界改动样例）\n');
    fs.appendFileSync(path.join(sandboxDir, 'README.md'), '\n（未新增 --uppercase 的 baseline 样例）\n');
  }
};
