/* ============================================================
 * ddo-swe UI — single-file entry module.
 *
 * Architecture (all in this file to keep zero deps and zero
 * build steps):
 *
 *   Banner  — top-of-page notification host
 *   FS      — File System Access API wrapper + fallback (import/export)
 *   Schema  — lightweight JSON Schema validator
 *               (Draft 2020-12 subset: type / required / enum / pattern /
 *                items / properties / additionalProperties / $ref / $defs /
 *                minLength / minItems / maxItems / minimum / maximum /
 *                uniqueItems)
 *   DAG     — no-cycle check + reference existence check
 *   Store   — in-memory state: { config, schemas, scannedAtoms, dirHandle, mode }
 *   Tabs    — base / pipeline / atom-tasks (each tab registers itself)
 *
 * Each tab's renderer is implemented further down (task-13 / 14 / 15).
 * ============================================================ */

"use strict";

/* ============================================================
 * Banner
 * ============================================================ */
const Banner = (() => {
  const host = document.getElementById("bannerHost");
  function show(kind, message, autoMs) {
    const node = document.createElement("div");
    node.className = `banner banner--${kind}`;
    node.textContent = message;
    host.appendChild(node);
    if (autoMs) setTimeout(() => node.remove(), autoMs);
    return node;
  }
  function clear() { host.innerHTML = ""; }
  return { show, clear };
})();

/* ============================================================
 * Schema validator — Draft 2020-12 subset
 * ============================================================ */
const Schema = (() => {
  function resolve(ref, root) {
    if (!ref.startsWith("#/")) return null;
    const parts = ref.slice(2).split("/");
    let node = root;
    for (const p of parts) {
      if (node == null) return null;
      node = node[p];
    }
    return node;
  }

  function validate(value, schema, root, path, errors) {
    if (schema.$ref) {
      const resolved = resolve(schema.$ref, root);
      if (!resolved) { errors.push({ path, msg: `unresolved $ref ${schema.$ref}` }); return; }
      return validate(value, resolved, root, path, errors);
    }
    if (schema.type) {
      const t = schema.type;
      const ok =
        (t === "object"  && value && typeof value === "object" && !Array.isArray(value)) ||
        (t === "array"   && Array.isArray(value)) ||
        (t === "string"  && typeof value === "string") ||
        (t === "integer" && Number.isInteger(value)) ||
        (t === "number"  && typeof value === "number") ||
        (t === "boolean" && typeof value === "boolean") ||
        (t === "null"    && value === null);
      if (!ok) { errors.push({ path, msg: `expected type ${t}` }); return; }
    }
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({ path, msg: `value not in enum ${JSON.stringify(schema.enum)}` });
    }
    if (schema.pattern && typeof value === "string") {
      if (!new RegExp(schema.pattern).test(value)) {
        errors.push({ path, msg: `does not match pattern ${schema.pattern}` });
      }
    }
    if (typeof schema.minLength === "number" && typeof value === "string" && value.length < schema.minLength) {
      errors.push({ path, msg: `string shorter than ${schema.minLength}` });
    }
    if (typeof schema.minimum === "number" && typeof value === "number" && value < schema.minimum) {
      errors.push({ path, msg: `< minimum ${schema.minimum}` });
    }
    if (typeof schema.maximum === "number" && typeof value === "number" && value > schema.maximum) {
      errors.push({ path, msg: `> maximum ${schema.maximum}` });
    }
    if (Array.isArray(value)) {
      if (typeof schema.minItems === "number" && value.length < schema.minItems) {
        errors.push({ path, msg: `< minItems ${schema.minItems}` });
      }
      if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
        errors.push({ path, msg: `> maxItems ${schema.maxItems}` });
      }
      if (schema.uniqueItems) {
        const seen = new Set();
        for (const v of value) {
          const key = JSON.stringify(v);
          if (seen.has(key)) { errors.push({ path, msg: `uniqueItems violated` }); break; }
          seen.add(key);
        }
      }
      if (schema.items) {
        value.forEach((v, i) => validate(v, schema.items, root, `${path}[${i}]`, errors));
      }
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (Array.isArray(schema.required)) {
        for (const k of schema.required) {
          if (!(k in value)) errors.push({ path: `${path}.${k}`, msg: `required field missing` });
        }
      }
      if (schema.properties) {
        for (const [k, sub] of Object.entries(schema.properties)) {
          if (k in value) validate(value[k], sub, root, `${path}.${k}`, errors);
        }
      }
      if (schema.additionalProperties === false && schema.properties) {
        for (const k of Object.keys(value)) {
          if (!(k in schema.properties)) {
            errors.push({ path: `${path}.${k}`, msg: `additional property not allowed` });
          }
        }
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        const known = schema.properties || {};
        for (const k of Object.keys(value)) {
          if (!(k in known)) validate(value[k], schema.additionalProperties, root, `${path}.${k}`, errors);
        }
      }
    }
  }

  function check(value, schema) {
    const errors = [];
    validate(value, schema, schema, "$", errors);
    return { ok: errors.length === 0, errors };
  }
  return { check };
})();

/* ============================================================
 * DAG — Kahn's algorithm for no-cycle check + reference check
 * ============================================================ */
