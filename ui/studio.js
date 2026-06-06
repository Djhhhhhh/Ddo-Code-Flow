"use strict";

const $ = (id) => document.getElementById(id);
const els = {
  banner: $("bannerHost"),
  languageToggle: $("languageToggleBtn"),
  open: $("openFolderBtn"),
  reload: $("reloadBtn"),
  save: $("saveBtn"),
  settingsBackdrop: $("settingsModalBackdrop"),
  settingsCancel: $("settingsCancelBtn"),
  settingsConfirm: $("settingsConfirmBtn"),
  targetDirInput: $("targetDirInput"),
  targetDirBtn: $("targetDirBtn"),
  targetDirValue: $("targetDirValue"),
  path: $("topbarPath"),
  taskList: $("taskList"),
  taskSearch: $("taskSearch"),
  scan: $("scanBtn"),
  atomsHint: $("atomsHint"),
  addStage: $("addStageBtn"),
  canvas: $("workflowCanvas"),
  edges: $("workflowEdges"),
  track: $("stageTrack"),
  pipelineHint: $("pipelineHint"),
  inspectorTitle: $("inspectorTitle"),
  inspectorBody: $("inspectorBody"),
};

const state = {
  dirHandle: null,
  mode: "fsapi",
  config: null,
  configSchema: null,
  atoms: [],
  selected: null,
  dirty: false,
  query: "",
  lang: localStorage.getItem("ddoStudioLang") || "en",
};

