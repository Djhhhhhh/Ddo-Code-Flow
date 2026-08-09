# Task-01: 修改 SKILL.md

## 标题
添加 --atom 参数和流水线执行描述

## 关联验收点
- G2: --atom 参数支持
- G3: 流水线执行描述

## 变更文件
- SKILL.md

## 具体改动
1. Inputs 部分新增 `--atom <task-name>` 参数说明
2. Step 2 末尾新增「显示流水线执行描述」子步骤（输出 workflow 名称、描述、run type、issue 编号、阶段列表）
3. 新增 Step 2.5 描述 `--atom` 单任务执行路径（跳过 Step 3-7，加载 atom-task，解析输入，执行，注册输出）
