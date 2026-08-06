"use strict";

const $ = (id) => document.getElementById(id);
const els = {
  banner: $("bannerHost"),
  languageToggle: $("languageToggleBtn"),
  open: $("openFolderBtn"),
  reload: $("reloadBtn"),
  save: $("saveBtn"),
  atomConfigBackdrop: $("atomConfigModalBackdrop"),
  atomConfigTitle: $("atomConfigModalTitle"),
  atomConfigBody: $("atomConfigModalBody"),
  atomConfigCancel: $("atomConfigCancelBtn"),
  atomConfigConfirm: $("atomConfigConfirmBtn"),
  metricsBtn: $("metricsBtn"),
  metricsValue: $("metricsValue"),
  metricsBackdrop: $("metricsModalBackdrop"),
  metricsBody: $("metricsModalBody"),
  metricsCancel: $("metricsCancelBtn"),
  metricsConfirm: $("metricsConfirmBtn"),
  path: $("topbarPath"),
  taskList: $("taskList"),
  taskSearch: $("taskSearch"),
  scan: $("scanBtn"),
  atomsHint: $("atomsHint"),
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
  atomTaskSchema: null,
  atomConfigEditName: null,
  atomConfigDraft: null,
  metricsDraft: null,
  atoms: [],
  selected: null,
  dirty: false,
  query: "",
  lang: localStorage.getItem("ddoStudioLang") || "en",
  // Multi-workflow state
  activeWorkflowId: null,
  activeWorkflow: null,
  loadedWorkflows: new Map(), // id → workflow JSON
};

