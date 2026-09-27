# 用户需求

> 用户触发此流水线的原始需求描述。

## 原始需求

现在这个存在问题，我不希望这个分支结束后，在用户级目录下的history中进行归档，因为这个本身只是一个流程没什么太大的意义，现在是否存在这种机制可以保证不入histroy

（背景：交付收尾 run（pr-delivery 链）在合并确认门处反馈；查证结论为当前 run finish 无条件执行「state 副本拷贝到 ~/.ddo/history/<runId>/ + runs.jsonl 追加」，无任何旋钮或类型过滤。用户决议：先补机制——run finish 增加免归档开关，finish 时旗标可追溯适用于正在等待的交付 run。）

## 需求摘要

run finish 增加免归档开关：跳过用户级 history 的 state 副本归档与 runs.jsonl 追加（index 移除与 currentStage 清空照旧）。
