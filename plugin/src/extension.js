'use strict';
/**
 * extension.js —— VS Code 扩展宿主编排（激活/命令/树/panel 注册表/watcher）。
 * 契约：plan rev 1（split）Part 02；三区树（运行中/本项目/历史）+ archive 补载 + 三点监听；
 * 对索引、state 与全部状态文件只读（Non-goal：不做控制）。
 */

const vscode = require('vscode');
const path = require('path');
const {
  discoverAll, tryLoadState, expandIndexPath, loadStateFromZip, historyDirOf,
} = require('./runDiscovery');
const { buildViewModel, escapeHtml } = require('./stateView');
const { buildBrowser } = require('./artifactView');
const { renderHtml } = require('./webviewHtml');

const DEBOUNCE_MS = 300;

let outputChannel;
let extensionRoot = '';
let lastResult = { running: [], project: [], history: [], historyTotal: 0, staleCount: 0, indexError: '' };
const panels = new Map(); // runId → { panel, watcher, timer, summary }
const extraWatchers = [];
let bumpTimer = null;

function log(msg) {
  if (outputChannel) outputChannel.appendLine(`[${new Date().toISOString()}] ${msg}`);
}

function configIndexPath() {
  return vscode.workspace.getConfiguration('ddo-flow').get('indexPath');
}

function projectRoots() {
  return (vscode.workspace.workspaceFolders || []).map((f) => f.uri.fsPath);
}

/** 三源聚合发现 + 空态警示（索引错误只进通道，不弹窗）。 */
function refreshDiscovery() {
  lastResult = discoverAll({ indexPath: configIndexPath(), projectRoots: projectRoots() });
  if (lastResult.indexError) log(lastResult.indexError);
  return lastResult;
}

function allRuns() {
  return [...lastResult.running, ...lastResult.project, ...lastResult.history];
}

function findRun(runId) {
  return allRuns().find((r) => r.runId === runId);
}

// ---------------------------------------------------------------- TreeView

/**
 * 分组标签：codicon `layers`（三层堆叠方框）·结构统一·颜色区分（coding:02 修订 7）。
 * charts.* 主题色按**组序**分配（组名哈希曾致两组同色碰撞——v0.1.5「颜色无变化」真因）。
 */
const GROUP_PALETTE = ['charts.blue', 'charts.orange', 'charts.yellow', 'charts.green', 'charts.purple', 'charts.red'];

const ZONE_ICON = { running: 'pulse', project: 'library', history: 'history' };
const ZONE_LABEL = { running: '运行中', project: '本项目（已收口）', history: '历史' };