const DAG = (() => {
  function checkStage(stageDef) {
    const errors = [];
    const cycles = [];
    const at = stageDef.atomTasks;
    if (!at || !at.nodes) return { ok: true, errors, cycles };
    const nodeNames = Object.keys(at.nodes);

    for (const e of at.entry || []) {
      if (!nodeNames.includes(e)) errors.push(`stage ${stageDef.stage}: entry '${e}' not in nodes`);
    }
    for (const [n, def] of Object.entries(at.nodes)) {
      for (const nxt of def.next || []) {
        if (!nodeNames.includes(nxt)) errors.push(`stage ${stageDef.stage}: node '${n}'.next references unknown '${nxt}'`);
      }
    }

    const inDeg = new Map(nodeNames.map((n) => [n, 0]));
    for (const [, def] of Object.entries(at.nodes)) {
      for (const nxt of def.next || []) {
        if (inDeg.has(nxt)) inDeg.set(nxt, inDeg.get(nxt) + 1);
      }
    }
    const queue = [...inDeg.entries()].filter(([, d]) => d === 0).map(([n]) => n);
    const visited = new Set();
    while (queue.length) {
      const n = queue.shift();
      visited.add(n);
      for (const nxt of at.nodes[n].next || []) {
        const d = inDeg.get(nxt) - 1;
        inDeg.set(nxt, d);
        if (d === 0) queue.push(nxt);
      }
    }
    if (visited.size !== nodeNames.length) {
      const unreachable = nodeNames.filter((n) => !visited.has(n));
      cycles.push({ stage: stageDef.stage, nodes: unreachable });
      errors.push(`stage ${stageDef.stage}: cycle detected involving [${unreachable.join(", ")}]`);
    }
    return { ok: errors.length === 0, errors, cycles };
  }

  function checkConfig(config) {
    const all = { ok: true, errors: [], cycles: [] };
    for (const s of config.pipeline || []) {
      const r = checkStage(s);
      if (!r.ok) {
        all.ok = false;
        all.errors.push(...r.errors);
        all.cycles.push(...r.cycles);
      }
    }
    return all;
  }
  return { checkStage, checkConfig };
})();

/* ============================================================
 * Store — in-memory state, single source of truth
 * ============================================================ */
const Store = {
  dirHandle: null,
  mode: "fsapi", // "fsapi" | "fallback"
  config: null,
  configSchema: null,
  atomTaskSchema: null,
  scannedAtoms: [],
  dirty: false,

  markDirty() {
    this.dirty = true;
    document.getElementById("saveBtn").disabled = false;
  },
  markClean() {
    this.dirty = false;
    document.getElementById("saveBtn").disabled = !this.config;
  },
};
window.DDO = { Banner, Schema, DAG, Store };

/* ============================================================
 * FS layer — File System Access API + fallback
 * ============================================================ */
