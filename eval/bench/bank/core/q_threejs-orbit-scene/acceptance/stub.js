'use strict';
// q_threejs-orbit-scene dry-run 桩注入器（仅链路自验，不进真实评测）。
// 约定：编排器在 dry-run 模式按臂调用（无本文件 = 无操作）；arm: 'baseline' | 'ddo'。
// 保真迁移自 cli.js stubArmArtifacts（issue #92，DEC-6）：ddo=reference 黄金样例，baseline=flawed 缺陷样例。
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ arm, sandboxDir, packDir }) => {
  const variant = arm === 'ddo' ? 'reference' : 'flawed';
  fs.copyFileSync(path.join(packDir, 'acceptance', 'testdata', variant, 'index.html'), path.join(sandboxDir, 'index.html'));
};