const i18n = {
  en: {
    subtitle: "AI Native SWE Skill Workflow Configuration",
    targetDirLabel: "Output directory",
    targetDirPickerTitle: "Output directory",
    cancel: "Cancel",
    confirm: "Confirm",
    targetDirUpdated: "Updated targetDir.",
    targetDirEmpty: "targetDir cannot be empty.",
    noFolder: "No skill folder opened",
    openFolder: "Open folder",
    reload: "Reload",
    save: "Save",
    atomRegistry: "Atom Task Registry",
    capabilities: "Capabilities",
    createAtomTask: "Create atom-task",
    searchAtomTask: "Search atom-task...",
    scan: "Scan",
    workflowTopology: "Workflow Topology",
    pipelineDag: "Pipeline DAG",
    insertStage: "Insert stage",
    exportPreset: "Export preset",
    importPreset: "Import preset",
    inspector: "Inspector",
    emptyInspector: "Select a workflow stage, injected atom-task, or registry item to configure it.",
    languageToggle: "中文",
    baseConfig: "Base config",
    openTaskFolder: "Open a skill folder to manage atom-tasks.",
    noTaskMatched: "No atom-task matched.",
    on: "ON",
    off: "OFF",
    broken: "broken",
    invalid: "invalid",
    noDescription: "No description available.",
    unknown: "unknown",
    dragToInject: "drag to inject",
    scannedOnly: "scanned from folder",
    uncategorized: "uncategorized",
    openWorkflowFolder: "Open a skill folder to visualize workflow topology.",
    dagError: "DAG error",
    stageCount: "stage(s)",
    atomCount: "atom-task(s)",
    noDescriptionStage: "No description.",
    parallel: "parallel",
    task: "task",
    injectedAtomTask: "Injected atom-task",
    dropAtomHere: "Drop atom-task here",
    nothingSelected: "Nothing selected",
    enabled: "Enabled",
    disabled: "Disabled",
    selectPlaceholder: "Select...",
    baseConfiguration: "Base Configuration",
    stageLabel: "Stage",
    nodeLabel: "Node",
    atomLabel: "Atom",
    stageId: "stage id",
    description: "description",
    stageEnabled: "stage enabled",
    humanConfirmGate: "human confirm gate",
    injectAtomTask: "inject atom-task",
    deleteStage: "Delete stage",
    atomTaskEnabled: "atom-task enabled",
    entryNode: "entry node",
    parallelApprove: "parallel approve",
    nextNodes: "next nodes",
    connectTo: "connect to",
    nodeConfiguration: "Node configuration",
    effectiveIoHint: "Save to refresh effective inputs merged from upstream connections.",
    dynamicFrom: "from {source}",
    downstreamNodes: "downstream (outputs feed into)",
    upstreamNodes: "upstream (inputs from)",
    declaredInputs: "Declared inputs (atom-task JSON)",
    noConnections: "None",
    atomAlreadyUsed: "This atom-task is already in the workflow. Each atom-task can only be used once.",
    atomAlreadyUsedIn: "Already used in stage {stage}",
    removeFromWorkflow: "Remove from workflow",
    removeAction: "Remove",
    viewAtomConfig: "Click to view atom-task configuration",
    configReferenceOnly: "config reference only",
    declaredStage: "declared stage",
    saveAtomJson: "Save atom-task JSON",
    deleteAtomTask: "Delete atom-task",
    json: "JSON",
    nodeJson: "Workflow node JSON",
    atomJson: "Atom-task JSON",
    stageJson: "Stage JSON",
    jsonHelpNode: "This JSON is the current node fragment under config.pipeline[].atomTasks.nodes.",
    jsonHelpAtom: "This JSON is the full atom-task file scanned from atom-tasks/<name>/<name>.json.",
    entryNodeHelp: "Entry node means this atom-task can start first within the current stage. Multiple entry nodes can start in parallel.",
    basicInfo: "Basic information",
    ioInfo: "IO",
    promptInfo: "Prompt",
    confirmationInfo: "Confirmation",
    concurrencyInfo: "Concurrency",
    inputs: "inputs",
    outputs: "outputs",
    instruction: "instruction",
    templateRef: "template ref",
    guardrails: "guardrails",
    rejectAction: "reject action",
    parallelizable: "parallelizable",
    timeoutSec: "timeoutSec",
    customWorkflowStage: "Custom workflow stage.",
    customAtomDescription: "Custom reusable atom-task.",
    customAtomInstruction: "Describe what this atom-task should do.",
    loaded: "Skill configuration loaded.",
    noFsapi: "Current browser does not support directory write access. Switched to import/export mode.",
    openFailed: "Open failed",
    readFailed: "Read failed",
    savedConfig: "Saved config.json.",
    exportedConfig: "Exported config.json.",
    saveFailed: "Save failed",
    dagValidationFailed: "DAG validation failed",
    schemaValidationFailed: "Schema validation failed",
    scanFailed: "Scan failed",
    fallbackScan: "Fallback mode cannot scan atom-tasks/.",
    openFirst: "Open a skill folder first.",
    atomExists: "atom-task already exists.",
    createdAtom: "Created atom-task",
    createFailed: "Create failed",
    savedAtom: "Saved",
    saveAtomFailed: "Save atom-task failed",
    deleteFailed: "Delete failed",
    presetMissingPipeline: "Preset is missing a pipeline array.",
    deleteStageConfirm: "Delete this workflow stage?",
    newAtomTaskName: "New atom-task name:",
    deleteAtomConfirm: "Delete atom-task '{name}' from disk and workflow references?",
    applyPresetConfirm: "Apply preset '{name}'? Current pipeline order will be replaced.",
    stageIdPrompt: "Stage id:",
    stageDescriptionPrompt: "Stage description:",
  },
  zh: {
    subtitle: "AI Native SWE Skill 工作流配置",
    targetDirLabel: "输出目录",
    targetDirPickerTitle: "输出目录",
    cancel: "取消",
    confirm: "确认",
    targetDirUpdated: "已更新 targetDir。",
    targetDirEmpty: "targetDir 不能为空。",
    noFolder: "未打开 Skill 目录",
    openFolder: "打开目录",
    reload: "重新加载",
    save: "保存",
    atomRegistry: "原子任务注册表",
    capabilities: "能力单元",
    createAtomTask: "创建 atom-task",
    searchAtomTask: "搜索 atom-task...",
    scan: "扫描",
    workflowTopology: "工作流拓扑",
    pipelineDag: "流水线 DAG",
    insertStage: "插入阶段",
    exportPreset: "导出预设",
    importPreset: "导入预设",
    inspector: "检查器",
    emptyInspector: "选择一个工作流阶段、注入的 atom-task 或注册表项进行配置。",
    languageToggle: "EN",
    baseConfig: "基础配置",
    openTaskFolder: "打开 skill 目录以管理 atom-task。",
    noTaskMatched: "没有匹配的 atom-task。",
    on: "开",
    off: "关",
    broken: "损坏",
    invalid: "无效",
    noDescription: "暂无描述。",
    unknown: "未知",
    dragToInject: "拖拽注入",
    scannedOnly: "从文件夹扫描",
    uncategorized: "未分类",
    openWorkflowFolder: "打开 skill 目录以查看工作流拓扑。",
    dagError: "DAG 错误",
    stageCount: "个阶段",
    atomCount: "个 atom-task",
    noDescriptionStage: "暂无描述。",
    parallel: "并行",
    task: "任务",
    injectedAtomTask: "已注入 atom-task",
    dropAtomHere: "拖放 atom-task 到这里",
    nothingSelected: "未选择",
    enabled: "已启用",
    disabled: "已禁用",
    selectPlaceholder: "请选择...",
    baseConfiguration: "基础配置",
    stageLabel: "阶段",
    nodeLabel: "节点",
    atomLabel: "原子任务",
    stageId: "阶段 ID",
    description: "描述",
    stageEnabled: "启用阶段",
    humanConfirmGate: "人工确认门",
    injectAtomTask: "注入 atom-task",
    deleteStage: "删除阶段",
    atomTaskEnabled: "启用 atom-task",
    entryNode: "入口节点",
    parallelApprove: "并行确认",
    nextNodes: "后续节点",
    connectTo: "连接到",
    nodeConfiguration: "节点配置",
    effectiveIoHint: "保存后将在此显示合并上游连接后的有效输入。",
    dynamicFrom: "来自 {source}",
    downstreamNodes: "下游连接（产出供其消费）",
    upstreamNodes: "上游连接（输入来源）",
    declaredInputs: "声明输入（atom-task JSON）",
    noConnections: "无",
    atomAlreadyUsed: "该 atom-task 已在工作流中，每个 atom-task 全局只能使用一次。",
    atomAlreadyUsedIn: "已用于阶段 {stage}",
    removeFromWorkflow: "从工作流移除",
    removeAction: "移除",
    viewAtomConfig: "点击查看 atom-task 配置",
    configReferenceOnly: "仅 config 引用",
    declaredStage: "声明阶段",
    saveAtomJson: "保存 atom-task JSON",
    deleteAtomTask: "删除 atom-task",
    json: "JSON",
    nodeJson: "工作流节点 JSON",
    atomJson: "Atom-task JSON",
    stageJson: "阶段 JSON",
    jsonHelpNode: "这里展示的是 config.pipeline[].atomTasks.nodes 下的当前节点片段。",
    jsonHelpAtom: "这里展示的是从 atom-tasks/<name>/<name>.json 扫描到的完整 atom-task 文件。",
    entryNodeHelp: "入口节点表示该 atom-task 可以在当前阶段内最先启动；多个入口节点可以并行启动。",
    basicInfo: "基本信息",
    ioInfo: "输入输出",
    promptInfo: "提示词",
    confirmationInfo: "确认配置",
    concurrencyInfo: "并发配置",
    inputs: "输入",
    outputs: "输出",
    instruction: "指令",
    templateRef: "模板引用",
    guardrails: "护栏",
    rejectAction: "拒绝动作",
    parallelizable: "可并行",
    timeoutSec: "超时秒数",
    customWorkflowStage: "自定义工作流阶段。",
    customAtomDescription: "自定义可复用 atom-task。",
    customAtomInstruction: "描述这个 atom-task 应该执行的工作。",
    loaded: "Skill 配置已加载。",
    noFsapi: "当前浏览器不支持目录写入，已切换为导入/导出模式。",
    openFailed: "打开失败",
    readFailed: "读取失败",
    savedConfig: "已保存 config.json。",
    exportedConfig: "已导出 config.json。",
    saveFailed: "保存失败",
    dagValidationFailed: "DAG 校验失败",
    schemaValidationFailed: "Schema 校验失败",
    scanFailed: "扫描失败",
    fallbackScan: "兼容模式无法扫描 atom-tasks/。",
    openFirst: "请先打开 skill 目录。",
    atomExists: "atom-task 已存在。",
    createdAtom: "已创建 atom-task",
    createFailed: "创建失败",
    savedAtom: "已保存",
    saveAtomFailed: "保存 atom-task 失败",
    deleteFailed: "删除失败",
    presetMissingPipeline: "Preset 缺少 pipeline 数组。",
    deleteStageConfirm: "删除这个工作流阶段？",
    newAtomTaskName: "新的 atom-task 名称：",
    deleteAtomConfirm: "从磁盘和工作流引用中删除 atom-task「{name}」？",
    applyPresetConfirm: "应用预设「{name}」？当前 pipeline 顺序将被替换。",
    stageIdPrompt: "阶段 ID：",
    stageDescriptionPrompt: "阶段描述：",
  },
};

function t(key) {
  return i18n[state.lang]?.[key] || i18n.en[key] || key;
}