const FS = (() => {
  const supports = typeof window.showDirectoryPicker === "function";

  async function pickSkillDirectory() {
    if (!supports) {
      Banner.show("warn",
        "当前浏览器不支持 File System Access API。已切换到导入/导出兼容模式。", 0);
      enableFallbackMode();
      return null;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      Store.dirHandle = handle;
      Store.mode = "fsapi";
      document.getElementById("topbarPath").textContent = handle.name + "/";
      await loadAll();
      return handle;
    } catch (e) {
      if (e && e.name === "AbortError") {
        Banner.show("info", "未选择 skill 目录。", 3000);
      } else {
        Banner.show("error", "授权失败：" + (e && e.message || e), 0);
      }
      return null;
    }
  }

  async function readJSON(relPath) {
    if (Store.mode === "fallback") {
      throw new Error(`fallback mode cannot read '${relPath}'`);
    }
    const parts = relPath.split("/").filter(Boolean);
    let h = Store.dirHandle;
    for (let i = 0; i < parts.length - 1; i++) {
      h = await h.getDirectoryHandle(parts[i]);
    }
    const file = await (await h.getFileHandle(parts[parts.length - 1])).getFile();
    return JSON.parse(await file.text());
  }

  async function writeJSON(relPath, obj) {
    if (Store.mode === "fallback") {
      Banner.show("warn", "兼容模式下无法直接写盘，请使用 Export 下载。", 4000);
      return;
    }
    const parts = relPath.split("/").filter(Boolean);
    let h = Store.dirHandle;
    for (let i = 0; i < parts.length - 1; i++) {
      h = await h.getDirectoryHandle(parts[i], { create: false });
    }
    const fh = await h.getFileHandle(parts[parts.length - 1], { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify(obj, null, 2) + "\n");
    await w.close();
  }

  async function listAtomTaskDirs() {
    if (Store.mode === "fallback") return [];
    const atomsDir = await Store.dirHandle.getDirectoryHandle("atom-tasks");
    const result = [];
    for await (const [name, entry] of atomsDir.entries()) {
      if (entry.kind !== "directory") continue;
      if (name.startsWith("_")) continue;
      try {
        const file = await (await entry.getFileHandle(`${name}.json`)).getFile();
        const json = JSON.parse(await file.text());
        result.push({ name, json, broken: false });
      } catch (e) {
        result.push({ name, json: null, broken: true, reason: e.message });
      }
    }
    return result;
  }

  function enableFallbackMode() {
    Store.mode = "fallback";
    const bar = document.querySelector(".topbar__actions");
    bar.innerHTML = "";
    const importInput = document.createElement("input");
    importInput.type = "file";
    importInput.accept = ".json";
    importInput.id = "importInput";
    importInput.style.display = "none";
    importInput.addEventListener("change", async () => {
      const f = importInput.files[0];
      if (!f) return;
      try {
        Store.config = JSON.parse(await f.text());
        Store.configSchema = null; // unavailable in fallback
        document.getElementById("topbarPath").textContent = `(imported) ${f.name}`;
        await afterConfigLoaded();
      } catch (e) {
        Banner.show("error", "导入失败：" + e.message, 0);
      }
    });
    const importBtn = document.createElement("button");
    importBtn.className = "btn btn-secondary";
    importBtn.textContent = "Import config.json";
    importBtn.onclick = () => importInput.click();

    const exportBtn = document.createElement("button");
    exportBtn.className = "btn btn-primary";
    exportBtn.textContent = "Export config.json";
    exportBtn.onclick = () => {
      if (!Store.config) return;
      const blob = new Blob([JSON.stringify(Store.config, null, 2) + "\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "config.json";
      a.click();
      URL.revokeObjectURL(url);
    };
    bar.append(importBtn, importInput, exportBtn);
  }

  return { supports, pickSkillDirectory, readJSON, writeJSON, listAtomTaskDirs, enableFallbackMode };
})();

/* ============================================================
 * Legacy DAG auto-migration
 * Old form: pipeline[i].atomTasks = ["a","b","c"]
 * New form: { entry:["a"], nodes:{ a:{next:["b"],parallelApprove:false}, ... } }
 * ============================================================ */
function maybeMigrate(config) {
  let migrated = false;
  for (const s of config.pipeline || []) {
    if (Array.isArray(s.atomTasks)) {
      const arr = s.atomTasks;
      const nodes = {};
      for (let i = 0; i < arr.length; i++) {
        nodes[arr[i]] = {
          next: i + 1 < arr.length ? [arr[i + 1]] : [],
          parallelApprove: false,
        };
      }
      s.atomTasks = { entry: arr.length ? [arr[0]] : [], nodes };
      migrated = true;
    }
    if (s.atomTasks && !("nodes" in s.atomTasks)) {
      s.atomTasks.nodes = {};
    }
    if (s.atomTasks && !("entry" in s.atomTasks)) {
      s.atomTasks.entry = [];
    }
  }
  return migrated;
}

/* ============================================================
 * Loading orchestrator
 * ============================================================ */
async function loadAll() {
  Banner.clear();
  try {
    Store.config = await FS.readJSON("config.json");
    Store.configSchema = await FS.readJSON("config.schema.json");
    try {
      Store.atomTaskSchema = await FS.readJSON("atom-tasks/_schema/atom-task.schema.json");
    } catch (_) { /* atom-task schema is optional for config editing */ }
    await afterConfigLoaded();
  } catch (e) {
    Banner.show("error", "读取 config.json 失败：" + e.message, 0);
  }
}

async function afterConfigLoaded() {
  if (maybeMigrate(Store.config)) {
    Banner.show("warn", "config.json 已自动升级为 DAG 拓扑结构（旧的字符串数组已被迁移）。请检查并保存。", 0);
    Store.markDirty();
  }

  // Validate against schema (skip in fallback mode if schema missing)
  if (Store.configSchema) {
    const r = Schema.check(Store.config, Store.configSchema);
    if (!r.ok) {
      Banner.show("error",
        "config.json schema 校验失败：" + r.errors.slice(0, 3).map((e) => `${e.path} — ${e.msg}`).join("; "),
        0);
    }
  }
  // DAG check
  const d = DAG.checkConfig(Store.config);
  if (!d.ok) {
    Banner.show("error", "DAG 校验失败：" + d.errors.slice(0, 3).join("; "), 0);
  }

  document.getElementById("reloadBtn").disabled = false;
  document.getElementById("saveBtn").disabled = !Store.dirty;
  hidePlaceholdersAndRender();
}

function hidePlaceholdersAndRender() {
  document.getElementById("baseTabPlaceholder").style.display = "none";
  document.getElementById("baseForm").hidden = false;

  document.getElementById("pipelineTabPlaceholder").style.display = "none";
  document.getElementById("pipelineHost").hidden = false;

  document.getElementById("atomsTabPlaceholder").style.display = "none";
  document.getElementById("atomsHost").hidden = false;

  if (Tabs.base.render)   Tabs.base.render();
  if (Tabs.pipeline.render) Tabs.pipeline.render();
  if (Tabs.atomTasks.render) Tabs.atomTasks.render(true);
}

/* ============================================================
 * Save / Reload
 * ============================================================ */
async function saveAll() {
  if (!Store.config) return;
  // Re-validate before save
  if (Store.configSchema) {
    const r = Schema.check(Store.config, Store.configSchema);
    if (!r.ok) {
      Banner.show("error",
        "保存被阻止：schema 校验失败：" + r.errors.slice(0, 3).map((e) => `${e.path} — ${e.msg}`).join("; "),
        0);
      return;
    }
  }
  const d = DAG.checkConfig(Store.config);
  if (!d.ok) {
    Banner.show("error", "保存被阻止：DAG 中存在环：" + d.errors.slice(0, 3).join("; "), 0);
    return;
  }
  try {
    await FS.writeJSON("config.json", Store.config);
    Store.markClean();
    Banner.show("info", "已保存到 config.json", 1500);
  } catch (e) {
    Banner.show("error", "保存失败：" + e.message, 0);
  }
}

async function reloadAll() {
  if (Store.mode === "fallback") {
    Banner.show("info", "兼容模式下请使用 Import 重新载入文件。", 3000);
    return;
  }
  Store.dirty = false;
  await loadAll();
}

/* ============================================================
 * Wire topbar
 * ============================================================ */
document.getElementById("openFolderBtn").addEventListener("click", () => FS.pickSkillDirectory());
document.getElementById("reloadBtn").addEventListener("click", reloadAll);
document.getElementById("saveBtn").addEventListener("click", saveAll);

// Special hook so other modules can request a save without re-querying DOM.
window.addEventListener("ddo:save", saveAll);
window.addEventListener("ddo:reload", reloadAll);

/* ============================================================
 * Tab switching
 * ============================================================ */
(function bootstrapTabs() {
  const tabs = document.querySelectorAll(".tab-pill");
  const panels = document.querySelectorAll(".tab-panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
      });
      panels.forEach((p) => p.classList.toggle("is-active", p.dataset.panel === target));
      window.dispatchEvent(new CustomEvent("ddo:tab-changed", { detail: { tab: target } }));
    });
  });
})();