const i18n = {
  en: {
    subtitle: "Ddo-Code-Flow Workflow Configuration",
    targetDirLabel: "Worktree directory",
    targetDirPickerTitle: "Worktree directory",
    cancel: "Cancel",
    confirm: "Confirm",
    targetDirUpdated: "Updated worktreeDir.",
    targetDirEmpty: "worktreeDir can be empty to use the project parent directory.",
    metricsLabel: "Run metrics",
    metricsModalTitle: "Run metrics & cost estimate",
    metricsUpdated: "Updated metrics settings.",
    metricsEnabled: "Enable run metrics",
    metricsProvider: "Provider",
    metricsFailurePolicy: "Failure policy",
    metricsReportEnabled: "Generate metrics-report.md",
    metricsPricingModel: "Pricing model label (optional)",
    metricsPricingModelHint: "Display-only note; leave empty if not needed. Does not select which model Cursor uses.",
    metricsInputPerM: "Input USD per 1M tokens",
    metricsOutputPerM: "Output USD per 1M tokens",
    metricsCustomCommand: "customCommand (skill:// or path)",
    metricsOff: "Off",
    metricsOn: "On",
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
    workflowLabel: "Workflow:",
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
    atomConfigDetail: "Atom-task detailed configuration",
    configureAction: "Configure",
    atomConfigModalTitle: "Edit atom-task: {name}",
    atomSchemaMissing: "Atom-task schema not loaded.",
    atomJsonMissing: "Atom-task JSON not available.",
    fallbackAtomEdit: "Fallback mode cannot edit atom-task files on disk.",
    addItem: "Add item",
    optional: "optional",
    templateRefPlaceholder: "Optional, e.g. skill://... or run://...",
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
    declaredStage: "artifact roles",
    saveAtomJson: "View atom-task details",
    deleteAtomTask: "Delete atom-task",
    json: "JSON",
    nodeJson: "Workflow node JSON",
    atomJson: "Atom-task JSON",
    stageJson: "Stage JSON",
    jsonHelpNode: "This JSON is the current node fragment under workflow.pipeline[].atomTasks.nodes.",
    jsonHelpAtom: "This data is parsed from the YAML frontmatter of atom-tasks/<name>/<name>.md.",
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
    savedConfig: "Saved config.default.json.",
    exportedConfig: "Exported config.default.json.",
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
    subtitle: "Ddo-Code-Flow 工作流配置",
    targetDirLabel: "worktree 目录",
    targetDirPickerTitle: "worktree 目录",
    cancel: "取消",
    confirm: "确认",
    targetDirUpdated: "已更新 worktreeDir。",
    targetDirEmpty: "worktreeDir 可留空以使用项目父目录。",
    metricsLabel: "运行成本统计",
    metricsModalTitle: "运行 Metrics 与成本估算",
    metricsUpdated: "已更新 Metrics 配置。",
    metricsEnabled: "启用 Run 级 Metrics",
    metricsProvider: "Provider",
    metricsFailurePolicy: "失败策略",
    metricsReportEnabled: "生成 metrics-report.md",
    metricsPricingModel: "定价模型备注（可选）",
    metricsPricingModelHint: "仅用于报告展示，留空即可；不会指定 Cursor 实际使用的模型。",
    metricsInputPerM: "Input 单价（USD / 百万 token）",
    metricsOutputPerM: "Output 单价（USD / 百万 token）",
    metricsCustomCommand: "customCommand（skill:// 或路径）",
    metricsOff: "关",
    metricsOn: "开",
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
    workflowLabel: "工作流:",
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
    atomConfigDetail: "原子任务详细配置修改",
    configureAction: "配置",
    atomConfigModalTitle: "编辑原子任务：{name}",
    atomSchemaMissing: "未加载 atom-task schema。",
    atomJsonMissing: "原子任务 JSON 不可用。",
    fallbackAtomEdit: "兼容模式无法修改磁盘上的 atom-task 文件。",
    addItem: "添加项",
    optional: "可选",
    templateRefPlaceholder: "可选，例如 skill://... 或 run://...",
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
    declaredStage: "产物角色",
    saveAtomJson: "查看 atom-task 详情",
    deleteAtomTask: "删除 atom-task",
    json: "JSON",
    nodeJson: "工作流节点 JSON",
    atomJson: "Atom-task JSON",
    stageJson: "阶段 JSON",
    jsonHelpNode: "这里展示的是 workflow.pipeline[].atomTasks.nodes 下的当前节点片段。",
    jsonHelpAtom: "这里展示的是从 atom-tasks/<name>/<name>.md 的 YAML frontmatter 解析出的 atom-task 数据。",
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
    savedConfig: "已保存 config.default.json。",
    exportedConfig: "已导出 config.default.json。",
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

  updateMetricsBtn();
}

function formatMetricsSummary(metrics) {
  if (!metrics?.enabled) return t("metricsOff");
  const parts = [t("metricsOn"), metrics.provider || "—"];
  const inRate = Number(metrics.pricing?.inputPerMillionUsd) || 0;
  const outRate = Number(metrics.pricing?.outputPerMillionUsd) || 0;
  if (inRate > 0 || outRate > 0) parts.push(`$${inRate}/$${outRate} per M`);
  return parts.join(" · ");
}

function updateMetricsBtn() {
  if (!els.metricsBtn || !els.metricsValue) return;
  const metrics = state.config?.base?.metrics;
  els.metricsBtn.disabled = !state.config;
  els.metricsValue.textContent = metrics ? formatMetricsSummary(metrics) : "—";
  els.metricsBtn.title = t("metricsLabel");
}

function ensureMetricsDraft() {
  const base = state.config?.base;
  if (!base) return null;
  normalizeConfig(state.config);
  if (!state.metricsDraft) {
    state.metricsDraft = JSON.parse(JSON.stringify(base.metrics));
  }
  return state.metricsDraft;
}

function openMetricsModal() {
  if (!state.config?.base) {
    show("warn", t("openFirst"));
    return;
  }
  state.metricsDraft = JSON.parse(JSON.stringify(state.config.base.metrics));
  renderMetricsModalBody();
  els.metricsBackdrop.hidden = false;
}

function closeMetricsModal() {
  els.metricsBackdrop.hidden = true;
  state.metricsDraft = null;
}

function saveMetricsModal() {
  if (!state.config?.base || !state.metricsDraft) return;
  const draft = state.metricsDraft;
  if (draft.provider === "custom-command" && !String(draft.customCommand || "").trim()) {
    show("warn", t("metricsCustomCommand") + " required");
    return;
  }
  draft.pricing ||= { model: "", inputPerMillionUsd: 0, outputPerMillionUsd: 0 };
  draft.pricing.model = String(draft.pricing.model ?? "").trim();
  draft.pricing.inputPerMillionUsd = Number(draft.pricing.inputPerMillionUsd) || 0;
  draft.pricing.outputPerMillionUsd = Number(draft.pricing.outputPerMillionUsd) || 0;
  if (draft.provider !== "custom-command") delete draft.customCommand;
  state.config.base.metrics = JSON.parse(JSON.stringify(draft));
  markDirty();
  updateMetricsBtn();
  renderInspector();
  closeMetricsModal();
  show("info", t("metricsUpdated"));
}

function renderMetricsModalBody() {
  const draft = ensureMetricsDraft();
  if (!draft || !els.metricsBody) return;
  draft.report ||= { enabled: true, path: "metrics-report.md" };
  draft.pricing ||= { model: "", inputPerMillionUsd: 0, outputPerMillionUsd: 0 };
  els.metricsBody.replaceChildren();
  const providers = ["tokscale", "custom-command", "cursor-session-counter", "cursor-sdk"];
  const policies = ["warn", "fail"];

  els.metricsBody.append(
    toggleRow(t("metricsEnabled"), draft.enabled === true, (value) => {
      draft.enabled = value;
      renderMetricsModalBody();
    }),
    field(t("metricsProvider"), select(providers, draft.provider || "tokscale", (value) => {
      draft.provider = value;
      renderMetricsModalBody();
    })),
    field(t("metricsFailurePolicy"), select(policies, draft.failurePolicy || "warn", (value) => {
      draft.failurePolicy = value;
    })),
    toggleRow(t("metricsReportEnabled"), draft.report.enabled !== false, (value) => {
      draft.report.enabled = value;
    }),
    field(t("metricsPricingModel"), input(draft.pricing.model || "", (value) => {
      draft.pricing.model = value;
    })),
    hint(t("metricsPricingModelHint")),
    field(t("metricsInputPerM"), input(draft.pricing.inputPerMillionUsd, (value) => {
      draft.pricing.inputPerMillionUsd = value;
    }, "number")),
    field(t("metricsOutputPerM"), input(draft.pricing.outputPerMillionUsd, (value) => {
      draft.pricing.outputPerMillionUsd = value;
    }, "number")),
  );

  if (draft.provider === "custom-command") {
    els.metricsBody.append(
      field(t("metricsCustomCommand"), input(draft.customCommand || "", (value) => {
        draft.customCommand = value;
      })),
    );
  }
}

function hint(text) {
  const el = document.createElement("p");
  el.className = "field-hint";
  el.textContent = text;
  return el;
}

function show(kind, message, autoMs = 2600) {
  const node = document.createElement("div");
  node.className = `banner banner--${kind}`;
  node.textContent = message;
  els.banner.appendChild(node);
  if (autoMs) setTimeout(() => node.remove(), autoMs);
}

function resolveAtomSchema(schema, root) {
  if (!schema) return null;
  if (schema.$ref) {
    if (!schema.$ref.startsWith("#/")) return null;
    const target = schema.$ref.slice(2).split("/").reduce((node, key) => node?.[key], root);
    return resolveAtomSchema(target, root);
  }
  return schema;
}

const schemaFieldLabels = {
  name: "name",
  version: "version",
  stage: "declaredStage",
  description: "description",
  enabled: "enabled",
  timeoutSec: "timeoutSec",
  instruction: "instruction",
  templateRef: "templateRef",
  guardrails: "guardrails",
  rejectAction: "rejectAction",
  parallelizable: "parallelizable",
  inputs: "inputs",
  outputs: "outputs",
  ref: "ref",
  required: "required",
  kind: "kind",
  io: "ioInfo",
  prompt: "promptInfo",
  confirmation: "confirmationInfo",
  concurrency: "concurrencyInfo",
};

function schemaFieldLabel(key) {
  const i18nKey = schemaFieldLabels[key];
  return i18nKey ? t(i18nKey) : key;
}

function isSchemaFieldRequired(parentSchema, key) {
  return (parentSchema?.required || []).includes(key);
}

function isEmptyOptionalValue(value, propSchema, parentSchema, key, root) {
  if (isSchemaFieldRequired(parentSchema, key)) return false;
  const resolved = resolveAtomSchema(propSchema, root);
  if (value === undefined || value === null) return true;
  if (resolved?.type === "string" && String(value).trim() === "") return true;
  if (resolved?.type === "array" && value.length === 0) return true;
  return false;
}

function pruneBySchema(value, schema, root, parentSchema = null, key = "") {
  const resolved = resolveAtomSchema(schema, root);
  if (!resolved) return value;
  if (resolved.type === "object" && value && typeof value === "object" && !Array.isArray(value)) {
    const out = {};
    for (const [childKey, childSchema] of Object.entries(resolved.properties || {})) {
      if (!(childKey in value)) continue;
      const pruned = pruneBySchema(value[childKey], childSchema, root, resolved, childKey);
      if (isEmptyOptionalValue(pruned, childSchema, resolved, childKey, root)) continue;
      out[childKey] = pruned;
    }
    return out;
  }
  if (resolved.type === "array" && Array.isArray(value)) {
    const itemSchema = resolved.items;
    return value
      .map((item) => pruneBySchema(item, itemSchema, root))
      .filter((item) => item !== undefined && item !== null && item !== "");
  }
  if (typeof value === "string") return value.trim();
  return value;
}

function pruneAtomDraft(draft) {
  return pruneBySchema(clone(draft), state.atomTaskSchema, state.atomTaskSchema);
}

function defaultForSchema(schema, root) {
  const resolved = resolveAtomSchema(schema, root);
  if (!resolved) return null;
  if (resolved.enum) return resolved.enum[0];
  if (resolved.type === "boolean") return false;
  if (resolved.type === "integer" || resolved.type === "number") return resolved.minimum ?? 0;
  if (resolved.type === "string") return "";
  if (resolved.type === "array") return [];
  if (resolved.type === "object") {
    const obj = {};
    for (const key of resolved.required || []) {
      const prop = resolved.properties?.[key];
      if (prop) obj[key] = defaultForSchema(prop, root);
    }
    return obj;
  }
  return null;
}

function setPrimitiveValue(container, key, next, isRequired) {
  if (!isRequired && (next === "" || next === undefined || next === null || (typeof next === "string" && !next.trim()))) {
    delete container[key];
    return;
  }
  container[key] = typeof next === "string" ? next : next;
}

function isLongTextField(key, schema) {
  return key === "instruction" || key === "description" || (schema.minLength && schema.minLength > 20);
}

function schemaBoolControl(value, onchange) {
  let checked = !!value;
  const wrap = document.createElement("div");
  wrap.className = "schema-bool";
  const btn = document.createElement("button");
  btn.type = "button";
  const paint = () => {
    btn.className = `btn ${checked ? "btn-primary" : "btn-secondary"}`;
    btn.textContent = checked ? t("enabled") : t("disabled");
  };
  paint();
  btn.onclick = () => {
    checked = !checked;
    onchange(checked);
    paint();
  };
  wrap.appendChild(btn);
  return wrap;
}

function schemaEnumControl(schema, value, onchange) {
  const el = document.createElement("select");
  el.className = "select";
  for (const option of schema.enum || []) {
    const node = document.createElement("option");
    node.value = option;
    node.textContent = option;
    node.selected = option === value;
    el.appendChild(node);
  }
  el.onchange = () => onchange(el.value);
  return el;
}

function schemaPrimitiveControl(key, schema, value, onchange, { readOnly = false } = {}) {
  const resolved = schema;
  if (resolved.enum) return schemaEnumControl(resolved, value, onchange);
  if (resolved.type === "boolean") return schemaBoolControl(!!value, onchange);
  if (resolved.type === "integer" || resolved.type === "number") {
    const el = input(value ?? 0, (next) => onchange(resolved.type === "integer" ? Math.trunc(next) : next), "number");
    if (readOnly) el.readOnly = true;
    return el;
  }
  if (isLongTextField(key, resolved)) {
    const el = textarea(value ?? "", onchange);
    if (readOnly) el.readOnly = true;
    return el;
  }
  const el = input(value ?? "", onchange);
  if (key === "templateRef") el.placeholder = t("templateRefPlaceholder");
  if (readOnly) el.readOnly = true;
  return el;
}

function schemaField(label, control, { optional = false, wide = false } = {}) {
  const wrap = document.createElement("div");
  wrap.className = `schema-field${wide ? " schema-field--wide" : ""}`;
  const lab = document.createElement("label");
  lab.textContent = label;
  if (optional) {
    const badge = document.createElement("span");
    badge.className = "schema-field__optional";
    badge.textContent = t("optional");
    lab.appendChild(badge);
  }
  wrap.append(lab, control);
  return wrap;
}

function renderSchemaArrayField(key, schema, container, path, root, parentSchema) {
  const resolved = resolveAtomSchema(schema, root);
  if (!Array.isArray(container[key])) container[key] = [];
  const items = container[key];

  const wrap = document.createElement("div");
  wrap.className = "schema-array";
  const list = document.createElement("div");
  list.className = "schema-array__list";

  function paint() {
    list.innerHTML = "";
    items.forEach((item, index) => {
      const itemWrap = document.createElement("div");
      itemWrap.className = "schema-array__item";
      const itemSchema = resolveAtomSchema(resolved.items, root);

      if (itemSchema?.type === "object" && itemSchema.properties) {
        const fields = document.createElement("div");
        fields.className = "schema-array__fields";
        for (const [subKey, subSchema] of Object.entries(itemSchema.properties)) {
          const required = isSchemaFieldRequired(itemSchema, subKey);
          if (!(subKey in item) && required) item[subKey] = defaultForSchema(subSchema, root);
          const subResolved = resolveAtomSchema(subSchema, root);
          const current = item[subKey];
          const control = schemaPrimitiveControl(
            subKey,
            subResolved,
            current,
            (next) => setPrimitiveValue(item, subKey, next, required),
            {},
          );
          fields.appendChild(schemaField(schemaFieldLabel(subKey), control, { optional: !required }));
        }
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn btn-secondary danger schema-array__remove";
        removeBtn.textContent = "×";
        removeBtn.title = t("removeAction");
        removeBtn.onclick = () => {
          items.splice(index, 1);
          paint();
        };
        itemWrap.append(fields, removeBtn);
      } else if (itemSchema?.type === "string") {
        const row = document.createElement("div");
        row.className = "schema-array__row";
        const control = isLongTextField(key, itemSchema)
          ? textarea(item ?? "", (next) => { items[index] = next; })
          : input(item ?? "", (next) => { items[index] = next; });
        row.appendChild(control);
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn btn-secondary danger schema-array__remove";
        removeBtn.textContent = "×";
        removeBtn.onclick = () => {
          items.splice(index, 1);
          paint();
        };
        row.appendChild(removeBtn);
        itemWrap.appendChild(row);
      }
      list.appendChild(itemWrap);
    });
  }

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn btn-secondary schema-array__add";
  addBtn.textContent = `+ ${t("addItem")}`;
  addBtn.onclick = () => {
    items.push(defaultForSchema(resolved.items, root));
    paint();
  };

  paint();
  wrap.append(list, addBtn);
  return schemaField(schemaFieldLabel(key), wrap, { wide: true });
}

function renderSchemaField(key, propSchema, container, path, root, opts = {}) {
  const { readOnly = false, parentSchema = null, asCard = false, inGrid = false } = opts;
  const resolved = resolveAtomSchema(propSchema, root);
  if (!resolved) return document.createElement("div");
  const isRequired = parentSchema ? isSchemaFieldRequired(parentSchema, key) : true;

  if (resolved.type === "object" && resolved.properties) {
    if (!(key in container) || typeof container[key] !== "object" || Array.isArray(container[key])) {
      container[key] = defaultForSchema(resolved, root);
    }
    const obj = container[key];
    const section = document.createElement("section");
    section.className = asCard ? "schema-card" : "schema-section";
    const title = document.createElement("h4");
    title.className = "schema-card__title";
    title.textContent = schemaFieldLabel(key);
    section.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "schema-grid";
    const stack = document.createElement("div");
    stack.className = "schema-stack";

    for (const [subKey, subSchema] of Object.entries(resolved.properties)) {
      const subResolved = resolveAtomSchema(subSchema, root);
      const child = renderSchemaField(subKey, subSchema, obj, `${path}.${subKey}`, root, {
        readOnly: readOnly && subKey === "name",
        parentSchema: resolved,
        inGrid: subResolved.type !== "array" && !isLongTextField(subKey, subResolved),
      });
      if (subResolved.type === "array" || isLongTextField(subKey, subResolved)) stack.appendChild(child);
      else grid.appendChild(child);
    }
    if (grid.childElementCount) section.appendChild(grid);
    if (stack.childElementCount) section.appendChild(stack);
    return section;
  }

  if (resolved.type === "array") {
    return renderSchemaArrayField(key, propSchema, container, path, root, parentSchema);
  }

  const currentValue = key in container ? container[key] : (isRequired ? defaultForSchema(resolved, root) : undefined);
  if (isRequired && !(key in container)) container[key] = currentValue;
  const control = schemaPrimitiveControl(
    key,
    resolved,
    currentValue ?? "",
    (next) => setPrimitiveValue(container, key, next, isRequired),
    { readOnly },
  );
  return schemaField(schemaFieldLabel(key), control, { optional: !isRequired, wide: !inGrid || isLongTextField(key, resolved) });
}

function buildAtomConfigForm(draft) {
  const root = state.atomTaskSchema;
  const container = document.createElement("div");
  container.className = "schema-form";
  const top = resolveAtomSchema(root, root);
  const basicsKeys = ["name", "version", "stage", "enabled", "timeoutSec"];
  const objectKeys = ["io", "prompt", "confirmation", "concurrency"];

  const basics = document.createElement("section");
  basics.className = "schema-card schema-card--basics";
  const basicsTitle = document.createElement("h4");
  basicsTitle.className = "schema-card__title";
  basicsTitle.textContent = t("basicInfo");
  basics.appendChild(basicsTitle);

  const basicsGrid = document.createElement("div");
  basicsGrid.className = "schema-grid schema-grid--2";
  for (const key of basicsKeys) {
    const propSchema = top?.properties?.[key];
    if (propSchema) {
      basicsGrid.appendChild(renderSchemaField(key, propSchema, draft, key, root, {
        readOnly: key === "name",
        parentSchema: top,
        inGrid: true,
      }));
    }
  }
  basics.appendChild(basicsGrid);

  const descSchema = top?.properties?.description;
  if (descSchema) {
    basics.appendChild(renderSchemaField("description", descSchema, draft, "description", root, {
      parentSchema: top,
      wide: true,
    }));
  }
  container.appendChild(basics);

  for (const key of objectKeys) {
    const propSchema = top?.properties?.[key];
    if (propSchema) {
      container.appendChild(renderSchemaField(key, propSchema, draft, key, root, {
        parentSchema: top,
        asCard: true,
      }));
    }
  }
  return container;
}

function openAtomConfigModal(name) {
  const item = atomByName(name);
  if (!item?.json) {
    show("warn", t("atomJsonMissing"));
    return;
  }
  state.atomConfigEditName = name;
  els.atomConfigTitle.textContent = t("atomConfigModalTitle").replace("{name}", name);
  els.atomConfigBody.innerHTML = "";

  // 只读信息展示
  const json = item.json;
  const panel = document.createElement("div");
  panel.className = "info-panel";
  const inputsText = (json.consumes || []).map(i => `${i.role}${i.required === false ? "?" : ""}`).join(", ") || "-";
  const outputsText = (json.produces || []).map(o => `${o.role} (${o.kind})`).join(", ") || "-";
  panel.innerHTML = `
    <h3>${t("basicInfo")}</h3>
    <dl class="info-grid">
      <dt>name</dt><dd>${json.name || ""}</dd>
      <dt>version</dt><dd>${json.version || ""}</dd>
      <dt>${t("declaredStage")}</dt><dd>${outputsText}</dd>
      <dt>${t("description")}</dt><dd>${json.description || ""}</dd>
      <dt>${t("enabled")}</dt><dd>${json.enabled === false ? t("disabled") : t("enabled")}</dd>
      <dt>${t("timeoutSec")}</dt><dd>${json.timeoutSec ?? 0}</dd>
    </dl>
    <h3>${t("ioInfo")}</h3>
    <dl class="info-grid">
      <dt>${t("inputs")}</dt><dd class="info-list">${inputsText}</dd>
      <dt>${t("outputs")}</dt><dd class="info-list">${outputsText}</dd>
    </dl>
    <h3>${t("confirmationInfo")}</h3>
    <dl class="info-grid">
      <dt>${t("rejectAction")}</dt><dd>${json.confirmation?.rejectAction || "-"}</dd>
    </dl>
    <h3>${t("concurrencyInfo")}</h3>
    <dl class="info-grid">
      <dt>${t("parallelizable")}</dt><dd>${json.concurrency?.parallelizable === true ? t("enabled") : t("disabled")}</dd>
    </dl>`;
  els.atomConfigBody.appendChild(panel);

  // context 节点：额外显示 contextPaths 配置
  if (name === "context" && state.config?.base) {
    const base = state.config.base;
    const ctxCard = document.createElement("div");
    ctxCard.className = "info-panel";
    ctxCard.innerHTML = `<h3>额外上下文路径</h3>`;
    ctxCard.appendChild(field("contextPaths", textarea(
      (base.contextPaths || []).join("\n"),
      (value) => { base.contextPaths = value.split("\n").map(v => v.trim()).filter(Boolean); markDirty(); }
    )));
    ctxCard.appendChild(helpText("每行一个路径（相对于 projectRoot），context 阶段会额外读取这些文件。"));
    els.atomConfigBody.appendChild(ctxCard);
  }

  els.atomConfigBody.appendChild(helpText(item.source === "md" ? "数据来源：.md 文件 YAML frontmatter（只读）" : "数据来源：.json 文件（只读）"));
  els.atomConfigBackdrop.hidden = false;
}

function closeAtomConfigModal() {
  els.atomConfigBackdrop.hidden = true;
  state.atomConfigEditName = null;
  state.atomConfigDraft = null;
}

async function saveAtomConfigModal() {
  // 现在仅关闭模态框（MD 格式不支持直接编辑保存）
  closeAtomConfigModal();
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
  return getActivePipeline()[index] || null;
}

function usedAtomNames() {
  const set = new Set();
  for (const stage of getActivePipeline()) {
    Object.keys(stage.atomTasks?.nodes || {}).forEach((name) => set.add(name));
  }
  return set;
}

function atomStageLocation(name) {
  for (const [stageIndex, stage] of getActivePipeline().entries()) {
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
  for (const [stageIndex, stage] of getActivePipeline().entries()) {
    for (const nodeName of Object.keys(stage.atomTasks?.nodes || {})) {
      if (nodeName === excludeName) continue;
      refs.push({ value: nodeName, label: `${stage.stage} / ${nodeName}`, name: nodeName, stageIndex });
    }
  }
  return refs;
}

function getPredecessors(name) {
  const out = [];
  for (const [stageIndex, stage] of getActivePipeline().entries()) {
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

function syncAllStageEntries(config) {
  const pipeline = config?.pipeline || getActivePipeline();
  for (const stage of pipeline) syncStageEntry(stage);
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
  for (const stage of getActivePipeline()) {
    Object.keys(stage.atomTasks?.nodes || {}).forEach((name) => names.add(name));
  }
  Object.keys(state.config?.atomTaskOverrides || {}).forEach((name) => names.add(name));
  if (state.activeWorkflow?.atomTaskOverrides) {
    Object.keys(state.activeWorkflow.atomTaskOverrides).forEach((name) => names.add(name));
  }
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
  config.base.worktreeDir ??= "";
  config.base.defaultRunType ||= "feat";
  config.base.contextPaths ||= [];
  config.base.respGenerator ||= { maxLength: 32, case: "kebab", stripStopwords: true };
  config.base.metrics ||= {
    enabled: false,
    provider: "tokscale",
    failurePolicy: "warn",
    report: { enabled: true, path: "metrics-report.md" },
    pricing: { model: "", inputPerMillionUsd: 0, outputPerMillionUsd: 0 },
  };
  // v4 multi-workflow: initialize defaults without injecting a top-level pipeline.
  if (!config.workflows) {
    config.workflows = {
      default: "standard",
      selection: {
        allowUserOverride: true,
        argumentNames: ["model"],
        rules: [
          { workflow: "lightweight", matchAny: ["docs", "文档", "调研", "小修"] },
          { workflow: "guarded", matchAny: ["安全", "数据迁移", "公开接口", "性能", "并发"] },
          { workflow: "standard", fallback: true },
        ],
      },
      items: [
        { id: "lightweight", name: "Lightweight", path: "workflows/lightweight.json" },
        { id: "standard", name: "Standard", path: "workflows/standard.json" },
        { id: "guarded", name: "Guarded", path: "workflows/guarded.json" },
      ],
    };
  }
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

/* ============================================================
 * YAML frontmatter parser — lightweight subset for atom-task .md files
 * Handles: strings, numbers, booleans, nested objects, arrays of
 * strings/objects. No anchors, aliases, or multi-line block scalars.
 * ============================================================ */
function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { meta: null, body: text };
  const yaml = match[1];
  const body = text.slice(match[0].length).trim();
  const meta = parseYamlSimple(yaml);
  return { meta, body };
}

function parseYamlSimple(yaml) {
  const lines = yaml.split("\n");
  const root = {};
  const stack = [{ indent: -1, obj: root, key: null }];

  function peekNextContentLine(fromIdx, minIndent) {
    for (let j = fromIdx + 1; j < lines.length; j++) {
      const l = lines[j];
      if (!l.trim() || l.trim().startsWith("#")) continue;
      if (l.search(/\S/) > minIndent) return l.trim();
      return null; // same or lesser indent → not a child
    }
    return null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const indent = line.search(/\S/);
    const trimmed = line.trim();

    // Pop stack to find parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].obj;

    // Array item: "- key: value" or "- value"
    if (trimmed.startsWith("- ")) {
      const content = trimmed.slice(2);
      if (!Array.isArray(parent)) continue;

      if (content.includes(": ")) {
        const obj = {};
        const [k, ...vParts] = content.split(": ");
        obj[k.trim()] = parseYamlValue(vParts.join(": ").trim());
        while (i + 1 < lines.length) {
          const next = lines[i + 1];
          if (!next.trim() || next.search(/\S/) <= indent) break;
          const nextTrimmed = next.trim();
          if (nextTrimmed.startsWith("- ")) break;
          const [nk, ...nvParts] = nextTrimmed.split(": ");
          if (nvParts.length > 0) obj[nk.trim()] = parseYamlValue(nvParts.join(": ").trim());
          i++;
        }
        parent.push(obj);
      } else {
        parent.push(parseYamlValue(content));
      }
      continue;
    }

    // Key-value: "key: value" or "key:"
    const colonIdx = trimmed.indexOf(": ");
    const isKeyOnly = trimmed.endsWith(":") && colonIdx === -1;

    if (colonIdx >= 0 || isKeyOnly) {
      const keyTrimmed = isKeyOnly ? trimmed.slice(0, -1).trim() : trimmed.slice(0, colonIdx).trim();
      const value = isKeyOnly ? "" : trimmed.slice(colonIdx + 2).trim();

      if (value === "[]") {
        // Inline empty array
        parent[keyTrimmed] = [];
      } else if (value === "{}") {
        // Inline empty object
        parent[keyTrimmed] = {};
      } else if (value === "") {
        // Look ahead: is the immediate child an array (" - ") or an object ("key:")?
        const nextChild = peekNextContentLine(i, indent);
        const shouldBeArray = nextChild && nextChild.startsWith("- ");
        if (shouldBeArray) {
          const arr = [];
          parent[keyTrimmed] = arr;
          stack.push({ indent, obj: arr, key: keyTrimmed });
        } else {
          const childObj = {};
          parent[keyTrimmed] = childObj;
          stack.push({ indent, obj: childObj, key: keyTrimmed });
        }
      } else if (value === "|") {
        let block = "";
        while (i + 1 < lines.length) {
          const next = lines[i + 1];
          if (next.search(/\S/) <= indent && next.trim()) break;
          block += (block ? "\n" : "") + next.slice(indent + 2);
          i++;
        }
        parent[keyTrimmed] = block;
      } else {
        parent[keyTrimmed] = parseYamlValue(value);
      }
    }
  }

  return root;
}

function parseYamlValue(str) {
  if (str === "true") return true;
  if (str === "false") return false;
  if (str === "null" || str === "~") return null;
  if (/^-?\d+$/.test(str)) return parseInt(str, 10);
  if (/^-?\d+\.\d+$/.test(str)) return parseFloat(str);
  // Remove surrounding quotes
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  return str;
}

const FS = (() => {
  const supports = typeof window.showDirectoryPicker === "function";
  async function readJSON(relPath) {
    const parts = relPath.split("/").filter(Boolean);
    let handle = state.dirHandle;
    for (let i = 0; i < parts.length - 1; i++) handle = await handle.getDirectoryHandle(parts[i]);
    const file = await (await handle.getFileHandle(parts.at(-1))).getFile();
    return JSON.parse(await file.text());
  }
  async function readText(relPath) {
    const parts = relPath.split("/").filter(Boolean);
    let handle = state.dirHandle;
    for (let i = 0; i < parts.length - 1; i++) handle = await handle.getDirectoryHandle(parts[i]);
    const file = await (await handle.getFileHandle(parts.at(-1))).getFile();
    return await file.text();
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
        // 优先读取 .md 文件（YAML frontmatter）
        const file = await (await entry.getFileHandle(`${name}.md`)).getFile();
        const text = await file.text();
        const { meta } = parseFrontmatter(text);
        if (meta) {
          // 将 frontmatter 映射为旧的 json 结构以保持兼容
          const json = {
            name: meta.name || name,
            version: meta.version || "1.0.0",
            stage: meta.stage || "",
            description: text.match(/^> (.+)$/m)?.[1] || "",
            enabled: meta.enabled !== false,
            io: meta.io || { inputs: [], outputs: [] },
            prompt: {
              instruction: "",
              options: meta.options || [],
            },
            confirmation: meta.confirmation || { required: false, rejectAction: "regenerate-with-feedback" },
            concurrency: meta.concurrency || { parallelizable: false },
            timeoutSec: meta.timeoutSec || 0,
          };
          out.push({ name, json, broken: false, source: "md" });
        } else {
          out.push({ name, json: null, broken: true, reason: "no frontmatter" });
        }
      } catch (error) {
        // fallback: 尝试读取旧的 .json 文件
        try {
          const file = await (await entry.getFileHandle(`${name}.json`)).getFile();
          out.push({ name, json: JSON.parse(await file.text()), broken: false, source: "json" });
        } catch (_) {
          out.push({ name, json: null, broken: true, reason: error.message });
        }
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }
  return { supports, readJSON, readText, writeJSON, listAtoms };
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
    state.config = await FS.readJSON("config.default.json");
    try { state.configSchema = await FS.readJSON("config.schema.json"); } catch (_) { state.configSchema = null; }
    try { state.atomTaskSchema = await FS.readJSON("atom-tasks/_schema/atom-task-md.schema.json"); } catch (_) { state.atomTaskSchema = null; }
    normalizeConfig(state.config);

    // Load workflow definitions
    state.loadedWorkflows.clear();
    if (state.config.workflows?.items) {
      for (const item of state.config.workflows.items) {
        try {
          const wf = await FS.readJSON(item.path);
          state.loadedWorkflows.set(item.id, wf);
        } catch (_) { /* skip missing workflow files */ }
      }
    }
    // Set active workflow
    const defaultId = state.config.workflows?.default || state.config.workflows?.items?.[0]?.id;
    state.activeWorkflowId = defaultId;
    state.activeWorkflow = defaultId ? state.loadedWorkflows.get(defaultId) : null;

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
  const pipeline = getActivePipeline();
  const dagErrors = DAG.checkConfig({ pipeline });
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
    // Save config.default.json (global defaults + workflow index)
    await FS.writeJSON("config.default.json", state.config);
    // Save active workflow JSON (pipeline, confirmationGates, atomTaskOverrides)
    if (state.activeWorkflowId && state.activeWorkflow) {
      const item = state.config.workflows?.items?.find((i) => i.id === state.activeWorkflowId);
      if (item?.path) {
        await FS.writeJSON(item.path, state.activeWorkflow);
      }
    }
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
  a.download = "config.default.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function scanAtoms() {
  if (!state.config) return show("warn", t("openFirst"));
  if (state.mode === "fallback") return show("warn", t("fallbackScan"));
  try {
    state.atoms = await FS.listAtoms();
    els.atomsHint.textContent = `${state.atoms.length} ${t("atomCount")}`;
    renderAll();
  } catch (error) {
    show("error", `${t("scanFailed")}：${error.message}`, 0);
  }
}

function renderAll() {
  applyI18n();
  renderTasks();
  renderWorkflowSwitcher();
  renderWorkflow();
  renderInspector();
}

/** Returns the pipeline array from the active workflow. */
function getActivePipeline() {
  if (state.activeWorkflow?.pipeline) return state.activeWorkflow.pipeline;
  return [];
}

/** Returns the confirmationGates from the active workflow. */
function getActiveConfirmationGates() {
  if (state.activeWorkflow?.confirmationGates) return state.activeWorkflow.confirmationGates;
  return [];
}

/** Returns the effective atomTaskOverrides (workflow-level overrides global). */
function getEffectiveOverrides(name) {
  const global = state.config?.atomTaskOverrides?.[name] || {};
  const wf = state.activeWorkflow?.atomTaskOverrides?.[name] || {};
  return { ...global, ...wf };
}

/** Populate and render the workflow switcher dropdown. */
function renderWorkflowSwitcher() {
  const select = $("workflowSelect");
  if (!select || !state.config?.workflows) return;

  const items = state.config.workflows.items || [];
  select.innerHTML = "";
  for (const item of items) {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.name || item.id;
    select.appendChild(opt);
  }
  // Set active workflow
  const targetId = state.activeWorkflowId || state.config.workflows.default || items[0]?.id;
  if (targetId && items.some((i) => i.id === targetId)) {
    select.value = targetId;
    state.activeWorkflowId = targetId;
  }

  // Event listener (only attach once)
  if (!select._bound) {
    select.addEventListener("change", () => switchWorkflow(select.value));
    select._bound = true;
  }
}

/** Switch to a different workflow. */
async function switchWorkflow(id) {
  if (!state.config?.workflows) return;
  const item = state.config.workflows.items.find((i) => i.id === id);
  if (!item) return;

  // Load workflow JSON if not cached
  if (!state.loadedWorkflows.has(id)) {
    try {
      const wf = await FS.readJSON(item.path);
      state.loadedWorkflows.set(id, wf);
    } catch (e) {
      show("error", `Failed to load workflow "${id}": ${e.message}`, 0);
      return;
    }
  }
  state.activeWorkflowId = id;
  state.activeWorkflow = state.loadedWorkflows.get(id);
  state.selected = null;
  markDirty();
  renderWorkflow();
  renderInspector();
  show("info", `Switched to workflow: ${id}`);
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
  const pipeline = getActivePipeline();
  pipeline.forEach((stage, index) => els.track.appendChild(stageCard(stage, index)));
  requestAnimationFrame(redrawEdges);
  const errors = DAG.checkConfig({ pipeline });
  els.pipelineHint.textContent = errors.length ? `${t("dagError")}: ${errors[0]}` : `${pipeline.length} ${t("stageCount")}, ${allAtomNames().length} ${t("atomCount")}.`;
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
  const mk = (a, b, sameStage) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    if (sameStage) {
      // Same stage: bottom-center of source → top-center of target
      const ax = ar.left + ar.width / 2 - canvasRect.left + els.canvas.scrollLeft;
      const ay = ar.bottom - canvasRect.top + els.canvas.scrollTop;
      const bx = br.left + br.width / 2 - canvasRect.left + els.canvas.scrollLeft;
      const by = br.top - canvasRect.top + els.canvas.scrollTop;
      const midY = (ay + by) / 2;
      path.setAttribute("d", `M ${ax} ${ay} C ${ax} ${midY}, ${bx} ${midY}, ${bx} ${by}`);
    } else {
      // Cross-stage: right-center of source → left-center of target
      const ax = ar.right - canvasRect.left + els.canvas.scrollLeft;
      const ay = ar.top + ar.height / 2 - canvasRect.top + els.canvas.scrollTop;
      const bx = br.left - canvasRect.left + els.canvas.scrollLeft;
      const by = br.top + br.height / 2 - canvasRect.top + els.canvas.scrollTop;
      const mid = (ax + bx) / 2;
      path.setAttribute("d", `M ${ax} ${ay} C ${mid} ${ay}, ${mid} ${by}, ${bx} ${by}`);
    }
    path.setAttribute("marker-end", "url(#arrow)");
    els.edges.appendChild(path);
  };
  els.edges.querySelectorAll("path").forEach((path) => {
    if (!path.closest("marker")) path.remove();
  });
  getActivePipeline().forEach((stage, stageIndex) => {
    for (const [from, def] of Object.entries(stage.atomTasks?.nodes || {})) {
      for (const to of def.next || []) {
        const a = nodeEl(stageIndex, from);
        const b = nodeElByName(to);
        if (a && b) {
          const targetLoc = atomStageLocation(to);
          const sameStage = targetLoc && targetLoc.stageIndex === stageIndex;
          mk(a, b, sameStage);
        }
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

function switchActionRow(label, actionLabel, onclick, { danger = false, primary = false, yellow = false } = {}) {
  const row = document.createElement("div");
  row.className = "switch-row";
  const text = document.createElement("span");
  text.textContent = label;
  const btn = document.createElement("button");
  const tone = danger ? " btn-secondary danger" : yellow ? " btn-yellow" : primary ? " btn-primary" : " btn-secondary";
  btn.className = `btn${tone}`;
  btn.textContent = actionLabel;
  btn.onclick = onclick;
  row.append(text, btn);
  return row;
}

function renderBaseInspector() {
  const base = state.config.base;
  els.inspectorTitle.textContent = t("baseConfiguration");
  els.inspectorBody.append(
    field("worktreeDir", input(base.worktreeDir || "", (value) => { base.worktreeDir = value; markDirty(); })),
    field("contextPaths", textarea((base.contextPaths || []).join("\n"), (value) => { base.contextPaths = value.split("\n").map((v) => v.trim()).filter(Boolean); markDirty(); })),
    toggleRow("contextOptional", base.contextOptional !== false, (value) => { base.contextOptional = value; markDirty(); renderInspector(); }),
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
    field(t("injectAtomTask"), select(["", ...availableAtomsForInject()], "", (atomName) => { if (atomName) injectAtom(index, atomName); })),
    actionButton(t("deleteStage"), "danger", () => deleteStage(index)),
    preview(stage, t("stageJson")),
  );
}

function renderNodeInspector(stage, stageIndex, name) {
  const node = stage?.atomTasks?.nodes?.[name];
  if (!node) return;
  els.inspectorTitle.textContent = `${t("nodeLabel")} / ${name}`;
  els.inspectorBody.append(
    toggleRow(t("atomTaskEnabled"), effectiveEnabled(name), (value) => { setEnabled(name, value); renderAll(); }),
    switchActionRow(t("atomConfigDetail"), t("configureAction"), () => openAtomConfigModal(name), { yellow: true }),
    switchActionRow(t("removeFromWorkflow"), t("removeAction"), () => removeNode(stage, name), { danger: true }),
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

function formatCommaLines(items) {
  return items.length ? items.join(",<br>") : "-";
}

function formatEffectiveInputs(nodeName, json) {
  const lines = [];
  for (const pred of getPredecessors(nodeName)) {
    const atom = atomByName(pred.value);
    for (const output of atom?.json?.produces || []) {
      lines.push(`${output.role} (${t("dynamicFrom").replace("{source}", pred.label)})`);
    }
  }
  for (const input of json?.consumes || []) {
    lines.push(`${input.role}${input.required === false ? "?" : ""}`);
  }
  return formatCommaLines(lines);
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
    : formatCommaLines((json.consumes || []).map((item) => `${item.role}${item.required === false ? "?" : ""}`));
  const outputsText = formatCommaLines((json.produces || []).map((item) => `${item.role} (${item.kind})`));
  const guardrailsText = formatCommaLines(json.prompt?.guardrails || []);
  wrap.innerHTML = `
    <h3>${t("basicInfo")}</h3>
    <dl class="info-grid">
      <dt>name</dt><dd>${json.name || ""}</dd>
      <dt>version</dt><dd>${json.version || ""}</dd>
      <dt>${t("declaredStage")}</dt><dd>${outputsText}</dd>
      <dt>${t("description")}</dt><dd>${json.description || ""}</dd>
      <dt>${t("enabled")}</dt><dd>${json.enabled === false ? t("disabled") : t("enabled")}</dd>
      <dt>${t("timeoutSec")}</dt><dd>${json.timeoutSec ?? 0}</dd>
    </dl>
    <h3>${t("ioInfo")}</h3>
    <dl class="info-grid">
      <dt>${t("inputs")}</dt><dd class="info-list">${inputsText}</dd>
      <dt>${t("outputs")}</dt><dd class="info-list">${outputsText}</dd>
    </dl>
    <h3>${t("promptInfo")}</h3>
    <dl class="info-grid">
      <dt>${t("instruction")}</dt><dd>${json.prompt?.instruction || "-"}</dd>
      <dt>${t("templateRef")}</dt><dd>${json.prompt?.templateRef || "-"}</dd>
      <dt>${t("guardrails")}</dt><dd class="info-list">${guardrailsText}</dd>
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
  const pipeline = getActivePipeline();
  const stageIndex = pipeline.indexOf(stage);
  delete stage.atomTasks.nodes[name];
  for (const pipelineStage of pipeline) {
    for (const def of Object.values(pipelineStage.atomTasks?.nodes || {})) {
      def.next = (def.next || []).filter((item) => item !== name);
      def.parallelWith = (def.parallelWith || []).filter((item) => item !== name);
    }
  }
  syncAllStageEntries();
  markDirty();
  select({ type: "stage", index: stageIndex });
}

function deleteStage(index) {
  if (!confirm(t("deleteStageConfirm"))) return;
  const pipeline = getActivePipeline();
  const [stage] = pipeline.splice(index, 1);
  // Update confirmationGates in the active workflow
  if (state.activeWorkflow?.confirmationGates) {
    state.activeWorkflow.confirmationGates = state.activeWorkflow.confirmationGates.filter((name) => name !== stage.stage);
  }
  markDirty();
  state.selected = null;
  renderAll();
}

els.open.onclick = openFolder;
if (els.metricsBtn) els.metricsBtn.onclick = openMetricsModal;
els.metricsCancel.onclick = closeMetricsModal;
els.metricsConfirm.onclick = saveMetricsModal;
els.metricsBackdrop.onclick = (event) => {
  if (event.target === els.metricsBackdrop) closeMetricsModal();
};
els.atomConfigCancel.onclick = closeAtomConfigModal;
els.atomConfigConfirm.onclick = saveAtomConfigModal;
els.atomConfigBackdrop.onclick = (event) => {
  if (event.target === els.atomConfigBackdrop) closeAtomConfigModal();
};
els.languageToggle.onclick = () => {
  state.lang = state.lang === "en" ? "zh" : "en";
  localStorage.setItem("ddoStudioLang", state.lang);
  renderAll();
};
els.reload.onclick = reloadAll;
els.save.onclick = saveAll;
els.scan.onclick = scanAtoms;
els.taskSearch.oninput = () => { state.query = els.taskSearch.value; renderTasks(); };
els.canvas.onscroll = () => requestAnimationFrame(redrawEdges);
window.onresize = () => requestAnimationFrame(redrawEdges);
renderAll();
