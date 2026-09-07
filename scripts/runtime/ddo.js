#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/args');
const { readJson, writeJsonAtomic } = require('./lib/json');
const { composeConfig } = require('./lib/config');
const { selectWorkflow, loadWorkflow, validateDag } = require('./lib/workflow');
const { initState, findResumable, applyMutation } = require('./lib/state');
const { nextNode } = require('./lib/nodes');
const { registerArtifact } = require('./lib/artifacts');
const { validateOutput } = require('./lib/output-validator');
const { completeNode } = require('./lib/completion');
const { gate } = require('./lib/gate');
const { advanceStage } = require('./lib/advance');
const { enqueuePendingOutput, attachWorktree, getBootstrapStatePath } = require('./lib/pending-outputs');
const { loadSkillMetadata } = require('./lib/skill-metadata');
const progress = require('./lib/progress');

const USAGE = [
  'ddo.js <subcommand> [--flags]',
  '',
  'Subcommands:',
  '  compose-config       合成并校验有效配置（仅 stdout）',
  '  select-workflow      严格解析 workflowId/runType/workflowPath',
  '  validate-dag         校验 workflow、task、角色和 DAG',
  '  init-state           创建 bootstrap state',
  '  find-resumable       查找 bootstrap/worktree 恢复候选',
  '  attach-worktree      接入最终 worktree 并 flush pending outputs',
  '  next-node            选择下一批节点并注入输入',
  '  register-artifact    预校验后登记或暂存产物',
  '  complete-node        检查全部声明产物后完成节点',
  '  validate-output      校验 output schema 与产物内容',
  '  gate                 持久化 approved/rejected/pending',
  '  advance-stage        校验不变量后推进 stage',
  '  set-issue-context    受限写入 issueContext',
  '  record-node-progress 记录白名单节点进度',
  '  record-task-result   记录 task-NN 状态',
  '  record-node-failure  记录节点失败',
  '  mark-node-waiting-human 记录人工等待',
  '  request-retry        按 workflow 回滚到前序 stage',
  '  record-cleanup-result 记录 cleanup 结果',
].join('\n');

