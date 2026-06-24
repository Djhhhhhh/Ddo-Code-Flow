# {{ Project Name }} Test Plan

> 本文档把已确认的 `spec.md` 中的 AC + 关键 FR 拆为可勾选 checklist。
>
> Verification 阶段按下面两类语法判定：
>
> - `- [ ] cmd: <shell>` —— **自动化测试**：单元测试、接口测试、shell 命令验证等。
>   机器执行，`exit code == 0` 视为通过；输出 / 错误写入 `verification.log`。
> - `- [ ] human: <描述>` —— **功能测试**：在页面上实际操作（点击、输入、切换等），
>   由用户在浏览器 / 客户端中手动执行并确认结果。
>
> 每个 group 末尾的 **Pass criterion** 是该组的整体通过标准。
>
> 用户确认本 test-plan 后，方可进入 Tasking。

---

## G1. {{ Group title }}

> 对应 spec {{ section/AC reference }}。

- [ ] cmd: {{ shell command }}
- [ ] human: {{ description }}

**Pass criterion**：{{ one-line summary }}

---

## G2. {{ Group title }}

> 对应 spec {{ section/AC reference }}。

- [ ] cmd: {{ shell command }}
- [ ] human: {{ description }}

**Pass criterion**：{{ one-line summary }}

---

<!-- 复制更多 group 直到覆盖所有 AC-N -->

---

## 最终验收

- [ ] human: 上述全部 group 均勾选完成。
- [ ] cmd: tail -n 1 verification.log | grep -q "ALL PASSED"

---

<!-- TDD mode only: include this section when TDD is enabled -->

## TDD 测试文件

> 以下测试骨架由 TDD 模式自动生成，处于 **Red** 状态（待实现）。
> Coding 阶段的目标是让这些测试全部变绿。

| Checklist ID | 测试文件 | 测试方法 | 状态 |
|---|---|---|---|
| {{ G1/cmd-1 }} | {{ tests/TestXxx.java }} | {{ testG1_cmd1_xxx() }} | 🔴 Red |

---

## 用户确认

- ✅ **同意**：本 test-plan 符合预期，可进入 **Tasking** 阶段。
- ❌ **修改**：请列出 group / 条目编号与意见。
