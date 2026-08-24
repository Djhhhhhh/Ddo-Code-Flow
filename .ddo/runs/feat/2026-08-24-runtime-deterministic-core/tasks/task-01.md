# task-01: runtime 骨架与 CLI 契约

- 关联验收点：G1（AC-1）
- 依赖：无
- 状态：pending

## 目标

建立 `ddo.js` 入口与子命令分派，实现四件套退出码（0=ok / 1=硬失败 / 2=用法错误 / 77=pending）归一，抽取 arg 解析与 JSON 读写 helper。

## 涉及文件

- `scripts/runtime/ddo.js`（新增，入口）
- `scripts/runtime/lib/args.js`（新增，`--flag value` 解析）
- `scripts/runtime/lib/json.js`（新增，`readJson` / `writeJson` 原子写）

## 实现要点

- 复用 `scripts/metrics/plugin.js` 范式（CommonJS、stdout 只吐 JSON、exit code）。
- 入口：`main(argv)` 解析子命令，无子命令/未知子命令 → exit 2 + stderr 用法说明；`--help` → exit 0。
- `writeJson` 用临时文件 + rename 原子落盘，避免半写。
- 子命令分派表先留空壳（后续任务逐个接上），本任务只保证分派骨架与退出码契约。

## 验收

- [ ] cmd: node scripts/runtime/ddo.js（无子命令）返回 exit 2
- [ ] cmd: node scripts/runtime/ddo.js compose-config --help 返回 exit 0
- [ ] cmd: node --test scripts/runtime/test/cli.test.js（去 skip 后全绿）