function applyI18n() {
  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
  els.languageToggle.textContent = t("languageToggle");
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    if (node.id === "topbarPath" && state.dirHandle) return;
    if (node.id === "topbarPath" && state.path.textContent.startsWith("(imported)")) return;
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((node) => {
    node.title = t(node.dataset.i18nTitle);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  updateTargetDirBtn();
}

function updateTargetDirBtn() {
  if (!els.targetDirBtn || !els.targetDirValue) return;
  const dir = state.config?.base?.targetDir;
  els.targetDirBtn.disabled = !state.config;
  els.targetDirValue.textContent = dir || "—";
  els.targetDirBtn.title = dir || t("targetDirLabel");
}

function show(kind, message, autoMs = 2600) {
  const node = document.createElement("div");
  node.className = `banner banner--${kind}`;
  node.textContent = message;
  els.banner.appendChild(node);
  if (autoMs) setTimeout(() => node.remove(), autoMs);
}

function openTargetDirModal() {
  if (!state.config?.base) {
    show("warn", t("openFirst"));
    return;
  }
  els.targetDirInput.value = state.config.base.targetDir || "";
  document.getElementById("settingsModalTitle").textContent = t("targetDirPickerTitle");
  els.settingsBackdrop.hidden = false;
  requestAnimationFrame(() => els.targetDirInput.focus());
}

function closeSettingsModal() {
  els.settingsBackdrop.hidden = true;
}

function saveSettingsModal() {
  if (!state.config?.base) return;
  const nextDir = String(els.targetDirInput.value || "").trim();
  if (!nextDir) {
    show("warn", t("targetDirEmpty"));
    els.targetDirInput.focus();
    return;
  }
  state.config.base.targetDir = nextDir;
  markDirty();
  updateTargetDirBtn();
  renderInspector();
  closeSettingsModal();
  show("info", t("targetDirUpdated"));
}

function markDirty() {
  state.dirty = true;
  els.save.disabled = !state.config;
}

function markClean() {
  state.dirty = false;
  els.save.disabled = !state.config;
}

function safeName(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function atomByName(name) {
  return state.atoms.find((atom) => atom.name === name);
}

function stageAt(index) {
  return state.config?.pipeline?.[index] || null;
}

function usedAtomNames() {
  const set = new Set();
  for (const stage of state.config?.pipeline || []) {
    Object.keys(stage.atomTasks?.nodes || {}).forEach((name) => set.add(name));
  }
  return set;
}

function atomStageLocation(name) {
  for (const [stageIndex, stage] of (state.config?.pipeline || []).entries()) {
    if (stage.atomTasks?.nodes?.[name]) return { stageIndex, stageName: stage.stage };
  }
  return null;
}

function availableAtomsForInject() {
  const used = usedAtomNames();
  return state.atoms.map((atom) => atom.name).filter((name) => !used.has(name)).sort();
}

function globalNodeRefs(excludeName = "") {
  const refs = [];
  for (const [stageIndex, stage] of (state.config?.pipeline || []).entries()) {
    for (const nodeName of Object.keys(stage.atomTasks?.nodes || {})) {
      if (nodeName === excludeName) continue;
      refs.push({ value: nodeName, label: `${stage.stage} / ${nodeName}`, name: nodeName, stageIndex });
    }
  }
  return refs;
}

function getPredecessors(name) {
  const out = [];
  for (const [stageIndex, stage] of (state.config?.pipeline || []).entries()) {
    for (const [from, def] of Object.entries(stage.atomTasks?.nodes || {})) {
      if ((def.next || []).includes(name)) {
        out.push({ value: from, label: `${stage.stage} / ${from}`, stageIndex });
      }
    }
  }
  return out;
}

function syncStageEntry(stage) {
  if (!stage?.atomTasks) return;
  const names = Object.keys(stage.atomTasks.nodes || {});
  const hasSameStagePred = new Set();
  for (const def of Object.values(stage.atomTasks.nodes || {})) {
    for (const next of def.next || []) {
      if (names.includes(next)) hasSameStagePred.add(next);
    }
  }
  stage.atomTasks.entry = names.filter((name) => !hasSameStagePred.has(name));
}

function syncAllStageEntries(config = state.config) {
  for (const stage of config?.pipeline || []) syncStageEntry(stage);
}

function removeNextEdge(fromName, toName) {
  const loc = atomStageLocation(fromName);
  if (!loc) return;
  const stage = stageAt(loc.stageIndex);
  const node = stage?.atomTasks?.nodes?.[fromName];
  if (!node) return;
  node.next = (node.next || []).filter((item) => item !== toName);
  syncAllStageEntries();
}

function allAtomNames() {
  const names = new Set(state.atoms.map((atom) => atom.name));
  for (const stage of state.config?.pipeline || []) {
    Object.keys(stage.atomTasks?.nodes || {}).forEach((name) => names.add(name));
  }
  Object.keys(state.config?.atomTaskOverrides || {}).forEach((name) => names.add(name));
  return [...names].sort();
}

function effectiveEnabled(name) {
  const override = state.config?.atomTaskOverrides?.[name];
  if (override && typeof override.enabled === "boolean") return override.enabled;
  const atom = atomByName(name);
  return atom?.json?.enabled !== false;
}

function isParallelCapable(stage, name) {
  const entries = stage?.atomTasks?.entry || [];
  return entries.length > 1 && entries.includes(name);
}

function setEnabled(name, enabled) {
  if (!state.config.atomTaskOverrides) state.config.atomTaskOverrides = {};
  state.config.atomTaskOverrides[name] = { enabled };
  markDirty();
}

function normalizeConfig(config) {
  config.atomTaskOverrides ||= {};
  config.base ||= {};
  config.base.contextPaths ||= [];
  config.base.confirmationGates ||= [];
  config.base.respGenerator ||= { maxLength: 32, case: "kebab", stripStopwords: true };
  config.pipeline ||= [];
  for (const stage of config.pipeline) {
    stage.enabled = stage.enabled !== false;
    stage.atomTasks ||= { entry: [], nodes: {} };
    if (Array.isArray(stage.atomTasks)) {
      const nodes = {};
      stage.atomTasks.forEach((name, index) => {
        nodes[name] = { next: index + 1 < stage.atomTasks.length ? [stage.atomTasks[index + 1]] : [], parallelApprove: false };
      });
      stage.atomTasks = { entry: stage.atomTasks.length ? [stage.atomTasks[0]] : [], nodes };
    }
    stage.atomTasks.entry ||= [];
    stage.atomTasks.nodes ||= {};
    for (const node of Object.values(stage.atomTasks.nodes)) {
      node.next ||= [];
      node.parallelApprove = node.parallelApprove === true;
      node.parallelWith ||= [];
    }
  }
  syncAllStageEntries(config);
}

const Schema = (() => {
  function resolve(ref, root) {
    if (!ref.startsWith("#/")) return null;
    return ref.slice(2).split("/").reduce((node, key) => node?.[key], root);
  }
  function validate(value, schema, root, path, errors) {
    if (!schema) return;
    if (schema.$ref) return validate(value, resolve(schema.$ref, root), root, path, errors);
    if (schema.type) {
      const ok =
        (schema.type === "object" && value && typeof value === "object" && !Array.isArray(value)) ||
        (schema.type === "array" && Array.isArray(value)) ||
        (schema.type === "string" && typeof value === "string") ||
        (schema.type === "integer" && Number.isInteger(value)) ||
        (schema.type === "number" && typeof value === "number") ||
        (schema.type === "boolean" && typeof value === "boolean") ||
        (schema.type === "null" && value === null);
      if (!ok) { errors.push(`${path}: expected ${schema.type}`); return; }
    }
    if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: not in enum`);
    if (schema.pattern && typeof value === "string" && !(new RegExp(schema.pattern)).test(value)) errors.push(`${path}: pattern mismatch`);
    if (typeof schema.minLength === "number" && typeof value === "string" && value.length < schema.minLength) errors.push(`${path}: too short`);
    if (typeof schema.minimum === "number" && typeof value === "number" && value < schema.minimum) errors.push(`${path}: below minimum`);
    if (typeof schema.maximum === "number" && typeof value === "number" && value > schema.maximum) errors.push(`${path}: above maximum`);
    if (Array.isArray(value)) {
      if (typeof schema.minItems === "number" && value.length < schema.minItems) errors.push(`${path}: below minItems`);
      if (typeof schema.maxItems === "number" && value.length > schema.maxItems) errors.push(`${path}: above maxItems`);
      if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${path}: duplicate items`);
      value.forEach((item, index) => validate(item, schema.items, root, `${path}[${index}]`, errors));
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const key of schema.required || []) if (!(key in value)) errors.push(`${path}.${key}: required`);
      for (const [key, sub] of Object.entries(schema.properties || {})) if (key in value) validate(value[key], sub, root, `${path}.${key}`, errors);
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(value)) if (!(key in (schema.properties || {}))) errors.push(`${path}.${key}: additional property`);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        for (const key of Object.keys(value)) if (!(key in (schema.properties || {}))) validate(value[key], schema.additionalProperties, root, `${path}.${key}`, errors);
      }
    }
  }
  return { check(value, schema) { const errors = []; validate(value, schema, schema, "$", errors); return { ok: errors.length === 0, errors }; } };
})();