function main() {
  const { _, flags } = parseArgs(process.argv.slice(2));
  const command = _[0];
  if (flags.help || flags.h) return out({ usage: USAGE });
  if (!command) throw usageError(USAGE);

  switch (command) {
    case 'compose-config': {
      const skillRoot = requireFlag(flags, 'skill-root');
      const projectRoot = requireFlag(flags, 'project-root');
      return out(composeConfig({ skillRoot, projectRoot, argsJson: flags['args-json'] }));
    }
    case 'select-workflow': {
      const skillRoot = requireFlag(flags, 'skill-root');
      const projectRoot = flags['project-root'] || process.cwd();
      const effectiveConfig = composeConfig({ skillRoot, projectRoot, argsJson: flags['args-json'] });
      return out(selectWorkflow({ skillRoot, effectiveConfig, model: flags.model, feature: !!flags.feature, bugfix: !!flags.bugfix, text: flags.text }));
    }
    case 'validate-dag': {
      const skillRoot = requireFlag(flags, 'skill-root');
      const workflowPath = requireFlag(flags, 'workflow');
      const projectRoot = flags['project-root'] || process.cwd();
      const effectiveConfig = composeConfig({ skillRoot, projectRoot, argsJson: flags['args-json'] });
      const result = validateDag({ skillRoot, workflowPath, effectiveConfig });
      if (!result.valid) throw failure(`DAG 校验失败:\n${result.errors.join('\n')}`);
      return out({ valid: true });
    }
    case 'init-state': {
      const skillRoot = requireFlag(flags, 'skill-root');
      const projectRoot = requireFlag(flags, 'project-root');
      const workflowPath = requireFlag(flags, 'workflow');
      const workflow = loadWorkflow(skillRoot, workflowPath);
      const initial = workflow.pipeline.find((stage) => stage.enabled !== false);
      if (!initial) throw failure('workflow 没有可执行 stage');
      const metadata = loadSkillMetadata(skillRoot);
      const stateSchema = loadStateSchema(skillRoot);
      const state = initState({
        workflowId: flags['workflow-id'] || path.basename(workflowPath, '.json'),
        projectRoot,
        skillName: metadata.name,
        skillVersion: metadata.version,
        skillRoot,
        workflowPath,
        runType: flags['run-type'] || 'feat',
        args: parseJsonFlag(flags['args-json'], {}),
        initialStage: initial.stage,
        stateSchema,
      });
      const statePath = getBootstrapStatePath(projectRoot, state.bootstrapId);
      writeJsonAtomic(statePath, state);
      return out({ statePath, state });
    }
    case 'find-resumable': {
      const projectRoot = requireFlag(flags, 'project-root');
      const candidates = findResumable({ projectRoot, worktreeDir: flags['worktree-dir'] });
      if (candidates.length > 1) {
        throw failure(`存在 ${candidates.length} 个可恢复 run，需要明确选择:\n${candidates.map(formatCandidate).join('\n')}`);
      }
      return out(candidates.length ? { resumable: true, ...candidates[0] } : { resumable: false });
    }
    case 'attach-worktree': {
      const context = loadRunContext(flags);
      const worktreePath = requireFlag(flags, 'worktree-path');
      const dateDescription = requireFlag(flags, 'date-description');
      const artifactDir = requireFlag(flags, 'artifact-dir');
      const runId = requireFlag(flags, 'run-id');
      const worktreeInfo = flags['worktree-info'] ? fs.readFileSync(flags['worktree-info'], 'utf8') : fs.readFileSync(0, 'utf8');
      return out(attachWorktree({ ...context, statePath: context.statePath, runId, worktreePath, dateDescription, artifactDir, worktreeInfo, stateSchema: context.stateSchema }));
    }
    case 'next-node': {
      const context = loadRunContext(flags);
      const result = nextNode({ state: context.state, workflow: context.workflow, skillRoot: context.skillRoot, config: context.effectiveConfig });
      if (result.historyEvents.length) {
        const next = applyMutation(context.state, { history: [...context.state.history, ...result.historyEvents] }, 'runtime', context.stateSchema);
        writeJsonAtomic(context.statePath, next);
      }
      return out(result);
    }
    case 'register-artifact': {
      const context = loadRunContext(flags);
      const role = requireFlag(flags, 'role');
      const producer = requireFlag(flags, 'producer');
      const stdin = fs.readFileSync(0, 'utf8');
      const result = registerArtifact({ stdin, role, producer, stage: flags.stage || context.state.currentStage, state: context.state, skillRoot: context.skillRoot, workflow: context.workflow, effectiveConfig: context.effectiveConfig });
      let next;
      if (result.status === 'pending') {
        next = enqueuePendingOutput({ state: context.state, pendingOutput: result.pendingOutput, historyEvent: result.historyEvent, stateSchema: context.stateSchema });
      } else {
        next = applyMutation(context.state, {
          artifacts: { ...context.state.artifacts, [role]: result.artifactRecord },
          history: result.historyEvent ? [...context.state.history, result.historyEvent] : context.state.history,
        }, 'runtime', context.stateSchema);
      }
      writeJsonAtomic(context.statePath, next);
      return out({ status: result.status, path: result.path, role });
    }
    case 'complete-node': {
      const context = loadRunContext(flags);
      const nodeName = requireFlag(flags, 'node');
      const result = completeNode({ state: context.state, workflow: context.workflow, effectiveConfig: context.effectiveConfig, skillRoot: context.skillRoot, stageName: flags.stage || context.state.currentStage, nodeName });
      if (result.historyEvent) {
        const next = applyMutation(context.state, { history: [...context.state.history, result.historyEvent] }, 'runtime', context.stateSchema);
        writeJsonAtomic(context.statePath, next);
      }
      return out({ node: result.node, status: result.status });
    }
    case 'validate-output': {
      const skillRoot = requireFlag(flags, 'skill-root');
      const result = validateOutput({ artifactPath: requireFlag(flags, 'artifact'), outputSchemaRef: requireFlag(flags, 'output-schema-ref'), skillRoot });
      if (!result.valid) throw failure(`产物校验失败:\n${result.errors.join('\n')}`);
      return out({ valid: true });
    }
    case 'gate': {
      const context = loadRunContext(flags);
      const result = gate(context.state, {
        stage: requireFlag(flags, 'stage'), action: requireFlag(flags, 'action'), feedback: flags.feedback,
        issueNumber: flags['issue-number'], repo: flags.repo, monitorId: flags['monitor-id'], enteredAt: flags['entered-at'], timeoutAt: flags['timeout-at'],
      });
      if (result.patch) {
        const next = applyMutation(context.state, result.patch, 'runtime', context.stateSchema);
        writeJsonAtomic(context.statePath, next);
      }
      out({ next: result.next, stage: result.stage });
      if (result.next === 'pending') process.exitCode = 77;
      return;
    }
    case 'advance-stage': {
      const context = loadRunContext(flags);
      const result = advanceStage(context.state, context.workflow, { skillRoot: context.skillRoot, effectiveConfig: context.effectiveConfig });
      const next = applyMutation(context.state, result.patch, 'runtime', context.stateSchema);
      writeJsonAtomic(context.statePath, next);
      return out({ currentStage: result.currentStage });
    }
    case 'set-issue-context': return mutateWith(flags, 'issue-fetch', (state) => progress.setIssueContext(state, parsePayload(flags)));
    case 'record-node-progress': return mutateWith(flags, 'runtime', (state) => progress.recordNodeProgress(state, { stage: flags.stage, node: requireFlag(flags, 'node'), key: requireFlag(flags, 'key'), value: parseValue(requireFlag(flags, 'value')) }));
    case 'record-task-result': return mutateWith(flags, 'runtime', (state) => progress.recordTaskResult(state, { stage: flags.stage, taskId: requireFlag(flags, 'task-id'), status: requireFlag(flags, 'status') }));
    case 'record-node-failure': return mutateWith(flags, 'runtime', (state) => progress.recordNodeFailure(state, { stage: flags.stage, node: requireFlag(flags, 'node'), reason: flags.reason }));
    case 'mark-node-waiting-human': return mutateWith(flags, 'runtime', (state) => progress.markNodeWaitingHuman(state, { stage: flags.stage, node: requireFlag(flags, 'node'), reason: flags.reason }));
    case 'request-retry': {
      const context = loadRunContext(flags);
      const patch = progress.requestRetry(context.state, context.workflow, { from: requireFlag(flags, 'from'), target: requireFlag(flags, 'target'), reason: flags.reason });
      const next = applyMutation(context.state, patch, 'runtime', context.stateSchema);
      writeJsonAtomic(context.statePath, next);
      return out({ currentStage: next.currentStage });
    }
    case 'record-cleanup-result': return mutateWith(flags, 'runtime', (state) => progress.recordCleanupResult(state, { status: requireFlag(flags, 'status'), reason: flags.reason }));
    default: throw usageError(`未知子命令: ${command}\n\n${USAGE}`);
  }
}

