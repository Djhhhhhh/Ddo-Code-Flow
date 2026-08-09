# Task-01: 修改 SKILL.md

## 标题

修改 SKILL.md 添加 --context 参数、修改 Step 1、修改 Runtime Locations、添加约束

## 关联验收点

- G2: --context 参数支持 (AC-2, FR-2)
- G5: Step 1 不创建文件 (AC-5, FR-5)
- G6: Runtime Locations 修正 (AC-6, FR-6)
- G7: 约束补充 (AC-7, FR-7)

## 变更文件

- SKILL.md

## 变更内容

### 1. Runtime Locations 修改（第 28-29 行）

**当前内容**:
```
- `projectConfig`: `<projectRoot>/.ddo/config.json`. It is the only project-owned
  configuration file and is created on first run when absent.
```

**修改为**:
```
- `projectConfig`: `<projectRoot>/.ddo/config.json`. It is the only project-owned
  configuration file. Runtime reads and validates it when present but never creates
  or modifies it. All .ddo/ directory initialization happens in the worktree via
  git-worktree.
```

### 2. Inputs 修改（第 40-43 行）

**当前内容**:
```
- Minimal run arguments:
  - `--model <workflow-id>` selects a workflow explicitly.
  - `--feature` marks the run type as `feat`.
  - `--bugfix` marks the run type as `fix`.
```

**修改为**:
```
- Minimal run arguments:
  - `--model <workflow-id>` selects a workflow explicitly.
  - `--feature` marks the run type as `feat`.
  - `--bugfix` marks the run type as `fix`.
  - `--context <path>` appends a context path for this run only (does not modify
    project config). Can be repeated. Useful for per-requirement context that
    should not persist across runs.
```

### 3. Step 1 修改（第 104-107 行）

**当前内容**:
```
3. Ensure `<projectRoot>/.ddo/` exists. If missing, create:
   - `.ddo/config.json` with a minimal project config object.
   - `.ddo/runs/`.
   Do not modify `.gitignore`, git exclude, or any other git visibility setting.
```

**修改为**:
```
3. Read and validate `<projectRoot>/.ddo/config.json` when it exists. Do not
   create or modify any files in projectRoot. All .ddo/ directory initialization
   happens in the worktree via git-worktree (see Step 5).
```

### 4. Step 1 第 5 条修改（第 109-112 行）

**当前内容**:
```
5. Compose effective config in memory only:
   `config.default.json <- .ddo/config.json <- run arguments`.
   Objects merge recursively, arrays replace as a whole, scalars replace.
   Never write an effective config file to disk.
```

**修改为**:
```
5. Compose effective config in memory only:
   `config.default.json <- .ddo/config.json <- run arguments`.
   Objects merge recursively, arrays replace as a whole, scalars replace.
   For `contextPaths`, run arguments (`--context`) **append** to the merged
   project/base array rather than replacing it. This allows per-run context
   without modifying project config.
   Never write an effective config file to disk.
```

### 5. What This Skill Does Not Do 修改（第 279-284 行）

**当前内容**:
```
## What This Skill Does Not Do

- It does not write to `skillRoot` during a run.
- It does not manage `.gitignore` or git exclude.
- It does not place worktrees inside `.ddo/runs/`.
- It does not add metrics stages or per-atom token attribution.
- It does not keep v2/v3 compatibility logic.
```

**修改为**:
```
## What This Skill Does Not Do

- It does not write to `skillRoot` during a run.
- It does not write to `projectRoot` during a run. All file modifications
  happen in the worktree.
- It does not manage `.gitignore` or git exclude.
- It does not place worktrees inside `.ddo/runs/`.
- It does not add metrics stages or per-atom token attribution.
- It does not keep v2/v3 compatibility logic.
```

## 验收标准

- [ ] cmd: grep -q "\\-\\-context" SKILL.md
- [ ] cmd: grep -q "per-run" SKILL.md
- [ ] cmd: grep -q "append" SKILL.md
- [ ] cmd: ! grep -q "Ensure.*exists.*create" SKILL.md
- [ ] cmd: ! grep -q "\.ddo/config.json.*create" SKILL.md
- [ ] cmd: grep -q "Read and validate" SKILL.md
- [ ] cmd: grep -q "never creates" SKILL.md
- [ ] cmd: grep -q "does not.*modify.*projectRoot" SKILL.md
- [ ] cmd: grep -q "does not write to.*projectRoot" SKILL.md
