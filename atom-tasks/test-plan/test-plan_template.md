# {{ Project Name }} Test Plan

> 本文档把已确认的 `spec.md` 中的 AC + 关键 FR 拆为可勾选 checklist。
>
> Verification 阶段按下面两类语法判定：
>
> - `- [ ] cmd: <shell>` —— 机器执行，`exit code == 0` 视为通过；输出 / 错误写入 `verification.log`。
> - `- [ ] human: <描述>` —— 人工核对勾选，由用户在终端确认。
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

## 用户确认

- ✅ **同意**：本 test-plan 符合预期，可进入 **Tasking** 阶段。
- ❌ **修改**：请列出 group / 条目编号与意见。