const DAG = (() => {
  function duplicateErrors(config) {
    const seen = new Map();
    const errors = [];
    for (const stage of config.pipeline || []) {
      for (const name of Object.keys(stage.atomTasks?.nodes || {})) {
        if (seen.has(name)) errors.push(`duplicate atom-task '${name}' in stages ${seen.get(name)} and ${stage.stage}`);
        else seen.set(name, stage.stage);
      }
    }
    return errors;
  }

  function globalCycleErrors(config) {
    const names = [...(config.pipeline || []).flatMap((stage) => Object.keys(stage.atomTasks?.nodes || {}))];
    const indeg = new Map(names.map((name) => [name, 0]));
    const adj = new Map(names.map((name) => [name, []]));
    for (const stage of config.pipeline || []) {
      for (const [from, def] of Object.entries(stage.atomTasks?.nodes || {})) {
        for (const to of def.next || []) {
          if (!indeg.has(to)) continue;
          adj.get(from).push(to);
          indeg.set(to, indeg.get(to) + 1);
        }
      }
    }
    const queue = [...indeg].filter(([, degree]) => degree === 0).map(([name]) => name);
    const seen = new Set();
    while (queue.length) {
      const name = queue.shift();
      seen.add(name);
      for (const next of adj.get(name) || []) {
        indeg.set(next, indeg.get(next) - 1);
        if (indeg.get(next) === 0) queue.push(next);
      }
    }
    if (seen.size === names.length) return [];
    return [`global DAG cycle detected involving [${names.filter((name) => !seen.has(name)).join(", ")}]`];
  }

  function checkStage(stage, allNames) {
    const errors = [];
    const nodes = stage.atomTasks?.nodes || {};
    const names = Object.keys(nodes);
    for (const entry of stage.atomTasks?.entry || []) if (!names.includes(entry)) errors.push(`${stage.stage}: entry ${entry} is missing`);
    for (const [name, def] of Object.entries(nodes)) {
      for (const next of def.next || []) if (!allNames.has(next)) errors.push(`${stage.stage}: ${name} -> ${next} is missing`);
      for (const next of def.parallelWith || []) if (!allNames.has(next)) errors.push(`${stage.stage}: ${name} => ${next} is missing`);
    }
    const indeg = new Map(names.map((name) => [name, 0]));
    for (const def of Object.values(nodes)) for (const next of def.next || []) if (indeg.has(next)) indeg.set(next, indeg.get(next) + 1);
    const queue = [...indeg].filter(([, degree]) => degree === 0).map(([name]) => name);
    const seen = new Set();
    while (queue.length) {
      const name = queue.shift();
      seen.add(name);
      for (const next of nodes[name].next || []) {
        if (!indeg.has(next)) continue;
        indeg.set(next, indeg.get(next) - 1);
        if (indeg.get(next) === 0) queue.push(next);
      }
    }
    if (seen.size !== names.length) errors.push(`${stage.stage}: cycle detected`);
    return errors;
  }
  return {
    checkConfig(config) {
      const allNames = new Set((config.pipeline || []).flatMap((stage) => Object.keys(stage.atomTasks?.nodes || {})));
      return [
        ...duplicateErrors(config),
        ...globalCycleErrors(config),
        ...(config.pipeline || []).flatMap((stage) => checkStage(stage, allNames)),
      ];
    },
  };
})();