/** 标题截断：中文可读优先，超长加省略号（完整信息在 tooltip）。 */
function truncateTitle(s, n) {
  const t = String(s);
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

class RunsProvider {
  constructor() { this._onDidChange = new vscode.EventEmitter(); }
  get onDidChangeTreeData() { return this._onDidChange.event; }
  reload() { refreshDiscovery(); this._onDidChange.fire(); }
  getTreeItem(elem) { return elem; }

  /** 流水条目（区/组内子节点）：按区呈现状态徽章（plan Part 02 条目徽章映射）。 */
  runItem(r, zone) {
    const dateText = String(r.startedAt).slice(5, 16);
    let posText;
    if (zone === 'history') posText = `${r.finalStatus || '—'} · ${r.project}`;
    else if (r.finalStatus) posText = r.finalStatus;
    else if (r.completable) posText = '待收束';
    else posText = r.positions.map((p) => `${p.stage}:${p.phase}${p.gateOpen ? '·门' : ''}`).join(' ');
    const item = new vscode.TreeItem(truncateTitle(r.title, 18), vscode.TreeItemCollapsibleState.None);
    item.id = `${zone}:${r.runId}`;
    // 描述带类型/状态/启动时间（MM-DD HH:mm），常用信息免悬浮可读
    item.description = `${r.type} · ${posText} · ${dateText}`;
    item.tooltip = new vscode.MarkdownString(
      `**${r.title}**\n\n- runId：\`${r.runId}\`\n- 项目：\`${r.projectRoot}\`\n- 启动：${r.startedAt}`
      + (r.finalStatus ? `\n- 收口：${r.finalStatus}${r.endedAt ? ` · ${r.endedAt}` : ''}` : '')
      + (r.source === 'history' ? '\n- 来源：历史（runs.jsonl）' : ''),
    );
    // 主题双版本图标：位置空（待收束/已收口）用星标基座（修订 3 体系沿用）
    const base = r.completable ? 'run-completable' : 'run';
    const iconAt = (kind) => vscode.Uri.file(
      path.join(extensionRoot, 'media', 'icons', `${base}.${kind}.svg`)
    );
    item.iconPath = { light: iconAt('light'), dark: iconAt('dark') };
    item.command = { command: 'ddo-flow.openRun', title: '查看流水信息', arguments: [r.runId] };
    item.contextValue = 'run';
    return item;
  }

  /** 区节点（根层）：空区隐藏（plan Part 02 边界）。 */
  zoneNode(zone, runs) {
    const label = ZONE_LABEL[zone]
      + (zone === 'history' && lastResult.historyTotal > runs.length
        ? `（${runs.length}/${lastResult.historyTotal}）` : '');
    const item = new vscode.TreeItem(
      label,
      zone === 'history' ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded
    );
    item.id = `zone:${zone}`;
    item.description = `${runs.length}`;
    item.iconPath = new vscode.ThemeIcon(ZONE_ICON[zone]);
    item.contextValue = `zone:${zone}`;
    item.zoneRuns = runs;
    return item;
  }

  /** 运行中区子层：按 git 项目分组（现状逻辑原样保留，AC-3 回归边界）。 */
  projectGroups(runs) {
    const groups = new Map();
    for (const r of runs) {
      if (!groups.has(r.project)) groups.set(r.project, []);
      groups.get(r.project).push(r);
    }
    const names = [...groups.keys()].sort(
      (a, b) => (a === '未定义') - (b === '未定义') || a.localeCompare(b)
    );
    return names.map((name, gi) => {
      const item = new vscode.TreeItem(name, vscode.TreeItemCollapsibleState.Expanded);
      item.id = `group:${name}`;
      item.description = `${groups.get(name).length}`;
      const n = gi % GROUP_PALETTE.length;
      item.iconPath = new vscode.ThemeIcon('layers', new vscode.ThemeColor(GROUP_PALETTE[n]));
      item.contextValue = 'projectGroup';
      item.runs = groups.get(name);
      return item;
    });
  }

  getChildren(element) {
    if (!element) {
      refreshDiscovery();
      const zones = [];
      if (lastResult.running.length) zones.push(this.zoneNode('running', lastResult.running));
      if (lastResult.project.length) zones.push(this.zoneNode('project', lastResult.project));
      if (lastResult.history.length) zones.push(this.zoneNode('history', lastResult.history));
      return zones;
    }
    if (element.contextValue === 'zone:running') return this.projectGroups(element.zoneRuns);
    if (element.contextValue === 'zone:project' || element.contextValue === 'zone:history') {
      const zone = element.contextValue === 'zone:project' ? 'project' : 'history';
      return element.zoneRuns.map((r) => this.runItem(r, zone));
    }
    if (element.contextValue === 'projectGroup') {
      return element.runs.map((r) => this.runItem(r, 'running'));
    }
    return [];
  }
}

// ---------------------------------------------------------------- WebviewPanel

function stateWatcherPattern(statePath) {
  return new vscode.RelativePattern(
    vscode.Uri.file(path.dirname(statePath)), path.basename(statePath)
  );
}

/** 历史仅存 run 的降级信息卡（zip 不可读时；字段来自 runs.jsonl 事件）。 */
function historyFallbackHtml(summary) {
  const esc = escapeHtml;
  const rows = [
    ['runId', summary.runId],
    ['标题', summary.title],
    ['类型', summary.type],
    ['项目', summary.projectRoot],
    ['启动', summary.startedAt],
    ['收口', `${summary.finalStatus || '—'}${summary.endedAt ? ` · ${summary.endedAt}` : ''}`],
    ['statePath', summary.statePath || '—'],
    ['archiveZip', summary.archiveZip || '（zip 不可读）'],
  ].map(([k, v]) => `<div style="color:#5F7396;font-family:monospace">${esc(k)}</div><div style="color:#9FB3D1;font-family:monospace;word-break:break-all">${esc(String(v))}</div>`).join('');
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><style>body{background:#0A0F1C;color:#E6F1FF;font:13px/1.7 'Segoe UI','PingFang SC',monospace;padding:24px}h2{font-size:15px;margin:0 0 14px}.grid{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px}</style></head>
<body><h2>历史事件（state 不可读，降级展示）</h2><div class="grid">${rows}</div></body></html>`;
}

function renderPanel(entry, runId) {
  const summary = entry.summary;
  // state 可得性分流：磁盘直读 > zip 流式预览 > 历史事件降级卡（plan Part 02）
  let state = summary.statePath ? tryLoadState(summary.statePath) : null;
  let fromArchive = false;
  if (!state && summary.archiveZip) {
    state = loadStateFromZip(summary.archiveZip);
    fromArchive = !!state;
  }
  if (!state) {
    if (summary.finalStatus || summary.source === 'history') {
      entry.panel.webview.html = historyFallbackHtml(summary);
      return;
    }
    vscode.window.showInformationMessage(`流水 ${runId} 已失效（state 不可读），已从清单刷新`);
    entry.panel.dispose();
    return;
  }
  // 产出浏览器（E 区文件内联 + git 快照）随渲染装配（修订 9；归档 run 降级为登记行）
  const vm = buildViewModel(state, {
    statePath: summary.statePath,
    source: summary.source,
    finalStatus: summary.finalStatus,
    endedAt: summary.endedAt,
  });
  let browser = { files: [], git: null };
  try {
    browser = buildBrowser(state, fromArchive ? { archiveOnly: true, archiveZip: summary.archiveZip } : undefined);
  } catch (e) {
    log(`产出收集降级（${runId}）：${e.message}`);
  }
  entry.panel.webview.html = renderHtml(vm, browser);
}

function ensurePanel(runId) {
  const summary = findRun(runId) || refreshDiscovery() && findRun(runId);
  if (!summary) {
    vscode.window.showInformationMessage(`流水 ${runId} 不在清单（可能已收口或失效）`);
    return;
  }
  const existing = panels.get(runId);
  if (existing && existing.panel) {
    existing.panel.reveal(vscode.ViewColumn.One);
    renderPanel(existing, runId);
    return;
  }
  const panel = vscode.window.createWebviewPanel(
    'ddo-flow.runInfo', runId, vscode.ViewColumn.One,
    { enableScripts: false, retainContextWhenHidden: false }
  );
  panel.description = summary.title.length > 48 ? `${summary.title.slice(0, 48)}…` : summary.title;
  const entry = { panel, watcher: null, timer: null, summary };
  panels.set(runId, entry);
  renderPanel(entry, runId);
  // 详情监听：该 .state.json 变更 → 去抖重渲染（Part 01 §2；异常降级仅手动刷新；归档 run 无文件可监）
  if (summary.statePath && summary.source !== 'history') {
    try {
      entry.watcher = vscode.workspace.createFileSystemWatcher(stateWatcherPattern(summary.statePath), false, false, false);
      entry.watcher.onDidChange(() => {
        clearTimeout(entry.timer);
        entry.timer = setTimeout(() => panels.has(runId) && renderPanel(entry, runId), DEBOUNCE_MS);
      });
    } catch (e) {
      log(`state watcher 不可用（${runId}），降级为刷新时重渲染：${e.message}`);
    }
  }
  panel.onDidDispose(() => {
    clearTimeout(entry.timer);
    if (entry.watcher) entry.watcher.dispose();
    panels.delete(runId);
  });
}

// ---------------------------------------------------------------- 激活

/** 通用监听：create→change→delete 统一去抖刷新；异常降级为手动刷新。 */
function addBumpWatcher(pattern, tag) {
  try {
    const w = vscode.workspace.createFileSystemWatcher(pattern, false, false, false);
    const bump = () => {
      clearTimeout(bumpTimer);
      bumpTimer = setTimeout(() => vscode.commands.executeCommand('ddo-flow.refresh'), DEBOUNCE_MS);
    };
    w.onDidCreate(bump);
    w.onDidChange(bump);
    w.onDidDelete(bump);
    extraWatchers.push(w);
    return w;
  } catch (e) {
    log(`${tag} watcher 不可用，降级为仅手动刷新：${e.message}`);
    return null;
  }
}

function activate(context) {
  outputChannel = vscode.window.createOutputChannel('Ddo-Code-Flow');
  extensionRoot = context.extensionPath;
  context.subscriptions.push(outputChannel);

  const provider = new RunsProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('ddo-flow.runs', provider),
    vscode.commands.registerCommand('ddo-flow.refresh', () => provider.reload()),
    vscode.commands.registerCommand('ddo-flow.openRun', (runId) => ensurePanel(String(runId)))
  );

  // 三点监听（DEC-6）：index.json + workspace .ddo/runs/**.state.json + history/runs.jsonl
  const idx = expandIndexPath(configIndexPath());
  addBumpWatcher(
    new vscode.RelativePattern(vscode.Uri.file(path.dirname(idx)), path.basename(idx)),
    '索引'
  );
  for (const root of projectRoots()) {
    addBumpWatcher(
      new vscode.RelativePattern(path.join(root, '.ddo', 'runs'), '**/.state.json'),
      `项目运行目录（${root}）`
    );
  }
  addBumpWatcher(
    new vscode.RelativePattern(vscode.Uri.file(historyDirOf(idx)), 'runs.jsonl'),
    '历史事件'
  );
  context.subscriptions.push(...extraWatchers);

  log(`激活完成；索引 = ${idx}；监听源 = index + ${projectRoots().length} 个项目运行目录 + history`);
}

function deactivate() {
  for (const [, entry] of panels) {
    clearTimeout(entry.timer);
    if (entry.watcher) entry.watcher.dispose();
  }
  panels.clear();
  for (const w of extraWatchers) w.dispose();
  extraWatchers.length = 0;
  clearTimeout(bumpTimer);
}

module.exports = { activate, deactivate };