function loadRunContext(flags) {
  const skillRoot = requireFlag(flags, 'skill-root');
  const statePath = requireFlag(flags, 'state');
  const state = readJson(statePath);
  const workflow = loadWorkflow(skillRoot, state.workflowPath);
  const effectiveConfig = composeConfig({ skillRoot, projectRoot: state.projectRoot, argsJson: JSON.stringify(state.args || {}) });
  return { skillRoot, statePath, state, workflow, effectiveConfig, stateSchema: loadStateSchema(skillRoot) };
}

function mutateWith(flags, writer, createPatch) {
  const context = loadRunContext(flags);
  const patch = createPatch(context.state);
  const next = applyMutation(context.state, patch, writer, context.stateSchema);
  writeJsonAtomic(context.statePath, next);
  return out({ updated: Object.keys(patch) });
}

function loadStateSchema(skillRoot) { return readJson(path.join(skillRoot, 'state.schema.json')); }
function requireFlag(flags, name) { const value = flags[name]; if (value === undefined || value === true) throw usageError(`缺少必需参数 --${name}`); return value; }
function parsePayload(flags) { const raw = flags['payload-json'] || fs.readFileSync(0, 'utf8'); return parseJsonFlag(raw, null); }
function parseJsonFlag(raw, fallback) { if (raw === undefined || raw === '') return fallback; try { return JSON.parse(raw); } catch (error) { throw usageError(`JSON 解析失败: ${error.message}`); } }
function parseValue(raw) { try { return JSON.parse(raw); } catch { return raw; } }
function formatCandidate(candidate) { return `[${candidate.phase}] ${candidate.state.runId || candidate.state.bootstrapId} ${candidate.state.currentStage} ${candidate.statePath}`; }
function out(value) { process.stdout.write(JSON.stringify(value, null, 2) + '\n'); }
function failure(message) { return Object.assign(new Error(message), { exitCode: 1 }); }
function usageError(message) { return Object.assign(new Error(message), { exitCode: 2 }); }
function fail(error) { process.stderr.write(String(error && error.message || error) + '\n'); process.exit(error && error.exitCode || 1); }

try { main(); } catch (error) { fail(error); }