const FS = (() => {
  const supports = typeof window.showDirectoryPicker === "function";
  async function readJSON(relPath) {
    const parts = relPath.split("/").filter(Boolean);
    let handle = state.dirHandle;
    for (let i = 0; i < parts.length - 1; i++) handle = await handle.getDirectoryHandle(parts[i]);
    const file = await (await handle.getFileHandle(parts.at(-1))).getFile();
    return JSON.parse(await file.text());
  }
  async function writeJSON(relPath, obj) {
    if (state.mode === "fallback") return exportConfig();
    const parts = relPath.split("/").filter(Boolean);
    let handle = state.dirHandle;
    for (let i = 0; i < parts.length - 1; i++) handle = await handle.getDirectoryHandle(parts[i], { create: true });
    const file = await handle.getFileHandle(parts.at(-1), { create: true });
    const writer = await file.createWritable();
    await writer.write(JSON.stringify(obj, null, 2) + "\n");
    await writer.close();
  }
  async function listAtoms() {
    if (state.mode === "fallback") return [];
    const dir = await state.dirHandle.getDirectoryHandle("atom-tasks");
    const out = [];
    for await (const [name, entry] of dir.entries()) {
      if (entry.kind !== "directory" || name.startsWith("_")) continue;
      try {
        const file = await (await entry.getFileHandle(`${name}.json`)).getFile();
        out.push({ name, json: JSON.parse(await file.text()), broken: false });
      } catch (error) {
        out.push({ name, json: null, broken: true, reason: error.message });
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }
  return { supports, readJSON, writeJSON, listAtoms };
})();

async function openFolder() {
  if (!FS.supports) {
    state.mode = "fallback";
    show("warn", t("noFsapi"), 0);
    importConfigFile();
    return;
  }
  try {
    state.dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    state.mode = "fsapi";
    els.path.textContent = state.dirHandle.name + "/";
    await loadAll();
  } catch (error) {
    if (error.name !== "AbortError") show("error", `${t("openFailed")}：${error.message}`, 0);
  }
}

async function loadAll() {
  try {
    state.config = await FS.readJSON("config.json");
    try { state.configSchema = await FS.readJSON("config.schema.json"); } catch (_) { state.configSchema = null; }
    normalizeConfig(state.config);
    state.atoms = await FS.listAtoms();
    els.reload.disabled = false;
    markClean();
    renderAll();
    show("info", t("loaded"));
  } catch (error) {
    show("error", `${t("readFailed")}：${error.message}`, 0);
  }
}

async function reloadAll() {
  if (state.mode === "fallback") return importConfigFile();
  await loadAll();
}

async function saveAll() {
  if (!state.config) return;
  const dagErrors = DAG.checkConfig(state.config);
  if (dagErrors.length) {
    show("error", `${t("dagValidationFailed")}：${dagErrors[0]}`, 0);
    return;
  }
  if (state.configSchema) {
    const result = Schema.check(state.config, state.configSchema);
    if (!result.ok) {
      show("error", `${t("schemaValidationFailed")}：${result.errors.slice(0, 3).join("; ")}`, 0);
      return;
    }
  }
  try {
    await FS.writeJSON("config.json", state.config);
    markClean();
    renderInspector();
    show("info", state.mode === "fallback" ? t("exportedConfig") : t("savedConfig"));
  } catch (error) {
    show("error", `${t("saveFailed")}：${error.message}`, 0);
  }
}

function importConfigFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    state.mode = "fallback";
    state.config = JSON.parse(await file.text());
    normalizeConfig(state.config);
    els.path.textContent = `(imported) ${file.name}`;
    markClean();
    renderAll();
  };
  input.click();
}

