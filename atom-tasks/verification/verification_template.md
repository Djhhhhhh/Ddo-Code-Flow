# Verification execution template

> This file is NOT a checklist itself. It documents how the `verification`
> atom-task should parse `test-plan.md` and shape its output `verification.log`.
> Modify only if you also update `verification.json`'s `prompt.instruction`.

## Parsing rules

- `^- \[ \] cmd: (?P<cmd>.+)$` — run `cmd` in `targetDir`, capture exit code.
- `^- \[ \] human: (?P<desc>.+)$` — present `desc` to the user; record their answer.
- `^## G(?P<n>\d+)\. (?P<title>.+)$` — start a new group; reset its counters.
- `^\*\*Pass criterion\*\*` — group boundary marker (informational; not executed).

## verification.log line format

```
[<TS>] [PASS|FAIL] G<group>/<seq> <kind> :: <short-message>
```

Where:
- `<TS>` — ISO-8601 timestamp.
- `<kind>` — either `cmd` or `human`.
- `<short-message>` — for `cmd`: first 200 chars of stderr or `OK` on success.
- For `human`: the description itself or the user's note when rejected.

## Group / final summary

After every group's last item:

```
GROUP G<N> PASSED
```

or

```
GROUP G<N> FAILED: <count> failing
```

When every group has PASSED:

```
ALL PASSED
```

(This is the marker `tail -n 1 verification.log | grep -q "ALL PASSED"`
checks against.)

## Failure handling

When any item FAILs:

1. Do not write the `ALL PASSED` marker.
2. Append a `JUMP_BACK_TO coding` line so the runtime knows to re-enter the
   Coding stage.
3. Record the failing item IDs in `.state.json.stages.verification.failures`.

## Safety guardrails (mirrored from verification.json)

- No `sudo`.
- No mutations outside `targetDir`.
- Per-item default timeout: 120 seconds.