/* ============================================================
 * Tabs registry — implementations added by task-13/14/15 below.
 * Each tab module installs itself into the Tabs namespace.
 * ============================================================ */
const Tabs = { base: {}, pipeline: {}, atomTasks: {} };

/* ============================================================
 * ===== Task-13 — Base Tab ===================================
 * ============================================================ */
(function installBaseTab() {
  const host = document.getElementById("baseForm");
  function render() {
    const c = Store.config.base;
    host.innerHTML = "";

    const row = (label, hint, ...controls) => {
      const wrap = document.createElement("div");
      wrap.className = "form__row";
      const lab = document.createElement("div");
      lab.className = "form__label";
      lab.textContent = label;
      if (hint) {
        const h = document.createElement("span");
        h.className = "form__label-hint";
        h.textContent = hint;
        lab.appendChild(h);
      }
      const field = document.createElement("div");
      field.className = "form__field";
      controls.forEach((ctl) => field.appendChild(ctl));
      wrap.append(lab, field);
      host.appendChild(wrap);
    };

    // targetDir
    const targetInput = document.createElement("input");
    targetInput.className = "text-input";
    targetInput.value = c.targetDir;
    targetInput.addEventListener("input", () => { c.targetDir = targetInput.value; Store.markDirty(); });
    row("targetDir", "流水线产物落地目录（相对或绝对路径）", targetInput);

    // contextPaths chips
    const chipHost = document.createElement("div");
    chipHost.className = "form__field";
    function renderChips() {
      chipHost.innerHTML = "";
      c.contextPaths.forEach((p, i) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = p;
        const x = document.createElement("button");
        x.className = "chip__remove";
        x.textContent = "×";
        x.title = "Remove";
        x.addEventListener("click", () => {
          c.contextPaths.splice(i, 1);
          Store.markDirty();
          renderChips();
        });
        chip.appendChild(x);
        chipHost.appendChild(chip);
      });
      const addBtn = document.createElement("button");
      addBtn.className = "btn btn-secondary";
      addBtn.type = "button";
      addBtn.textContent = "+ Add path";
      addBtn.addEventListener("click", () => {
        const p = prompt("Add context path (relative to targetDir):");
        if (p) { c.contextPaths.push(p); Store.markDirty(); renderChips(); }
      });
      chipHost.appendChild(addBtn);
    }
    renderChips();
    row("contextPaths", "Context 阶段读取的文件 / 目录列表", chipHost);

    // contextOptional toggle
    const optBtn = document.createElement("button");
    optBtn.type = "button";
    const strictBtn = document.createElement("button");
    strictBtn.type = "button";
    function paintToggle() {
      optBtn.className = "btn " + (c.contextOptional ? "btn-primary" : "btn-secondary");
      optBtn.textContent = "Optional";
      strictBtn.className = "btn " + (!c.contextOptional ? "btn-primary" : "btn-secondary");
      strictBtn.textContent = "Strict";
    }
    paintToggle();
    optBtn.addEventListener("click", () => { c.contextOptional = true; Store.markDirty(); paintToggle(); });
    strictBtn.addEventListener("click", () => { c.contextOptional = false; Store.markDirty(); paintToggle(); });
    const tg = document.createElement("div"); tg.className = "toggle-group"; tg.append(optBtn, strictBtn);
    row("contextOptional", "缺失非关键 context 是否阻断流水线", tg);

    // respGenerator
    const rg = c.respGenerator;
    const maxLenInput = document.createElement("input");
    maxLenInput.className = "text-input"; maxLenInput.type = "number"; maxLenInput.min = "1"; maxLenInput.max = "128";
    maxLenInput.style.minWidth = "120px";
    maxLenInput.value = rg.maxLength;
    maxLenInput.addEventListener("input", () => { rg.maxLength = Number(maxLenInput.value) || 1; Store.markDirty(); });

    const caseSelect = document.createElement("select");
    caseSelect.className = "atom-card__select";
    ["kebab", "snake", "camel"].forEach((opt) => {
      const o = document.createElement("option"); o.value = o.textContent = opt;
      if (opt === rg.case) o.selected = true;
      caseSelect.appendChild(o);
    });
    caseSelect.addEventListener("change", () => { rg.case = caseSelect.value; Store.markDirty(); });

    const swBtn = document.createElement("button");
    swBtn.type = "button";
    function paintSw() {
      swBtn.className = "btn " + (rg.stripStopwords ? "btn-primary" : "btn-secondary");
      swBtn.textContent = rg.stripStopwords ? "stripStopwords ON" : "stripStopwords OFF";
    }
    paintSw();
    swBtn.addEventListener("click", () => { rg.stripStopwords = !rg.stripStopwords; Store.markDirty(); paintSw(); });

    const rgField = document.createElement("div");
    rgField.className = "form__field";
    rgField.append(
      Object.assign(document.createElement("span"), { className: "hint", textContent: "maxLength" }),
      maxLenInput,
      Object.assign(document.createElement("span"), { className: "hint", textContent: "case" }),
      caseSelect,
      swBtn
    );
    row("respGenerator", "<desp> 目录后缀生成规则", rgField);
  }
  Tabs.base.render = render;
})();

