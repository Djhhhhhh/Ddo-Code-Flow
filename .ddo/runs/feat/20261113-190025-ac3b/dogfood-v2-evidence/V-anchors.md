# dogfood V-1..V-8 证据（run df，引擎=工作树 v2）

- 引擎：/Users/djhhh/work_area/Ddo-Code-Flow-feat-state-schema-v2-normalization/tools/cli.js
- 临时项目：/tmp/ddo-dogfood-VjiySS（走查后保留至机器重启；证据已拷贝至本目录）
- 日志共 15 行事件，seq 单调；state 终态 currentStage=[]

- run start 成功（exit 0）
- state 创建即含 schemaVersion:2 与 workflow（A 区）
- 日志首事件 run-started（seq=1）
- validate 通过（含 plans/ 目录非空检查，V-6 validate 侧）
- validate 纯读：state 与日志零变化（R-4）
- next 推进并开门
- V-5/V-6：E 区逐文件登记 path/bytes/sha256（split 分册含 CJK 名逐一可见）
- gate present --note 被提示（payload hint）
- V-8：摘要进 presented 事件、state 无 note 字段
- V-1：首交互建立标量后，后续交互 state 字节数不变（覆盖式）
- V-3：gate 无 interactions 键、含 lastInteractedAt 标量
- V-2：interacted 事件含 note 全文
- V-2：seq 全程单调递增
- rollback 清除 artifacts 条目（当前有效集语义）
- V-4：回滚后日志保留全部 interacted 事件
- V-4：state 中 gate 协议对象已删
- V-6：回滚整目录归档至 _del/rollback-1/plans/
- 决议同意 → 阶段完成（updates 相位关门登记）
- updates 相位在 next --decision 关门时登记（§4.3.1）
- finished 为日志末事件（先于 zip）
- finish 后 currentStage 清空（I-7 活文件收束形态）
- zip 归档含 .usage.jsonl（日志随 runDir 入档）

- 证据文件：state.final.json（收束后 state）、usage.jsonl（完整使用日志）