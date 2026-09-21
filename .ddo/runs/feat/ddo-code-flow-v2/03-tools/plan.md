# 工作项 03 · tools — 工具注册框架设计

> 版本：v0.2（2026-09-22 收敛修订）
> 需求依据：[requirement.md](./requirement.md)（D1–D7）

## 1. 定位

`tools/` 在当前阶段只承载**工具注册框架**：命令的声明、分发、帮助与输出契约。业务逻辑（状态推进、索引维护、查询等）不在本阶段实现——它们的机制规格以 [02-index-structure/plan.md](../02-index-structure/plan.md) v1.0 为准，实现随归属设计轮次登记。

## 2. 当前形态

```text
tools/
└── cli.js    # 纯框架（约 140 行）：命令注册表 + 参数解析 + help 渲染 + 分发 + 四通道封装
```

注册表当前为空——命令随各设计轮次逐步登记，help 如实反映「暂无已注册命令」。

## 3. 框架契约

### 3.1 命令声明

```js
{ name: '<domain> <verb>',      // 位置式两段（D5）
  summary: '一句话职责',
  usage:   '调用形态（含全部 flag）',
  options: [{ flag: '--xxx', desc: '参数说明' }],
  run(flags) }                  // 返回值 → stdout JSON；抛 UsageError → exit 2；其他异常 → exit 1
```

- 命令在归属设计轮登记；不预留占位接口（D7）。
- `--help` 三级渲染（全局 / 域 / 命令）均从注册表生成，无第二份文档（D4）。

### 3.2 调用形态与退出码

```text
node tools/cli.js <domain> <verb> [--flag value | --flag=value]
node tools/cli.js --help | <domain> --help | <domain> <verb> --help
```

| 行为 | 结果 |
|---|---|
| 无参数 / `--help` | help → stdout，exit 0 |
| 未知命令 / flag 缺值 / 用法错误 | stderr + exit 2 |
| `run` 抛普通错误 | stderr + exit 1 |
| 成功 | stdout JSON + exit 0 |

### 3.3 环境变量（登记命令时按需启用）

`DDO_HOME`（默认 `~/.ddo`）——全局索引根目录；测试/沙箱隔离用。框架本身不读取它。

## 4. 存档说明

完整基础架构第一版（cli 框架 + lib 五模块 + 六命令，冒烟/回归测试通过）存档于 commit **`9072da5`**。机制代码（runid 计算、state 读写、index 锁与原子写、history 追加）可从该提交整块找回，供归属设计轮复用。

## 5. 下一轮路线（届时设计，不在本期实现）

1. run 生命周期命令（start / update / finish——推进语义随执行循环设计定型）
2. `next`：currentStage + stages DAG → 下一个原子任务
3. 原子任务产物登记（依赖产物机制设计）
4. Prompt 组装/注入
5. workflow 预设格式与 stages 自动展开

## 变更记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.1 | 2026-09-22 | 初版：基础架构（框架 + 六命令 + lib 五模块） |
| v0.2 | 2026-09-22 | 收敛：砍到纯框架（零命令零 lib）；完整版存档于 `9072da5`；登记原则固化为「命令随归属设计轮登记」 |
