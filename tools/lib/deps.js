'use strict';
// 原子任务依赖检查（测试工作流 DEC-E）：声明读取（任务 config.dependencies）
// + 逐项本机执行（checks 脚本，bash，exit 0=支持）。
// 只读：不写 state；单项结果独立——检查失败是「询问输入」，不是命令错误。

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('node:child_process');

const TIMEOUT_MS = 60000;

/** 读单任务依赖声明；任务不存在返回 null（由调用方决定报错），无声明返回 []。 */
function readDependencies(tasksDir, taskName) {
  const cfgFile = path.join(tasksDir, taskName, 'config.json');
  if (!fs.existsSync(cfgFile)) return null;
  const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
  return Array.isArray(cfg.dependencies) ? cfg.dependencies : [];
}

/**
 * 逐项执行依赖检查。check 为相对任务目录的脚本路径（声明约定 checks/<file>.sh），
 * 以任务目录为 cwd 执行 bash；exit 0 → supported:true。
 * 脚本缺失/超时/非零退出均记 supported:false 并带 detail（截断 200 字）。
 */
function checkDependencies(tasksDir, taskName, deps) {
  return deps.map((d) => {
    const script = path.join(tasksDir, taskName, d.check || '');
    let supported = false;
    let detail = '';
    if (!d.check || !fs.existsSync(script)) {
      detail = `检查脚本缺失: ${d.check || '(未声明)'}`;
    } else {
      const r = spawnSync('bash', [script], {
        cwd: path.join(tasksDir, taskName),
        encoding: 'utf8',
        timeout: TIMEOUT_MS,
      });
      supported = r.status === 0;
      if (!supported) {
        const msg = r.error ? r.error.message : String(r.stderr || r.stdout || `exit ${r.status}`).trim();
        detail = msg.slice(0, 200);
      }
    }
    return {
      task: taskName,
      id: d.id,
      desc: d.desc,
      required: !!d.required,
      supported,
      ...(d.install ? { install: d.install } : {}),
      ...(detail ? { detail } : {}),
    };
  });
}

module.exports = { readDependencies, checkDependencies };
