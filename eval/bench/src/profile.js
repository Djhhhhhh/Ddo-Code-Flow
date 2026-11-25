'use strict';
// 运行 profile 装配与校验（plan Part 02 §1，DEC-9）：
// {dimensions{result,process,cost,symmetry}, tasks[], reports[]}，各项可省略 = 全量/基础缺省。
// 报告形式注册表单一来源：新增形式 = 加模板 + 在此注册（不改数据契约）。

const REPORT_FORMS = ['card', 'sheet', 'summary', 'wechat', 'xiaohongshu'];
const DIMENSION_KEYS = ['result', 'process', 'cost', 'symmetry'];

class ProfileError extends Error {
  constructor(msg) { super(msg); this.usage = true; }
}

/** 装配：显式 profile JSON + CLI 题单 → 终值 profile（缺省全量）。冲突/非法 → ProfileError（exit 2）。 */
function assembleProfile({ profileFile, profileObj, cliTasks } = {}) {
  let raw = profileObj;
  if (profileFile && raw) throw new ProfileError('--profile 与内联 profile 不可同时提供');
  if (profileFile) {
    const fs = require('node:fs');
    try {
      raw = JSON.parse(fs.readFileSync(profileFile, 'utf8'));
    } catch (e) {
      throw new ProfileError(`profile 文件不可读或非法 JSON（${profileFile}）: ${e.message}`);
    }
  }
  raw = raw || {};
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new ProfileError('profile 须为 JSON 对象');

  const dimensions = { result: true, process: true, cost: true, symmetry: true };
  if (raw.dimensions !== undefined) {
    if (typeof raw.dimensions !== 'object' || Array.isArray(raw.dimensions)) throw new ProfileError('profile.dimensions 须为对象');
    for (const k of Object.keys(raw.dimensions)) {
      if (!DIMENSION_KEYS.includes(k)) throw new ProfileError(`profile.dimensions 未知维度键: ${k}（合法: ${DIMENSION_KEYS.join(', ')}）`);
      if (typeof raw.dimensions[k] !== 'boolean') throw new ProfileError(`profile.dimensions.${k} 须为 boolean`);
      dimensions[k] = raw.dimensions[k];
    }
  }

  let tasks = cliTasks;
  if (raw.tasks !== undefined) {
    if (!Array.isArray(raw.tasks) || !raw.tasks.every((t) => typeof t === 'string')) throw new ProfileError('profile.tasks 须为字符串数组');
    if (cliTasks && JSON.stringify(raw.tasks) !== JSON.stringify(cliTasks)) {
      throw new ProfileError(`profile.tasks 与 --tasks 不一致（profile: ${raw.tasks.join(',')}；--tasks: ${cliTasks.join(',')}）——须二选一或保持一致`);
    }
    tasks = raw.tasks;
  }
  if (!tasks || !tasks.length) throw new ProfileError('题单为空：--tasks 或 profile.tasks 至少提供一道题');
  if (tasks.length > 3) throw new ProfileError(`题组为 ${tasks.length} 道（每轮 2–3 题）`);

  let reports = ['card', 'sheet', 'summary'];
  if (raw.reports !== undefined) {
    if (!Array.isArray(raw.reports) || !raw.reports.every((r) => typeof r === 'string')) throw new ProfileError('profile.reports 须为字符串数组');
    const unknown = raw.reports.filter((r) => !REPORT_FORMS.includes(r));
    if (unknown.length) throw new ProfileError(`profile.reports 含未注册形式: ${unknown.join(',')}（注册表: ${REPORT_FORMS.join(', ')}）`);
    if (new Set(raw.reports).size !== raw.reports.length) throw new ProfileError('profile.reports 不得重复');
    reports = raw.reports;
  }
  return { dimensions, tasks, reports };
}

module.exports = { assembleProfile, REPORT_FORMS, DIMENSION_KEYS, ProfileError };
