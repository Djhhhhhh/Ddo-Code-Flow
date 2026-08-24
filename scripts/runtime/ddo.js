#!/usr/bin/env node
'use strict';
const path = require('path');
const fs = require('fs');
const { parseArgs } = require('./lib/args');
const { readJson, readJsonIfExists, writeJsonAtomic } = require('./lib/json');
const { composeConfig } = require('./lib/config');
const { selectWorkflow, loadWorkflow, validateDag } = require('./lib/workflow');
const { initState, findResumable, applyMutation } = require('./lib/state');
const { nextNode } = require('./lib/nodes');
const { registerArtifact, validateOutput } = require('./lib/artifacts');
const { gate } = require('./lib/gate');
const { advanceStage } = require('./lib/advance');

const USAGE = [
  'ddo.js <subcommand> [--flags]',
  '',
  'Subcommands:',
  '  compose-config    Step 1  深合并 config，stdout JSON（不落盘）',
  '  select-workflow   Step 2  解析 workflowId/runType/workflowPath',
  '  validate-dag      Step 3  角色可达性校验（exit 1 拦截）',
  '  init-state        Step 4  新建 .state.json（内存，stdout JSON）',
  '  find-resumable    Step 4  扫描可恢复 run',
  '  next-node         Step 5  Kahn 选批 + 注入 {{inputs.*}} + 合并 options',
  '  register-artifact Step 5  stdin 产出 → 落盘 + artifacts + history',
  '  validate-output   P0.5   按 outputSchemaRef 校验产物（exit 1 拦截）',
  '  gate              Step 6  approved/rejected/pending',
  '  advance-stage     Step 7  终态硬检查后推进 currentStage',
].join('\n');

function fail(err) {
  process.stderr.write(String((err && err.message) || err) + '\n');
  process.exit((err && err.exitCode) || 1);
}