function exportConfig() {
  const blob = new Blob([JSON.stringify(state.config, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "config.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function scanAtoms() {
  if (!state.config) return show("warn", t("openFirst"));
  if (state.mode === "fallback") return show("warn", t("fallbackScan"));
  try {
    state.atoms = await FS.listAtoms();
    els.atomsHint.textContent = `${state.atoms.length} atom-task(s)`;
    renderAll();
  } catch (error) {
    show("error", `${t("scanFailed")}：${error.message}`, 0);
  }
}

function renderAll() {
  applyI18n();
  renderTasks();
  renderWorkflow();
  renderInspector();
}

function renderTasks() {
  els.taskList.innerHTML = "";
  if (!state.config) {
    els.taskList.innerHTML = `<div class="empty-state">${t("openTaskFolder")}</div>`;
    return;
  }
  const query = state.query.toLowerCase();
  const items = state.atoms
    .filter((item) => !query || item.name.toLowerCase().includes(query) || (item.json?.description || "").toLowerCase().includes(query));
  if (!items.length) {
    els.taskList.innerHTML = `<div class="empty-state">${t("noTaskMatched")}</div>`;
    return;
  }
  const groups = new Map();
  for (const item of items) {
    const stage = item.json?.stage || t("uncategorized");
    if (!groups.has(stage)) groups.set(stage, []);
    groups.get(stage).push(item);
  }
  for (const [stage, stageItems] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const group = document.createElement("section");
    group.className = "task-group";
    group.innerHTML = `<div class="task-group__title">${stage}<span>${stageItems.length}</span></div>`;
    for (const item of stageItems) group.appendChild(taskCard(item));
    els.taskList.appendChild(group);
  }
}

function taskCard(item) {
  const loc = atomStageLocation(item.name);
  const inPipeline = !!loc;
  const card = document.createElement("div");
  card.className = `task-card${state.selected?.type === "atom" && state.selected.name === item.name ? " is-selected" : ""}${inPipeline ? " is-used" : ""}`;
  card.draggable = !inPipeline;
  if (inPipeline) card.title = `${t("atomAlreadyUsedIn").replace("{stage}", loc.stageName)} · ${t("viewAtomConfig")}`;
  else card.title = t("viewAtomConfig");
  card.innerHTML = `
    <div class="task-card__head">
      <div class="task-card__title">${item.name}${inPipeline ? `<span class="badge">${loc.stageName}</span>` : ""}</div>
    </div>
    <div class="task-card__desc">${item.broken ? `${t("broken")}: ${item.reason || t("invalid")}` : item.json?.description || t("noDescription")}</div>`;
  card.onclick = () => select({ type: "atom", name: item.name });
  card.ondragstart = (event) => {
    if (inPipeline) {
      event.preventDefault();
      show("warn", t("atomAlreadyUsed"), 2800);
      return;
    }
    event.dataTransfer.setData("text/atom-name", item.name);
  };
  return card;
}

function renderWorkflow() {
  els.track.innerHTML = "";
  els.edges.innerHTML = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"></path></marker></defs>`;
  if (!state.config) {
    els.track.innerHTML = `<div class="empty-state">${t("openWorkflowFolder")}</div>`;
    return;
  }
  state.config.pipeline.forEach((stage, index) => els.track.appendChild(stageCard(stage, index)));
  requestAnimationFrame(redrawEdges);
  const errors = DAG.checkConfig(state.config);
  els.pipelineHint.textContent = errors.length ? `${t("dagError")}: ${errors[0]}` : `${state.config.pipeline.length} ${t("stageCount")}, ${allAtomNames().length} ${t("atomCount")}.`;
  updateTargetDirBtn();
}

function stageCard(stage, index) {
  const card = document.createElement("div");
  card.className = `stage-card${stage.enabled === false ? " is-disabled" : ""}${state.selected?.type === "stage" && state.selected.index === index ? " is-selected" : ""}`;
  card.dataset.stageIndex = String(index);
  card.innerHTML = `
    <div class="stage-card__top">
      <div class="stage-card__summary">
        <div class="stage-card__title">${stage.stage}</div>
        <div class="stage-card__desc">${stage.description || t("noDescriptionStage")}</div>
      </div>
    </div>
    <div class="stage-card__dropzone">
      <div class="node-list"></div>
    </div>`;
  card.onclick = (event) => {
    if (event.target.closest(".node-pill")) return;
    select({ type: "stage", index });
  };
  card.ondragover = (event) => event.preventDefault();
  card.ondrop = (event) => {
    event.preventDefault();
    const name = event.dataTransfer.getData("text/atom-name");
    if (name) injectAtom(index, name);
  };
  const list = card.querySelector(".node-list");
  const nodes = Object.entries(stage.atomTasks?.nodes || {});
  if (!nodes.length) {
    const empty = document.createElement("div");
    empty.className = "drop-hint";
    empty.textContent = t("dropAtomHere");
    list.appendChild(empty);
  }
  for (const [name, node] of nodes) {
    const atom = atomByName(name);
    const enabled = effectiveEnabled(name);
    const isInspectorSelected = state.selected?.type === "node" && state.selected.stageIndex === index && state.selected.name === name;
    const parallelCapable = isParallelCapable(stage, name);
    const pill = document.createElement("div");
    pill.className = `node-pill${isInspectorSelected ? " is-selected" : ""}${parallelCapable ? " is-parallel-batch" : ""}${enabled ? "" : " is-disabled"}`;
    pill.dataset.nodeName = name;
    pill.dataset.disabledLabel = t("disabled");
    pill.innerHTML = `
      <div class="node-row"><div class="node-pill__title">${name}</div></div>
      <div class="node-pill__desc">${atom?.json?.description || t("injectedAtomTask")}</div>`;
    pill.onclick = (event) => {
      event.stopPropagation();
      select({ type: "node", stageIndex: index, name });
    };
    list.appendChild(pill);
  }
  return card;
}

function redrawEdges() {
  if (!state.config) return;
  const canvasRect = els.canvas.getBoundingClientRect();
  els.edges.setAttribute("width", String(Math.max(els.canvas.scrollWidth, canvasRect.width)));
  els.edges.setAttribute("height", String(Math.max(els.canvas.scrollHeight, canvasRect.height)));
  const nodeEl = (stageIndex, name) => els.track.querySelector(`[data-stage-index="${stageIndex}"] [data-node-name="${CSS.escape(name)}"]`);
  const nodeElByName = (name) => {
    const loc = atomStageLocation(name);
    return loc ? nodeEl(loc.stageIndex, name) : null;
  };
  const mk = (a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const ax = ar.right - canvasRect.left + els.canvas.scrollLeft;
    const ay = ar.top + ar.height / 2 - canvasRect.top + els.canvas.scrollTop;
    const bx = br.left - canvasRect.left + els.canvas.scrollLeft;
    const by = br.top + br.height / 2 - canvasRect.top + els.canvas.scrollTop;
    const mid = (ax + bx) / 2;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${ax} ${ay} C ${mid} ${ay}, ${mid} ${by}, ${bx} ${by}`);
    path.setAttribute("marker-end", "url(#arrow)");
    els.edges.appendChild(path);
  };
  els.edges.querySelectorAll("path").forEach((path) => {
    if (!path.closest("marker")) path.remove();
  });
  state.config.pipeline.forEach((stage, stageIndex) => {
    for (const [from, def] of Object.entries(stage.atomTasks?.nodes || {})) {
      for (const to of def.next || []) {
        const a = nodeEl(stageIndex, from);
        const b = nodeElByName(to);
        if (a && b) mk(a, b);
      }
    }
  });
}

function renderInspector() {
  els.inspectorBody.innerHTML = "";
  if (!state.config || !state.selected) {
    els.inspectorTitle.textContent = t("nothingSelected");
    els.inspectorBody.innerHTML = `<div class="empty-state">${t("emptyInspector")}</div>`;
    return;
  }
  if (state.selected.type === "base") return renderBaseInspector();
  if (state.selected.type === "stage") return renderStageInspector(stageAt(state.selected.index), state.selected.index);
  if (state.selected.type === "node") return renderNodeInspector(stageAt(state.selected.stageIndex), state.selected.stageIndex, state.selected.name);
  if (state.selected.type === "atom") return renderAtomInspector(state.selected.name);
}

function field(label, control) {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const lab = document.createElement("label");
  lab.textContent = label;
  wrap.append(lab, control);
  return wrap;
}

function input(value, oninput, type = "text") {
  const el = document.createElement("input");
  el.className = "input";
  el.type = type;
  el.value = value ?? "";
  el.oninput = () => oninput(type === "number" ? Number(el.value) : el.value);
  return el;
}

function textarea(value, oninput) {
  const el = document.createElement("textarea");
  el.className = "textarea";
  el.value = value ?? "";
  el.oninput = () => oninput(el.value);
  return el;
}

function toggleRow(label, checked, onchange) {
  const row = document.createElement("div");
  row.className = "switch-row";
  const text = document.createElement("span");
  text.textContent = label;
  const btn = document.createElement("button");
  btn.className = `btn ${checked ? "btn-primary" : "btn-secondary"}`;
  btn.textContent = checked ? t("enabled") : t("disabled");
  btn.onclick = () => onchange(!checked);
  row.append(text, btn);
  return row;
}

function switchActionRow(label, actionLabel, onclick, { danger = false } = {}) {
  const row = document.createElement("div");
  row.className = "switch-row";
  const text = document.createElement("span");
  text.textContent = label;
  const btn = document.createElement("button");
  btn.className = `btn btn-secondary${danger ? " danger" : ""}`;
  btn.textContent = actionLabel;
  btn.onclick = onclick;
  row.append(text, btn);
  return row;
}

function renderBaseInspector() {
  const base = state.config.base;
  els.inspectorTitle.textContent = t("baseConfiguration");
  els.inspectorBody.append(
    field("contextPaths", textarea((base.contextPaths || []).join("\n"), (value) => { base.contextPaths = value.split("\n").map((v) => v.trim()).filter(Boolean); markDirty(); })),
    toggleRow("contextOptional", base.contextOptional !== false, (value) => { base.contextOptional = value; markDirty(); renderInspector(); }),
    field("confirmationGates", textarea((base.confirmationGates || []).join("\n"), (value) => { base.confirmationGates = value.split("\n").map((v) => v.trim()).filter(Boolean); markDirty(); })),
    field("respGenerator.maxLength", input(base.respGenerator.maxLength, (value) => { base.respGenerator.maxLength = value || 1; markDirty(); }, "number")),
    field("respGenerator.case", select(["kebab", "snake", "camel"], base.respGenerator.case, (value) => { base.respGenerator.case = value; markDirty(); })),
    toggleRow("stripStopwords", base.respGenerator.stripStopwords, (value) => { base.respGenerator.stripStopwords = value; markDirty(); renderInspector(); }),
  );
}

function renderStageInspector(stage, index) {
  if (!stage) return;
  els.inspectorTitle.textContent = `${t("stageLabel")} / ${stage.stage}`;
  els.inspectorBody.append(
    field(t("stageId"), input(stage.stage, (value) => { stage.stage = safeName(value); markDirty(); renderWorkflow(); })),
    field(t("description"), textarea(stage.description, (value) => { stage.description = value; markDirty(); renderWorkflow(); })),
    toggleRow(t("stageEnabled"), stage.enabled !== false, (value) => { stage.enabled = value; markDirty(); renderWorkflow(); renderInspector(); }),
    toggleRow(t("humanConfirmGate"), state.config.base.confirmationGates.includes(stage.stage), (value) => toggleGate(stage.stage, value)),
    field(t("injectAtomTask"), select(["", ...availableAtomsForInject()], "", (atomName) => { if (atomName) injectAtom(index, atomName); })),
    actionButton(t("deleteStage"), "danger", () => deleteStage(index)),
    preview(stage, t("stageJson")),
  );
}

function renderNodeInspector(stage, stageIndex, name) {
  const node = stage?.atomTasks?.nodes?.[name];
  if (!node) return;
  const preds = getPredecessors(name);
  const downstream = (node.next || []).map((target) => {
    const loc = atomStageLocation(target);
    return { value: target, label: loc ? `${loc.stageName} / ${target}` : target };
  });
  const graphTargets = globalNodeRefs(name);
  els.inspectorTitle.textContent = `${t("nodeLabel")} / ${name}`;
  els.inspectorBody.append(
    toggleRow(t("atomTaskEnabled"), effectiveEnabled(name), (value) => { setEnabled(name, value); renderAll(); }),
    switchActionRow(t("removeFromWorkflow"), t("removeAction"), () => removeNode(stage, name), { danger: true }),
    nodeConfigCard([
      connectionListField(t("upstreamNodes"), preds, graphTargets, (from) => {
        const loc = atomStageLocation(from);
        const srcStage = stageAt(loc?.stageIndex);
        const src = srcStage?.atomTasks?.nodes?.[from];
        if (src && !src.next.includes(name)) {
          src.next.push(name);
          syncAllStageEntries();
          markDirty();
          renderAll();
        }
      }, (from) => {
        removeNextEdge(from, name);
        markDirty();
        renderAll();
      }),
      connectionListField(t("downstreamNodes"), downstream, graphTargets, (to) => {
        if (!node.next.includes(to)) {
          node.next.push(to);
          syncAllStageEntries();
          markDirty();
          renderAll();
        }
      }, (to) => {
        node.next = (node.next || []).filter((item) => item !== to);
        syncAllStageEntries();
        markDirty();
        renderAll();
      }),
    ]),
    atomInfoPanel(atomByName(name)?.json, name),
    preview({ name, ...node }, t("nodeJson"), t("jsonHelpNode")),
  );
}

function renderAtomInspector(name) {
  const item = atomByName(name) || { name, json: null };
  const json = item.json;
  els.inspectorTitle.textContent = `${t("atomLabel")} / ${name}`;
  if (!json) {
    els.inspectorBody.append(preview({ name, source: t("configReferenceOnly") }, t("nodeJson"), t("jsonHelpNode")));
    return;
  }
  els.inspectorBody.append(
    atomInfoPanel(json),
    preview(json, t("atomJson"), t("jsonHelpAtom")),
  );
}

function helpText(text) {
  const node = document.createElement("div");
  node.className = "help-text";
  node.textContent = text;
  return node;
}

function nodeConfigCard(children) {
  const card = document.createElement("section");
  card.className = "node-config-card";
  const title = document.createElement("h3");
  title.textContent = t("nodeConfiguration");
  card.appendChild(title);
  for (const child of children) card.appendChild(child);
  return card;
}

function connectionListField(label, items, optionRefs, onAdd, onRemove, help) {
  const wrap = document.createElement("div");
  wrap.className = "connection-field";
  const lab = document.createElement("label");
  lab.textContent = label;
  wrap.appendChild(lab);
  if (onAdd) {
    const connected = new Set(items.map((item) => item.value));
    const available = optionRefs.filter((option) => option.value && !connected.has(option.value));
    wrap.appendChild(select([{ value: "", label: t("selectPlaceholder") }, ...available], "", onAdd));
  }
  const chips = document.createElement("div");
  chips.className = "chip-list";
  if (!items.length) {
    const empty = document.createElement("span");
    empty.className = "hint";
    empty.textContent = t("noConnections");
    chips.appendChild(empty);
  }
  for (const item of items) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = item.label;
    const x = document.createElement("button");
    x.type = "button";
    x.className = "chip__remove";
    x.textContent = "×";
    x.onclick = () => onRemove(item.value);
    chip.appendChild(x);
    chips.appendChild(chip);
  }
  wrap.appendChild(chips);
  if (help) wrap.appendChild(helpText(help));
  return wrap;
}

function formatEffectiveInputs(nodeName, json) {
  const lines = [];
  for (const pred of getPredecessors(nodeName)) {
    const atom = atomByName(pred.value);
    for (const output of atom?.json?.io?.outputs || []) {
      lines.push(`${output.ref} (${t("dynamicFrom").replace("{source}", pred.label)})`);
    }
  }
  for (const input of json?.io?.inputs || []) {
    lines.push(`${input.ref}${input.required === false ? "?" : ""}`);
  }
  return lines.length ? lines.join(", ") : "-";
}

function atomInfoPanel(json, nodeName = "") {
  const wrap = document.createElement("section");
  wrap.className = "info-panel";
  if (!json) {
    wrap.appendChild(helpText(t("configReferenceOnly")));
    return wrap;
  }
  const showEffectiveIo = nodeName && !state.dirty;
  const inputsText = showEffectiveIo
    ? formatEffectiveInputs(nodeName, json)
    : (json.io?.inputs || []).map((item) => `${item.ref}${item.required === false ? "?" : ""}`).join(", ") || "-";
  const outputsText = (json.io?.outputs || []).map((item) => `${item.ref} (${item.kind})`).join(", ") || "-";
  wrap.innerHTML = `
    <h3>${t("basicInfo")}</h3>
    <dl class="info-grid">
      <dt>name</dt><dd>${json.name || ""}</dd>
      <dt>version</dt><dd>${json.version || ""}</dd>
      <dt>${t("declaredStage")}</dt><dd>${json.stage || ""}</dd>
      <dt>${t("description")}</dt><dd>${json.description || ""}</dd>
      <dt>${t("enabled")}</dt><dd>${json.enabled === false ? t("disabled") : t("enabled")}</dd>
      <dt>${t("timeoutSec")}</dt><dd>${json.timeoutSec ?? 0}</dd>
    </dl>
    <h3>${t("ioInfo")}</h3>
    <dl class="info-grid">
      <dt>${t("inputs")}</dt><dd>${inputsText}</dd>
      <dt>${t("outputs")}</dt><dd>${outputsText}</dd>
    </dl>
    <h3>${t("promptInfo")}</h3>
    <dl class="info-grid">
      <dt>${t("instruction")}</dt><dd>${json.prompt?.instruction || "-"}</dd>
      <dt>${t("templateRef")}</dt><dd>${json.prompt?.templateRef || "-"}</dd>
      <dt>${t("guardrails")}</dt><dd>${(json.prompt?.guardrails || []).join(", ") || "-"}</dd>
    </dl>
    <h3>${t("confirmationInfo")}</h3>
    <dl class="info-grid">
      <dt>required</dt><dd>${json.confirmation?.required === true ? t("enabled") : t("disabled")}</dd>
      <dt>${t("rejectAction")}</dt><dd>${json.confirmation?.rejectAction || "-"}</dd>
    </dl>
    <h3>${t("concurrencyInfo")}</h3>
    <dl class="info-grid">
      <dt>${t("parallelizable")}</dt><dd>${json.concurrency?.parallelizable === true ? t("enabled") : t("disabled")}</dd>
    </dl>`;
  if (nodeName && state.dirty) wrap.appendChild(helpText(t("effectiveIoHint")));
  return wrap;
}

function select(options, value, onchange) {
  if (Array.isArray(options)) {
    const el = document.createElement("select");
    el.className = "select";
    for (const option of options) {
      const optionValue = typeof option === "object" ? option.value : option;
      const optionLabel = typeof option === "object" ? option.label : option;
      const node = document.createElement("option");
      node.value = optionValue;
      node.textContent = optionLabel || t("selectPlaceholder");
      node.selected = optionValue === value;
      el.appendChild(node);
    }
    el.onchange = () => onchange(el.value);
    return el;
  }
  state.selected = options;
  renderAll();
}

function actionButton(label, tone, onclick) {
  const btn = document.createElement("button");
  btn.className = `btn btn-secondary ${tone || ""}`;
  btn.textContent = label;
  btn.onclick = onclick;
  const wrap = document.createElement("div");
  wrap.className = "field";
  wrap.appendChild(btn);
  return wrap;
}

function preview(value, label = t("json"), help = "") {
  const pre = document.createElement("pre");
  pre.className = "json-preview";
  pre.textContent = JSON.stringify(value, null, 2);
  const wrap = field(label, pre);
  if (help) wrap.appendChild(helpText(help));
  return wrap;
}

function toggleGate(stageName, enabled) {
  const gates = state.config.base.confirmationGates;
  if (enabled && !gates.includes(stageName)) gates.push(stageName);
  if (!enabled) state.config.base.confirmationGates = gates.filter((name) => name !== stageName);
  markDirty();
  renderInspector();
}


function injectAtom(stageIndex, name) {
  const stage = stageAt(stageIndex);
  if (!stage || !name) return;
  if (atomStageLocation(name)) {
    show("warn", t("atomAlreadyUsed"), 2800);
    return;
  }
  stage.atomTasks ||= { entry: [], nodes: {} };
  if (!stage.atomTasks.nodes[name]) {
    stage.atomTasks.nodes[name] = { next: [], parallelApprove: false, parallelWith: [] };
    syncStageEntry(stage);
    markDirty();
    renderWorkflow();
  }
  select({ type: "node", stageIndex, name });
}

function removeNode(stage, name) {
  const stageIndex = state.config.pipeline.indexOf(stage);
  delete stage.atomTasks.nodes[name];
  for (const pipelineStage of state.config.pipeline) {
    for (const def of Object.values(pipelineStage.atomTasks?.nodes || {})) {
      def.next = (def.next || []).filter((item) => item !== name);
      def.parallelWith = (def.parallelWith || []).filter((item) => item !== name);
    }
  }
  syncAllStageEntries();
  markDirty();
  select({ type: "stage", index: stageIndex });
}

function addStage() {
  if (!state.config) return;
  const raw = prompt(t("stageIdPrompt"), "custom-stage");
  const name = safeName(raw);
  if (!name) return;
  const description = prompt(t("stageDescriptionPrompt"), t("customWorkflowStage")) || t("customWorkflowStage");
  const index = state.selected?.type === "stage" ? state.selected.index + 1 : state.config.pipeline.length;
  state.config.pipeline.splice(index, 0, { stage: name, enabled: true, description, atomTasks: { entry: [], nodes: {} } });
  markDirty();
  select({ type: "stage", index });
}

function deleteStage(index) {
  if (!confirm(t("deleteStageConfirm"))) return;
  const [stage] = state.config.pipeline.splice(index, 1);
  state.config.base.confirmationGates = state.config.base.confirmationGates.filter((name) => name !== stage.stage);
  markDirty();
  state.selected = null;
  renderAll();
}

els.open.onclick = openFolder;
if (els.targetDirBtn) els.targetDirBtn.onclick = openTargetDirModal;
els.settingsCancel.onclick = closeSettingsModal;
els.settingsConfirm.onclick = saveSettingsModal;
els.settingsBackdrop.onclick = (event) => {
  if (event.target === els.settingsBackdrop) closeSettingsModal();
};
els.targetDirInput.onkeydown = (event) => {
  if (event.key === "Enter") saveSettingsModal();
  if (event.key === "Escape") closeSettingsModal();
};
els.languageToggle.onclick = () => {
  state.lang = state.lang === "en" ? "zh" : "en";
  localStorage.setItem("ddoStudioLang", state.lang);
  renderAll();
};
els.reload.onclick = reloadAll;
els.save.onclick = saveAll;
els.scan.onclick = scanAtoms;
els.addStage.onclick = addStage;
els.taskSearch.oninput = () => { state.query = els.taskSearch.value; renderTasks(); };
els.canvas.onscroll = () => requestAnimationFrame(redrawEdges);
window.onresize = () => requestAnimationFrame(redrawEdges);
renderAll();
