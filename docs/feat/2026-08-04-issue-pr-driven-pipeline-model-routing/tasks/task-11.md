# Task 11: SKILL.md 更新

> 关联验收点：G2（远端确认门）、G5（节点级模型路由）

## 目标

更新 `SKILL.md`，新增"远端确认门"与"模型路由"运行时说明。

## 变更文件

- `SKILL.md`（更新）

## 具体改动

### 1. 新增"远端确认门"section

在 Execution 部分新增：
- 远端确认门的定义和用途
- 首次进入流程：评论 + 打 label + 持久化 + Monitor
- 恢复重入流程：读取信号 + 放行/否决/超时
- 白名单作者解析
- 超时处理机制

### 2. 新增"节点级模型路由"section

- 模型值解析算法
- 优先级：workflow 级 > config 全局 > atom-task 默认 > 继承
- 档位别名路径
- 完整模型名路径
- subagent 定义文件策略
- 多模型评审扇出

### 3. 更新"path resolution rules"table

新增 `run://docs/{type}/{dateDescription}/` 路径说明。

### 4. 更新"Failure modes"table

新增远端门和模型路由的失败模式。

## 约束

- 不得删除现有内容（向后兼容）
- 新增内容必须与现有格式一致
- 所有新增机制必须有明确的 failure mode 说明
