'use strict';
const { loadAtomTask } = require('./atom-task');

function resolveEffectiveNode({ skillRoot, workflow, effectiveConfig = {}, stageName, nodeName }) {
  const stage = (workflow.pipeline || []).find((item) => item.stage === stageName);
  if (!stage) throw failure(`未知 stage: ${stageName}`);
  const node = stage.atomTasks && stage.atomTasks.nodes && stage.atomTasks.nodes[nodeName];
  if (!node) throw failure(`stage ${stageName} 中不存在 node ${nodeName}`);
  const taskName = node.taskRef || nodeName;
  const task = loadAtomTask({ skillRoot, taskName });
  const frontmatter = task.frontmatter;
  const configOverride = effectiveConfig.atomTaskOverrides && effectiveConfig.atomTaskOverrides[taskName];
  const workflowOverride = workflow.atomTaskOverrides && workflow.atomTaskOverrides[taskName];
  const enabled = firstBoolean(
    workflowOverride && workflowOverride.enabled,
    configOverride && configOverride.enabled,
    node.enabled,
    frontmatter.enabled,
    true
  );
  const options = {};
  for (const option of frontmatter.options || []) options[option.key] = option.default;
  Object.assign(options, node.options || {});
  Object.assign(options, stripEnabled(configOverride));
  Object.assign(options, stripEnabled(workflowOverride));
  return {
    nodeName, taskName, stageName, node, task, frontmatter, enabled, options,
    consumes: frontmatter.consumes || [],
    produces: frontmatter.produces || [],
    outputSchemaRef: frontmatter.outputSchemaRef || null,
  };
}

function stripEnabled(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const copy = { ...value };
  delete copy.enabled;
  return copy;
}

function firstBoolean(...values) {
  for (const value of values) if (typeof value === 'boolean') return value;
  return true;
}

function failure(message) {
  return Object.assign(new Error(message), { exitCode: 1 });
}

module.exports = { resolveEffectiveNode };
