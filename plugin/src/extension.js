'use strict';
/**
 * extension.js —— VS Code 扩展宿主编排（激活/命令/树/panel 注册表/watcher）。
 * 契约：plan R1 Part 01 §2–§4（DEC-2）；对索引与全部 state 只读（Non-goal：不做控制）。
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { discover, tryLoadState, expandIndexPath } = require('./runDiscovery');
const { buildViewModel } = require('./stateView');
const { buildBrowser } = require('./artifactView');
const { renderHtml } = require('./webviewHtml');

const DEBOUNCE_MS = 300;

let outputChannel;
let extensionRoot = '';
let lastResult = { runs: [], staleCount: 0, indexError: '' };
const panels = new Map(); // runId → { panel, watcher, timer }
let indexWatcher = null;
let indexTimer = null;

function log(msg) {
  if (outputChannel) outputChannel.appendLine(`[${new Date().toISOString()}] ${msg}`);
}

function indexPath() {
  return expandIndexPath(vscode.workspace.getConfiguration('ddo-flow').get('indexPath'));
}

/** 全量发现 + 空态警示（索引错误只进通道，不弹窗——Part 01 §4）。 */
function refreshDiscovery() {
  lastResult = discover(indexPath());
  if (lastResult.indexError) log(lastResult.indexError);
  return lastResult;
}

// ---------------------------------------------------------------- TreeView

/**
 * 分组标签：codicon `layers`（三层堆叠方框）·结构统一·颜色区分（coding:02 修订 7）。
 * charts.* 主题色按**组序**分配（组名哈希曾致两组同色碰撞——v0.1.5「颜色无变化」真因）。
 */
const GROUP_PALETTE = ['charts.blue', 'charts.orange', 'charts.yellow', 'charts.green', 'charts.purple', 'charts.red'];

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

  /** 流水条目（组内子节点）。 */
  runItem(r) {
    const posText = r.completable
      ? '待收束'
      : r.positions.map((p) => `${p.stage}:${p.phase}${p.gateOpen ? '·门' : ''}`).join(' ');
    const item = new vscode.TreeItem(truncateTitle(r.title, 18), vscode.TreeItemCollapsibleState.None);
    item.id = r.runId;
    // 描述带启动时间（MM-DD HH:mm），常用信息免悬浮可读
    item.description = `${r.type} · ${posText} · ${String(r.startedAt).slice(5, 16)}`;
    item.tooltip = new vscode.MarkdownString(
      `**${r.title}**\n\n- runId：\`${r.runId}\`\n- 项目：\`${r.projectRoot}\`\n- 启动：${r.startedAt}`
    );
    // 主题双版本图标：VS Code 按当前明暗状态渲染对应文件（修订 3）
    const base = r.completable ? 'run-completable' : 'run';
    const iconAt = (kind) => vscode.Uri.file(
      path.join(extensionRoot, 'media', 'icons', `${base}.${kind}.svg`)
    );
    item.iconPath = { light: iconAt('light'), dark: iconAt('dark') };
    item.command = { command: 'ddo-flow.openRun', title: '查看流水信息', arguments: [r.runId] };
    item.contextValue = 'run';
    return item;
  }

  getChildren(element) {
    if (!element) {
      // 根层：按 git 项目分组（未定义组排最后）
      refreshDiscovery();
      const groups = new Map();
      for (const r of lastResult.runs) {
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
    return element.contextValue === 'projectGroup' ? element.runs.map((r) => this.runItem(r)) : [];
  }
}

// ---------------------------------------------------------------- WebviewPanel

function stateWatcherPattern(statePath) {
  return new vscode.RelativePattern(
    vscode.Uri.file(path.dirname(statePath)), path.basename(statePath)
  );
}

function renderPanel(entry, runId) {
  const state = tryLoadState(entry.statePath);
  if (!state) {
    vscode.window.showInformationMessage(`流水 ${runId} 已失效（state 不可读），已从清单刷新`);
    entry.panel.dispose();
    return;
  }
  // 产出浏览器（E 区文件内联 + git 快照）随渲染装配（修订 9）
  const vm = buildViewModel(state, { statePath: entry.statePath });
  let browser = { files: [], git: null };
  try {
    browser = buildBrowser(state);
  } catch (e) {
    log(`产出收集降级（${runId}）：${e.message}`);
  }
  entry.panel.webview.html = renderHtml(vm, browser);
}

function ensurePanel(runId) {
  const summary = lastResult.runs.find((r) => r.runId === runId)
    || refreshDiscovery().runs.find((r) => r.runId === runId);
  if (!summary) {
    vscode.window.showInformationMessage(`流水 ${runId} 不在运行中清单（可能已收口或失效）`);
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
  const entry = { panel, watcher: null, timer: null, statePath: summary.statePath };
  panels.set(runId, entry);
  renderPanel(entry, runId);
  // 详情监听：该 .state.json 变更 → 去抖重渲染（Part 01 §2；异常降级仅手动刷新）
  try {
    entry.watcher = vscode.workspace.createFileSystemWatcher(stateWatcherPattern(summary.statePath), false, false, false);
    entry.watcher.onDidChange(() => {
      clearTimeout(entry.timer);
      entry.timer = setTimeout(() => panels.has(runId) && renderPanel(entry, runId), DEBOUNCE_MS);
    });
  } catch (e) {
    log(`state watcher 不可用（${runId}），降级为刷新时重渲染：${e.message}`);
  }
  panel.onDidDispose(() => {
    clearTimeout(entry.timer);
    if (entry.watcher) entry.watcher.dispose();
    panels.delete(runId);
  });
}

// ---------------------------------------------------------------- 激活

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

  // 索引监听：新增/删除 run → 去抖刷新树（异常降级仅手动刷新）
  try {
    const idx = indexPath();
    indexWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(path.dirname(idx)), path.basename(idx)),
      false, false, true
    );
    const bump = () => {
      clearTimeout(indexTimer);
      indexTimer = setTimeout(() => provider.reload(), DEBOUNCE_MS);
    };
    indexWatcher.onDidCreate(bump);
    indexWatcher.onDidChange(bump);
    indexWatcher.onDidDelete(bump);
    context.subscriptions.push(indexWatcher);
  } catch (e) {
    log(`索引 watcher 不可用，降级为仅手动刷新：${e.message}`);
  }

  log(`激活完成；索引 = ${indexPath()}`);
}

function deactivate() {
  for (const [, entry] of panels) {
    clearTimeout(entry.timer);
    if (entry.watcher) entry.watcher.dispose();
  }
  panels.clear();
  clearTimeout(indexTimer);
}

module.exports = { activate, deactivate };
