'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { readJson } = require('./json');
const { resolveEffectiveNode } = require('./effective-node');
const { validateOutput, validateOutputContent } = require('./output-validator');

function registerArtifact({ stdin = '', role, state, skillRoot, workflow, effectiveConfig = {}, producer, stage = state.currentStage }) {
  const catalog = readJson(path.join(skillRoot, 'atom-tasks', 'artifacts.json'));
  const roleDefinition = catalog.roles && catalog.roles[role];
  if (!roleDefinition) throw failure(`role "${role}" 未在 artifacts.json 登记`);
  if (!producer) throw failure('register-artifact 必须提供 workflow node producer');
  const effectiveNode = resolveEffectiveNode({ skillRoot, workflow, effectiveConfig, stageName: stage, nodeName: producer });
  const declaration = effectiveNode.produces.find((output) => output.role === role);
  if (!declaration) throw failure(`role "${role}" 不在 node ${producer} 的 produces 中`);
  const outputSchemaRef = declaration.primary ? effectiveNode.outputSchemaRef : null;

  if (!state.artifactDir) {
    const pendingOutput = makePendingOutput({ content: stdin, role, producer, task: effectiveNode.taskName, stage, outputSchemaRef });
    if (outputSchemaRef) assertOutputContent({ content: stdin, outputSchemaRef, skillRoot });
    const existing = state.pendingOutputs && state.pendingOutputs[role];
    if (existing && existing.contentHash !== pendingOutput.contentHash) throw failure(`pending role ${role} 已存在不同内容`);
    return {
      status: 'pending', role, path: null, absPath: null, artifactRecord: null,
      pendingOutput: existing || pendingOutput,
      historyEvent: existing ? null : { event: 'artifact-pending', at: pendingOutput.createdAt, stage, node: producer, task: effectiveNode.taskName, role },
    };
  }

  const artifactRoot = path.resolve(state.artifactDir);
  if (!state.worktreePath) throw failure('artifactDir 已设置但 worktreePath 缺失');
  assertWithin(path.resolve(state.worktreePath), artifactRoot, 'artifactDir');
  const relativePath = roleDefinition.file;
  if (!relativePath) throw failure(`role ${role} 没有固定 file，当前 runtime 不支持未定义 dynamic path`);
  const absolutePath = path.resolve(artifactRoot, relativePath);
  assertWithin(artifactRoot, absolutePath, `artifact role ${role}`);
  if (roleDefinition.kind === 'dir' || relativePath.endsWith('/')) {
    fs.mkdirSync(absolutePath, { recursive: true });
  } else {
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    const tempPath = path.join(path.dirname(absolutePath), `.${path.basename(absolutePath)}.tmp-${process.pid}-${Date.now()}`);
    fs.writeFileSync(tempPath, stdin, 'utf8');
    try {
      if (outputSchemaRef) assertOutputFile({ artifactPath: tempPath, outputSchemaRef, skillRoot });
      if (fs.existsSync(absolutePath)) {
        const existingHash = sha256(fs.readFileSync(absolutePath));
        const nextHash = sha256(Buffer.from(stdin));
        if (existingHash !== nextHash) throw failure(`artifact ${role} 已存在不同内容，拒绝覆盖`);
        fs.rmSync(tempPath);
      } else {
        fs.renameSync(tempPath, absolutePath);
      }
    } catch (error) {
      if (fs.existsSync(tempPath)) fs.rmSync(tempPath);
      throw error;
    }
  }

  const relativeToWorktree = path.relative(path.resolve(state.worktreePath), absolutePath).split(path.sep).join('/');
  if (relativeToWorktree.startsWith('../')) throw failure(`artifact ${role} 不在 worktreePath 内`);
  const now = new Date().toISOString();
  const artifactRecord = { path: `run://${relativeToWorktree}`, producer, task: effectiveNode.taskName, stage, at: now };
  return {
    status: 'registered', role, path: artifactRecord.path, absPath: absolutePath, artifactRecord, pendingOutput: null,
    historyEvent: { event: 'artifact-registered', at: now, stage, node: producer, task: effectiveNode.taskName, role },
  };
}

function makePendingOutput({ content, role, producer, task, stage, outputSchemaRef }) {
  return {
    role, producer, task, stage, encoding: 'base64',
    content: Buffer.from(content, 'utf8').toString('base64'),
    contentHash: sha256(Buffer.from(content, 'utf8')),
    outputSchemaRef: outputSchemaRef || null,
    createdAt: new Date().toISOString(),
  };
}

function assertOutputContent(args) {
  const result = validateOutputContent(args);
  if (!result.valid) throw failure(`产物校验失败:\n${result.errors.join('\n')}`);
}

function assertOutputFile(args) {
  const result = validateOutput(args);
  if (!result.valid) throw failure(`产物校验失败:\n${result.errors.join('\n')}`);
}

function assertWithin(root, target, label) {
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw failure(`${label} 路径越界`);
}

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function failure(message) { return Object.assign(new Error(message), { exitCode: 1 }); }

module.exports = { registerArtifact, validateOutput, makePendingOutput, sha256 };
