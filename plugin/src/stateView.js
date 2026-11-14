'use strict';
/**
 * stateView.js —— state（schema v2 六分区）→ Webview 视图模型（纯函数，无 IO）。
 * 契约：plan R1 Part 02 §1–§2；只读语义（Non-goal：不提供任何控制操作）。
 */

/** stageEntry.status → 链胶囊状态键（docs 调色板映射见 Part 02 §2）。 */
const STATUS_COLOR_KEY = {
  pending: 'ink3',
  running: 'cyan',
  'waiting-human': 'warn',
  done: 'ok',
  failed: 'danger',
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/** B1 头部：A 标识区 + B 环境（dirs/git 摘要）+ 多源徽章数据（plan Part 02：source/finalStatus/endedAt）。 */
function buildHeader(state, opts) {
  const o = opts || {};
  const s = state;
  const runDir = s.dirs.runDir || '';
  const segs = runDir.replace(/\\/g, '/').split('/').filter(Boolean);
  const type = segs.length >= 2 ? segs[segs.length - 2] : '';
  let gitSummary = '';
  if (s.git) {
    if (s.git.multiRepo && Array.isArray(s.git.repos)) {
      gitSummary = `multiRepo · ${s.git.repos.map((r) => r && r.name).filter(Boolean).join(', ')}`;
    } else {
      gitSummary = [s.git.branch, s.git.mainBranch ? `基线 ${s.git.mainBranch}` : '']
        .filter(Boolean).join(' @') || '';
    }
  }
  return {
    title: s.title,
    runId: s.runId,
    type,
    workflow: s.workflow || '',
    schemaVersion: s.schemaVersion || 1,
    ephemeral: !!s.ephemeral,
    startedAt: s.startedAt,
    projectRoot: s.dirs.projectRoot || '',
    runDir,
    statePath: o.statePath || '',
    gitSummary,
    source: o.source || '',
    finalStatus: o.finalStatus || '',
    endedAt: o.endedAt || '',
  };
}

/** B2 进度与门：C 进度区（currentStage/stages/gate）。 */
function buildProgress(state) {
  const positions = state.currentStage.map((e) => {
    const idx = String(e).lastIndexOf(':');
    const stage = idx >= 0 ? String(e).slice(0, idx) : String(e);
    const phase = idx >= 0 ? String(e).slice(idx + 1) : '';
    const st = state.stages[stage] || {};
    const gate = st.gate;
    return { stage, phase, ...(gate && !gate.decision ? { gateOpen: true } : {}) };
  });
  const currentSet = new Set(positions.map((p) => p.stage));
  const chain = Object.entries(state.stages).map(([stage, entry]) => ({
    stage,
    status: entry.status || 'pending',
    at: entry.at || '',
    current: currentSet.has(stage),
  }));
  const gates = Object.entries(state.stages)
    .filter(([, entry]) => entry.gate && !entry.gate.decision)
    .map(([stage, entry]) => ({
      stage,
      phase: entry.gate.phase,
      openedAt: entry.gate.openedAt,
      presentedAt: entry.gate.presentedAt || '',
      lastInteractedAt: entry.gate.lastInteractedAt || '',
      options: Array.isArray(entry.gate.options)
        ? entry.gate.options.map((o) => ({ name: o.name, desc: o.desc }))
        : [],
    }));
  return { positions, completable: positions.length === 0, chain, gates };
}

/** B3 产物：E 产物区（artifacts 当前有效集）。 */
function buildArtifacts(state) {
  if (!state.artifacts) return [];
  return Object.entries(state.artifacts).map(([stage, entries]) => ({
    stage,
    entries: (entries || []).map((en) => ({
      phase: en.phase,
      recordedAt: en.recordedAt,
      files: (en.files || []).map((f) => ({ path: f.path, bytes: f.bytes })),
    })),
  }));
}

/** B4 子流程：D 编排区（subflows 注册表）。 */
function buildSubflows(state) {
  if (!Array.isArray(state.subflows)) return [];
  return state.subflows.map((sf) => ({
    id: sf.id, title: sf.title, workflow: sf.workflow || '',
    atStage: sf.atStage, status: sf.status, startedAt: sf.startedAt,
  }));
}

/** B5 环境与旋钮：B 环境区明细。 */
function buildEnv(state) {
  const git = state.git || {};
  let gitRows = [];
  if (git.multiRepo && Array.isArray(git.repos)) {
    gitRows = [
      { k: 'multiRepo 容器', v: git.container || '' },
      ...git.repos.map((r) => ({
        k: `repo${r.role ? `（${r.role}）` : ''}`,
        v: [r.name, r.branch, r.worktreePath].filter(Boolean).join(' · '),
      })),
    ];
  } else {
    gitRows = [
      { k: 'branch', v: git.branch || '' },
      { k: 'mainBranch', v: git.mainBranch || '' },
      ...(git.worktreePath ? [{ k: 'worktreePath', v: git.worktreePath }] : []),
    ];
  }
  const atomTasks = Object.entries(state.atomTasks || {}).map(([k, v]) => ({
    k, v: typeof v === 'string' ? v : JSON.stringify(v),
  }));
  return {
    gitRows,
    dirsRows: [
      { k: 'projectRoot', v: state.dirs.projectRoot || '' },
      { k: 'runDir', v: state.dirs.runDir || '' },
      ...(state.dirs.tasksDir ? [{ k: 'tasksDir', v: state.dirs.tasksDir }] : []),
    ],
    atomTasks,
  };
}

/** 视图模型总装：state → {header, progress, artifacts, subflows, env, usageLogPath}。 */
function buildViewModel(state, opts) {
  const o = opts || {};
  return {
    header: buildHeader(state, {
      statePath: o.statePath, source: o.source, finalStatus: o.finalStatus, endedAt: o.endedAt,
    }),
    progress: buildProgress(state),
    artifacts: buildArtifacts(state),
    subflows: buildSubflows(state),
    env: buildEnv(state),
    usageLogPath: state.dirs && state.dirs.runDir
      ? `${state.dirs.runDir.replace(/\\/g, '/').replace(/\/$/, '')}/.usage.jsonl`
      : '',
  };
}

module.exports = { STATUS_COLOR_KEY, escapeHtml, buildViewModel };
