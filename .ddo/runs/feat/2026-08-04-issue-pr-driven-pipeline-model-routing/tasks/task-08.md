# Task 08: 节点级模型路由 Runtime

> 关联验收点：G5（节点级模型路由）

## 目标

实现节点级模型路由 runtime：subagent 委派 + 模型值解析 + 双路径（档位别名/完整名）。

## 变更文件

- `SKILL.md`（更新）
- `atom-tasks/coding/coding.md`（更新）
- `atom-tasks/plan/plan.md`（更新）

## 具体改动

### 1. 更新 SKILL.md

新增"节点级模型路由"section：
- 模型值解析算法
- 优先级：workflow 级 > config 全局 > atom-task 默认 > 继承
- 档位别名路径：直接作为 subagent 模型参数
- 完整模型名路径：写入 subagent 定义文件 model 字段
- subagent 定义文件策略：运行时动态生成

### 2. 更新 coding.md

新增 model option：
```yaml
options:
  - name: model
    type: string
    default: "inherit"
    description: "模型值（档位别名或完整模型名）"
```

指令部分新增模型路由逻辑：
```
IF model != "inherit":
  委派 subagent 执行，传入 model 参数
  记录实际使用的模型到 .state.json
ELSE:
  在主会话内联执行
```

### 3. 更新 plan.md

新增 model option（同 coding.md）。

## 约束

- 向后兼容：model 未配置时回退为继承
- 模型路由失败时记录警告，不中断流水线
- 确认门仍由父会话主持
- subagent 不与用户交互