function out(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function requireFlag(flags, name) {
  const v = flags[name];
  if (v === undefined || v === true) {
    throw Object.assign(new Error(`缺少必需参数 --${name}`), { exitCode: 2 });
  }
  return v;
}

function loadStateSchema(skillRoot) {
  return readJson(path.join(skillRoot, 'state.schema.json'));
}

function main() {
  const { _, flags } = parseArgs(process.argv.slice(2));
  const cmd = _[0];
  if (flags.help || flags.h) { out({ usage: USAGE }); return; }
  if (!cmd) throw Object.assign(new Error(USAGE), { exitCode: 2 });

  switch (cmd) {
    case 'compose-config': {
      const skillRoot = requireFlag(flags, 'skill-root');
      const projectRoot = requireFlag(flags, 'project-root');
      out(composeConfig({ skillRoot, projectRoot, argsJson: flags['args-json'] }));
      return;
    }
    case 'select-workflow': {
      const skillRoot = requireFlag(flags, 'skill-root');
      out(selectWorkflow({
        skillRoot,
        model: flags.model,
        feature: !!flags.feature,
        bugfix: !!flags.bugfix,
        text: flags.text,
      }));
      return;
    }
    case 'validate-dag': {
      const skillRoot = requireFlag(flags, 'skill-root');
      const workflowPath = requireFlag(flags, 'workflow');
      const r = validateDag({ skillRoot, workflowPath });
      if (!r.valid) throw Object.assign(new Error('DAG 校验失败:\n' + r.errors.join('\n')), { exitCode: 1 });
      out({ valid: true });
      return;
    }
    case 'init-state': {
      const skillRoot = requireFlag(flags, 'skill-root');
      const projectRoot = requireFlag(flags, 'project-root');
      const workflowPath = requireFlag(flags, 'workflow');
      const state = initState({
        workflowId: flags['workflow-id'] || path.basename(workflowPath, '.json'),
        projectRoot,
        skillName: 'ddo-code-flow',
        skillVersion: '4.0.0',
        skillRoot,
        workflowPath,
        runType: flags['run-type'] || 'feat',
        args: flags['args-json'] ? JSON.parse(flags['args-json']) : {},
      });
      out(state);
      return;
    }
    case 'find-resumable': {
      const projectRoot = requireFlag(flags, 'project-root');
      const skillRoot = requireFlag(flags, 'skill-root');
      const stateSchema = loadStateSchema(skillRoot);
      const candidates = findResumable({ projectRoot, worktreeDir: flags['worktree-dir'], stateSchema });
      if (candidates.length > 1) {
        throw Object.assign(new Error(`存在 ${candidates.length} 个可恢复 run，需明确选择:\n` +
          candidates.map((c) => c.statePath).join('\n')), { exitCode: 1 });
      }
      out(candidates.length === 1
        ? { resumable: true, statePath: candidates[0].statePath, state: candidates[0].state }
        : { resumable: false });
      return;
    }
    case 'next-node': {
      const skillRoot = requireFlag(flags, 'skill-root');
      const statePath = requireFlag(flags, 'state');
      const state = readJson(statePath);
      const workflow = loadWorkflow(skillRoot, state.workflowPath);
      const config = composeConfig({ skillRoot, projectRoot: state.projectRoot, argsJson: JSON.stringify(state.args || {}) });
      out(nextNode({ state, workflow, skillRoot, config }));
      return;
    }
    case 'register-artifact': {
      const skillRoot = requireFlag(flags, 'skill-root');
      const statePath = requireFlag(flags, 'state');
      const role = requireFlag(flags, 'role');
      const state = readJson(statePath);
      const stdin = fs.readFileSync(0, 'utf8');
      const r = registerArtifact({ stdin, role, state, skillRoot, producer: flags.producer, stage: flags.stage });
      const next = applyMutation(state, {
        artifacts: { ...state.artifacts, [role]: r.artifactRecord },
        history: [...state.history, r.historyEvent],
      }, 'runtime', loadStateSchema(skillRoot));
      writeJsonAtomic(statePath, next);
      out({ path: r.path, role });
      return;
    }
    case 'validate-output': {
      const skillRoot = requireFlag(flags, 'skill-root');
      const artifactPath = requireFlag(flags, 'artifact');
      const outputSchemaRef = requireFlag(flags, 'output-schema-ref');
      const r = validateOutput({ artifactPath, outputSchemaRef, skillRoot });
      if (!r.valid) throw Object.assign(new Error('产出校验失败:\n' + r.errors.join('\n')), { exitCode: 1 });
      out({ valid: true });
      return;
    }
    case 'gate': {
      const skillRoot = requireFlag(flags, 'skill-root');
      const statePath = requireFlag(flags, 'state');
      const stage = requireFlag(flags, 'stage');
      const action = requireFlag(flags, 'action');
      const state = readJson(statePath);
      const r = gate(state, { stage, action, feedback: flags.feedback });
      if (r.next === 'pending') {
        out({ next: r.next, stage: r.stage });
        process.exitCode = 77;
        return;
      }
      const { patch, ...result } = r;
      const next = applyMutation(state, patch, 'runtime', loadStateSchema(skillRoot));
      writeJsonAtomic(statePath, next);
      out(result);
      return;
    }
    case 'advance-stage': {
      const skillRoot = requireFlag(flags, 'skill-root');
      const statePath = requireFlag(flags, 'state');
      const state = readJson(statePath);
      const workflow = loadWorkflow(skillRoot, state.workflowPath);
      const r = advanceStage(state, workflow);
      const next = applyMutation(state, r.patch, 'runtime', loadStateSchema(skillRoot));
      writeJsonAtomic(statePath, next);
      out({ currentStage: r.currentStage });
      return;
    }
    default:
      throw Object.assign(new Error(`未知子命令: ${cmd}\n\n${USAGE}`), { exitCode: 2 });
  }
}

try {
  main();
} catch (err) {
  fail(err);
}