/* ============================================================
 * ===== Task-14 — Pipeline Tab ===============================
 * ============================================================ */
(function installPipelineTab() {
  const lanesHost = document.getElementById("pipelineLanes");
  const edgesSvg  = document.getElementById("pipelineEdges");
  const drawer    = document.getElementById("pipelineDrawerList");
  const hint      = document.getElementById("pipelineHint");
  const toggleBtn = document.getElementById("toggleParallelApproveBtn");

  let linkSource = null;          // { stageIdx, nodeName }
  const selectedNodes = new Set(); // keys of form "stageIdx::nodeName"

  function selKey(stageIdx, nodeName) { return `${stageIdx}::${nodeName}`; }

  function renderDrawer() {
    drawer.innerHTML = "";
    const used = new Set();
    (Store.config.pipeline || []).forEach((s) => {
      Object.keys(s.atomTasks?.nodes || {}).forEach((n) => used.add(n));
    });
    const candidates = Store.scannedAtoms.length
      ? Store.scannedAtoms
      : Object.entries(Store.config.atomTaskOverrides || {}).map(([n]) => ({ name: n, json: null }));
    const available = candidates.filter((c) => !used.has(c.name));

    if (!available.length) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "（所有 atom-task 已在流水线中。Atom-tasks Tab 可扫描更多。）";
      drawer.appendChild(empty);
      return;
    }
    available.forEach((c) => {
      const item = document.createElement("div");
      item.className = "drawer-item";
      item.draggable = true;
      const title = document.createElement("div");
      title.className = "drawer-item__title";
      title.textContent = c.name;
      const desc = document.createElement("div");
      desc.className = "drawer-item__desc";
      desc.textContent = c.json?.description || "(no description in atom-task JSON)";
      item.append(title, desc);
      item.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/atom-name", c.name);
        e.dataTransfer.setData("text/atom-default-stage", c.json?.stage || "");
        item.classList.add("is-dragging");
      });
      item.addEventListener("dragend", () => item.classList.remove("is-dragging"));
      drawer.appendChild(item);
    });
  }

  function render() {
    lanesHost.innerHTML = "";
    const gates = new Set(Store.config.base.confirmationGates);

    (Store.config.pipeline || []).forEach((stageDef, stageIdx) => {
      const lane = document.createElement("div");
      lane.className = "stage-lane";
      if (gates.has(stageDef.stage)) lane.classList.add("is-confirmation-gate");
      lane.dataset.stageIdx = String(stageIdx);
      lane.draggable = true;

      const header = document.createElement("div");
      header.className = "stage-lane__header";
      const title = document.createElement("div");
      title.className = "stage-lane__title";
      title.contentEditable = "false";
      title.textContent = stageDef.stage;
      header.appendChild(title);

      const desc = document.createElement("div");
      desc.className = "stage-lane__desc";
      desc.contentEditable = "true";
      desc.title = "双击可编辑 description";
      desc.textContent = stageDef.description;
      desc.addEventListener("blur", () => {
        const v = desc.textContent.trim();
        if (v && v !== stageDef.description) { stageDef.description = v; Store.markDirty(); }
        else if (!v) { desc.textContent = stageDef.description; }
      });
      header.appendChild(desc);
      lane.appendChild(header);

      const nodesHost = document.createElement("div");
      nodesHost.className = "stage-lane__nodes" + (Object.keys(stageDef.atomTasks?.nodes || {}).length ? "" : " is-empty");
      lane.appendChild(nodesHost);

      Object.entries(stageDef.atomTasks?.nodes || {}).forEach(([name, def]) => {
        nodesHost.appendChild(renderNode(stageIdx, stageDef, name, def));
      });

      // Drag-and-drop stage reorder
      lane.addEventListener("dragover", (e) => { e.preventDefault(); });
      lane.addEventListener("drop", (e) => {
        e.preventDefault();
        const atomName = e.dataTransfer.getData("text/atom-name");
        const movingStageIdx = e.dataTransfer.getData("text/stage-idx");

        if (atomName) {
          // Drop atom-task into this lane
          if (!stageDef.atomTasks) stageDef.atomTasks = { entry: [], nodes: {} };
          if (!stageDef.atomTasks.nodes[atomName]) {
            stageDef.atomTasks.nodes[atomName] = { next: [], parallelApprove: false };
            stageDef.atomTasks.entry.push(atomName);
            Store.markDirty();
            render();
          }
        } else if (movingStageIdx !== "") {
          // Reorder stages
          const from = Number(movingStageIdx);
          const to = stageIdx;
          if (from !== to) {
            const arr = Store.config.pipeline;
            const [moved] = arr.splice(from, 1);
            arr.splice(to, 0, moved);
            Store.markDirty();
            render();
          }
        }
      });
      lane.addEventListener("dragstart", (e) => {
        if (e.target === lane || e.target.classList?.contains("stage-lane__title")) {
          e.dataTransfer.setData("text/stage-idx", String(stageIdx));
        }
      });

      lanesHost.appendChild(lane);
    });

    renderDrawer();
    queueRedrawEdges();
    updateToggleBtn();
  }

  function renderNode(stageIdx, stageDef, name, def) {
    const node = document.createElement("div");
    node.className = "atom-node";
    if (selectedNodes.has(selKey(stageIdx, name))) node.classList.add("is-selected");
    if (def.parallelApprove) node.classList.add("is-parallel-batch");
    node.dataset.stageIdx = String(stageIdx);
    node.dataset.nodeName = name;

    // Mark broken if reference doesn't exist in scanned atoms
    const known = Store.scannedAtoms.find((a) => a.name === name);
    if (Store.scannedAtoms.length && (!known || known.broken)) node.classList.add("is-error");

    const x = document.createElement("button");
    x.className = "atom-node__remove";
    x.textContent = "×";
    x.title = "Remove node";
    x.addEventListener("click", (e) => {
      e.stopPropagation();
      removeNode(stageDef, name);
      Store.markDirty();
      render();
    });
    node.appendChild(x);

    const title = document.createElement("div");
    title.className = "atom-node__title";
    title.textContent = name;
    node.appendChild(title);

    const description = known?.json?.description || "(description unavailable; scan atom-tasks/)";
    const descEl = document.createElement("div");
    descEl.className = "atom-node__desc";
    descEl.textContent = description;
    node.appendChild(descEl);

    const anchor = document.createElement("button");
    anchor.className = "atom-node__anchor";
    anchor.type = "button";
    anchor.textContent = linkSource && linkSource.stageIdx === stageIdx && linkSource.nodeName === name
      ? "click target ↗"
      : "+ connect";
    anchor.addEventListener("click", (e) => {
      e.stopPropagation();
      handleAnchorClick(stageIdx, stageDef, name);
    });
    node.appendChild(anchor);

    // Click node body (not button) to toggle selection
    node.addEventListener("click", () => {
      const k = selKey(stageIdx, name);
      if (selectedNodes.has(k)) selectedNodes.delete(k);
      else selectedNodes.add(k);
      node.classList.toggle("is-selected");
      updateToggleBtn();
    });

    return node;
  }

  function handleAnchorClick(stageIdx, stageDef, name) {
    if (!linkSource) {
      linkSource = { stageIdx, nodeName: name };
      hint.textContent = `Connecting from ${stageDef.stage}/${name} … click another node's "+ connect" to draw an edge (Esc to cancel).`;
      render();
      return;
    }
    if (linkSource.stageIdx === stageIdx && linkSource.nodeName === name) {
      linkSource = null;
      hint.textContent = "";
      render();
      return;
    }
    // Only allow edges within the same stage
    if (linkSource.stageIdx !== stageIdx) {
      Banner.show("warn", "暂不支持跨 stage 连线；stage 之间默认按数组顺序顺序执行。", 3000);
      linkSource = null;
      hint.textContent = "";
      render();
      return;
    }
    const srcNode = stageDef.atomTasks.nodes[linkSource.nodeName];
    if (!srcNode.next.includes(name)) {
      srcNode.next.push(name);
      Store.markDirty();
    }
    linkSource = null;
    hint.textContent = "";
    render();
    runDagCheck();
  }

  function removeNode(stageDef, name) {
    if (!stageDef.atomTasks) return;
    delete stageDef.atomTasks.nodes[name];
    stageDef.atomTasks.entry = stageDef.atomTasks.entry.filter((n) => n !== name);
    for (const def of Object.values(stageDef.atomTasks.nodes)) {
      def.next = def.next.filter((n) => n !== name);
    }
    selectedNodes.delete(selKey(stageDef, name));
  }

  function updateToggleBtn() {
    toggleBtn.disabled = selectedNodes.size === 0;
    toggleBtn.textContent = selectedNodes.size
      ? `Toggle parallelApprove for ${selectedNodes.size} selected`
      : "Toggle parallel-approve on selected";
  }

  toggleBtn.addEventListener("click", () => {
    // Determine target boolean: if any selected node is currently false, set all to true; else set all to false.
    let anyOff = false;
    for (const k of selectedNodes) {
      const [si, name] = k.split("::");
      const def = Store.config.pipeline[Number(si)].atomTasks.nodes[name];
      if (!def.parallelApprove) { anyOff = true; break; }
    }
    const target = anyOff;
    for (const k of selectedNodes) {
      const [si, name] = k.split("::");
      Store.config.pipeline[Number(si)].atomTasks.nodes[name].parallelApprove = target;
    }
    Store.markDirty();
    render();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && linkSource) {
      linkSource = null;
      hint.textContent = "";
      render();
    }
  });

  function queueRedrawEdges() { requestAnimationFrame(redrawEdges); }
  function redrawEdges() {
    edgesSvg.innerHTML = `
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"></path>
        </marker>
      </defs>`;
    const canvasRect = document.getElementById("pipelineCanvas").getBoundingClientRect();
    edgesSvg.setAttribute("width", String(canvasRect.width));
    edgesSvg.setAttribute("height", String(canvasRect.height));

    const cycleInfo = DAG.checkConfig(Store.config);
    const cycleNodes = new Set();
    cycleInfo.cycles.forEach((c) => c.nodes.forEach((n) => cycleNodes.add(`${c.stage}::${n}`)));

    Store.config.pipeline.forEach((stageDef) => {
      const stageNodes = stageDef.atomTasks?.nodes || {};
      Object.entries(stageNodes).forEach(([from, def]) => {
        (def.next || []).forEach((to) => {
          const fromEl = lanesHost.querySelector(
            `.stage-lane[data-stage-idx="${Store.config.pipeline.indexOf(stageDef)}"] .atom-node[data-node-name="${from}"]`,
          );
          const toEl = lanesHost.querySelector(
            `.stage-lane[data-stage-idx="${Store.config.pipeline.indexOf(stageDef)}"] .atom-node[data-node-name="${to}"]`,
          );
          if (!fromEl || !toEl) return;
          const a = fromEl.getBoundingClientRect();
          const b = toEl.getBoundingClientRect();
          const ax = a.right - canvasRect.left;
          const ay = a.top + a.height / 2 - canvasRect.top;
          const bx = b.left - canvasRect.left;
          const by = b.top + b.height / 2 - canvasRect.top;
          const midX = (ax + bx) / 2;
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", `M ${ax} ${ay} C ${midX} ${ay}, ${midX} ${by}, ${bx} ${by}`);
          path.setAttribute("marker-end", "url(#arrow)");
          if (cycleNodes.has(`${stageDef.stage}::${from}`) || cycleNodes.has(`${stageDef.stage}::${to}`)) {
            path.classList.add("edge--error");
          }
          edgesSvg.appendChild(path);
        });
      });
    });
    runDagCheck();
  }

  function runDagCheck() {
    const d = DAG.checkConfig(Store.config);
    if (!d.ok) {
      document.getElementById("saveBtn").disabled = true;
      hint.textContent = "DAG 存在环，Save 已禁用。" + d.errors.slice(0, 1).join(" ");
    } else if (Store.dirty) {
      document.getElementById("saveBtn").disabled = false;
      if (!linkSource) hint.textContent = "";
    }
  }

  window.addEventListener("resize", queueRedrawEdges);
  window.addEventListener("ddo:tab-changed", (e) => {
    if (e.detail.tab === "pipeline") queueRedrawEdges();
  });

  Tabs.pipeline.render = render;
})();

