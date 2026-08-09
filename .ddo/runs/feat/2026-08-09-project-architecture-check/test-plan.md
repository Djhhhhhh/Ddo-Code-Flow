# Ddo-Code-Flow 项目架构检查 测试计划

> 基于已确认的 spec.md 生成的验收测试 checklist。

## G1. 架构解耦检查

- [ ] cmd: grep -r "workflow" atom-tasks/*/\*.md --include="*.md" -l | head -5
- [ ] cmd: grep -r "config.default.json" atom-tasks/*/\*.md --include="*.md" -l | head -5
- [ ] cmd: grep -r "pipeline\|stage" atom-tasks/*/\*.md --include="*.md" -l | head -5
- [ ] cmd: grep -r "atom-task" workflows/*.json -l | head -5
- [ ] cmd: grep -r "artifacts.json" atom-tasks/*/\*.md --include="*.md" -l | head -5

通过标准：以上命令均返回空结果或仅返回 schema 引用（非直接依赖），表明三层解耦。

## G2. 全局描述一致性检查

- [ ] cmd: diff <(grep -h "description" config.default.json | sort) <(grep -h "description" config.schema.json | sort) || true
- [ ] cmd: for f in workflows/*.json; do echo "=== $f ==="; python3 -c "import json; d=json.load(open('$f')); print(d.get('name',''), d.get('description',''))"; done
- [ ] cmd: for f in atom-tasks/*/\*.md; do echo "=== $f ==="; head -5 "$f" | grep -E "^name:|^version:"; done

通过标准：各文件的 name、description、version 字段一致，无矛盾描述。

## G3. Skill 描述检查

- [ ] cmd: wc -l SKILL.md
- [ ] cmd: grep -c "##" SKILL.md
- [ ] cmd: grep -E "Step [0-9]" SKILL.md | wc -l
- [ ] cmd: grep -i "必须\|不得\|应该\|可以" SKILL.md | wc -l

通过标准：SKILL.md 结构清晰，执行步骤完整，约束语义明确无歧义。

## G4. 关键执行阶段触发检查

- [ ] cmd: for wf in workflows/*.json; do echo "=== $wf ==="; python3 -c "import json; d=json.load(open('$wf')); [print(s['stage']) for s in d.get('pipeline',[])]"; done
- [ ] cmd: for wf in workflows/*.json; do echo "=== $wf ==="; python3 -c "import json; d=json.load(open('$wf')); print('gates:', d.get('confirmationGates',[]))"; done
- [ ] cmd: grep -r "enabled:" atom-tasks/*/\*.md --include="*.md" | grep "false" | wc -l

通过标准：所有 workflow 的 stage 定义完整，confirmationGates 正确配置，无意外禁用的 atom-task。