/* ============================================================
 * ===== Task-15 — Atom-tasks Tab =============================
 * ============================================================ */
(function installAtomTasksTab() {
  const host = document.getElementById("atomsGrid");
  const scanBtn = document.getElementById("scanBtn");
  const hint = document.getElementById("atomsHint");

  async function scan() {
    if (Store.mode === "fallback") {
      Store.scannedAtoms = []; // Cannot scan dir in fallback mode
      hint.textContent = "兼容模式下无法扫描 atom-tasks/。仅列出 config.json 中已引用的项。";
      render(false);
      return;
    }
    hint.textContent = "Scanning…";
    try {
      Store.scannedAtoms = await FS.listAtomTaskDirs();
      hint.textContent = `Found ${Store.scannedAtoms.length} atom-task(s).`;
      render(false);
    } catch (e) {
      hint.textContent = "";
      Banner.show("error", "扫描失败：" + e.message, 0);
    }
  }

  function getInPipelineLocation(name) {
    for (let i = 0; i < Store.config.pipeline.length; i++) {
      const s = Store.config.pipeline[i];
      if (s.atomTasks?.nodes && name in s.atomTasks.nodes) return s.stage;
    }
    return null;
  }

  function effectiveEnabled(item) {
    const ov = Store.config.atomTaskOverrides?.[item.name];
    if (ov && typeof ov.enabled === "boolean") return ov.enabled;
    return item.json?.enabled !== false;
  }

  function setEnabled(name, enabled) {
    if (!Store.config.atomTaskOverrides) Store.config.atomTaskOverrides = {};
    Store.config.atomTaskOverrides[name] = { enabled };
    Store.markDirty();
  }

  function addToStage(name, targetStage) {
    const s = Store.config.pipeline.find((st) => st.stage === targetStage);
    if (!s) {
      Banner.show("error", "找不到目标 stage：" + targetStage, 4000);
      return;
    }
    if (!s.atomTasks) s.atomTasks = { entry: [], nodes: {} };
    if (!s.atomTasks.nodes[name]) {
      s.atomTasks.nodes[name] = { next: [], parallelApprove: false };
      s.atomTasks.entry.push(name);
      Store.markDirty();
      Tabs.pipeline.render && Tabs.pipeline.render();
    }
    // Switch to pipeline tab
    document.querySelector('.tab-pill[data-tab="pipeline"]').click();
    Banner.show("info", `已将 ${name} 加入 ${targetStage} 阶段。`, 2000);
  }

  function render(triggerScanIfEmpty) {
    if (triggerScanIfEmpty && !Store.scannedAtoms.length && Store.mode === "fsapi") {
      scan();
      return;
    }
    host.innerHTML = "";
    const items = Store.scannedAtoms.length
      ? Store.scannedAtoms
      : (() => {
          // fallback: list every atom-task referenced in pipeline
          const set = new Set();
          (Store.config.pipeline || []).forEach((s) =>
            Object.keys(s.atomTasks?.nodes || {}).forEach((n) => set.add(n)));
          Object.keys(Store.config.atomTaskOverrides || {}).forEach((n) => set.add(n));
          return [...set].map((n) => ({ name: n, json: null, broken: false }));
        })();

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "tab-empty";
      empty.textContent = '点击 "Scan atom-tasks/" 扫描磁盘上的 atom-task 子目录。';
      host.appendChild(empty);
      return;
    }

    const stages = Store.config.pipeline.map((s) => s.stage);

    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "atom-card" + (item.broken ? " is-broken" : "");

      const head = document.createElement("div");
      head.className = "atom-card__head";

      const title = document.createElement("div");
      title.className = "atom-card__title";
      title.textContent = item.name;
      head.appendChild(title);

      const enabledBtn = document.createElement("button");
      enabledBtn.type = "button";
      const en = effectiveEnabled(item);
      enabledBtn.className = "btn " + (en ? "btn-primary" : "btn-secondary");
      enabledBtn.textContent = en ? "ENABLED" : "DISABLED";
      enabledBtn.addEventListener("click", () => {
        setEnabled(item.name, !effectiveEnabled(item));
        render(false);
      });
      head.appendChild(enabledBtn);

      card.appendChild(head);

      const desc = document.createElement("div");
      desc.className = "atom-card__desc";
      desc.textContent = item.broken
        ? `broken: missing ${item.name}.json (${item.reason || "unknown"})`
        : (item.json?.description || "(no description)");
      card.appendChild(desc);

      const meta = document.createElement("div");
      meta.className = "atom-card__meta";
      const inStage = getInPipelineLocation(item.name);
      const declared = item.json?.stage;
      meta.innerHTML =
        `<span>stage: <span class="ok">${declared || "?"}</span></span>` +
        `<span>in pipeline: ${
          inStage
            ? `<span class="ok">✓ ${inStage}</span>`
            : `<span class="no">✗</span>`
        }</span>`;
      card.appendChild(meta);

      if (!inStage && !item.broken) {
        const actions = document.createElement("div");
        actions.className = "atom-card__actions";
        const sel = document.createElement("select");
        sel.className = "atom-card__select";
        stages.forEach((st) => {
          const o = document.createElement("option");
          o.value = o.textContent = st;
          if (st === declared) o.selected = true;
          sel.appendChild(o);
        });
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "btn btn-primary";
        addBtn.textContent = "Add to stage";
        addBtn.addEventListener("click", () => addToStage(item.name, sel.value));
        actions.append(
          Object.assign(document.createElement("span"), { className: "hint", textContent: "Add to" }),
          sel,
          addBtn,
        );
        card.appendChild(actions);
      } else if (inStage) {
        const jumpBtn = document.createElement("button");
        jumpBtn.type = "button";
        jumpBtn.className = "btn btn-secondary";
        jumpBtn.textContent = `Jump to ${inStage} →`;
        jumpBtn.addEventListener("click", () => {
          document.querySelector('.tab-pill[data-tab="pipeline"]').click();
        });
        const actions = document.createElement("div");
        actions.className = "atom-card__actions";
        actions.appendChild(jumpBtn);
        card.appendChild(actions);
      }

      host.appendChild(card);
    });
  }

  scanBtn.addEventListener("click", scan);
  window.addEventListener("ddo:tab-changed", (e) => {
    if (e.detail.tab === "atom-tasks") render(true);
  });

  Tabs.atomTasks.render = render;
})();
