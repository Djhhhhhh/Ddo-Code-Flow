# DdoFlow-Eval

DdoFlow-Eval measures the causal effect of loading Ddo-Code-Flow into the same
Codex host. It does not compare Ddo against an artificially restricted one-shot
prompt. Both conditions may inspect, edit, test, and iterate; the treatment
variable is whether the Ddo skill is injected.

## Implemented in v0.1

- JSON Schema for suites, tasks, private verifiers, scripted-user oracles, and
  structured agent completion.
- `direct`, fixed Ddo workflow, and `ddo-auto` Codex adapters.
- Fixed-commit repository mirrors and isolated per-run checkouts.
- Ddo worktree discovery and patch collection from the actual final worktree.
- Hidden external verification, separated from Ddo-generated tests.
- Scripted HITL turns with the same oracle available to Direct and Ddo.
- Token, latency, false-completion, routing, and acceptance-criterion logging.
- Task-level paired deltas and cluster-bootstrap confidence intervals.
- Six real-repository Smoke tasks: three Python and three TypeScript.

The six public tasks cover every initial track:

| Track | Task | Expected workflow |
|---|---|---|
| Negative control | cachetools `remaining_capacity` | lightweight |
| Ambiguous HITL | itsdangerous input-size policy | guarded |
| Recovery | Tenacity `on_giveup` | guarded |
| Routing | defu array replacement | guarded |
| Guarded risk | destr unsafe-key policy | guarded |
| Long horizon | PQueue pending-task settlement | guarded |

## Private assets

Hidden tests, oracles, reference patches, and mutation cases must not be
committed. The default private root is:

```text
<project>/.eval-private/
├── oracles/
├── references/
├── mutants/
└── verifiers/
```

`.eval-private/` is ignored by Git and excluded from the Ddo skill overlay. A
formal release should move held-out assets to a separate private repository or
evaluation service.

The public JSONL contains only per-criterion booleans and aggregate interaction
metadata. Full verifier output, model questions, scripted answers, and matched
oracle facts remain under `runs-root`; treat that directory as private and do
not publish it.

## Validate manifests

```bash
python3 eval/run.py validate \
  --suite eval/suites/smoke.json \
  --private-root .eval-private
```

## Prepare fixed-commit repository mirrors

Online preparation:

```bash
python3 eval/run.py prepare \
  --suite eval/suites/smoke.json \
  --cache-root /private/tmp/ddoflow-eval-cache
```

After mirrors are populated, require offline reuse:

```bash
python3 eval/run.py prepare \
  --suite eval/suites/smoke.json \
  --cache-root /private/tmp/ddoflow-eval-cache \
  --offline
```

## Audit hidden verifiers

Every task has two mandatory checks:

- the unmodified base commit must fail its hidden requirement tests;
- the held-out reference patch must pass hidden and upstream regression tests.

```bash
python3 eval/run.py audit-verifiers \
  --suite eval/suites/smoke.json \
  --private-root .eval-private \
  --base-root .eval-private/base \
  --reference-root .eval-private/work \
  --runs-root .eval-private/audit-runs
```

## Run the paired Codex experiment

Run a one-repeat infrastructure Smoke first:

```bash
python3 eval/run.py run \
  --suite eval/suites/smoke.json \
  --private-root .eval-private \
  --cache-root /private/tmp/ddoflow-eval-cache \
  --runs-root /private/tmp/ddoflow-eval-runs \
  --results eval/results/smoke.jsonl \
  --conditions direct,ddo-auto \
  --repeats 1 \
  --offline
```

For the causal workflow comparison, use a fixed treatment:

```bash
python3 eval/run.py run \
  --suite eval/suites/smoke.json \
  --private-root .eval-private \
  --cache-root /private/tmp/ddoflow-eval-cache \
  --runs-root /private/tmp/ddoflow-eval-runs \
  --results eval/results/paired.jsonl \
  --conditions direct,ddo-standard \
  --repeats 4 \
  --model MODEL_ID \
  --offline
```

The Harness alternates condition order. Do not run all Direct trials first and
all Ddo trials later.

## Analyze

```bash
python3 eval/run.py analyze \
  --results eval/results/paired.jsonl \
  --baseline direct \
  --treatment ddo-standard \
  --output eval/results/paired-report.json
```

Primary outcome:

```text
Delta Pass@1 = external_pass_rate(Ddo) - external_pass_rate(Direct)
```

The report also includes false-completion rate, tokens per resolved task, task
deltas, and a task-clustered 95% bootstrap interval. Infrastructure failures
are excluded; agent failures, timeouts, invalid workflow completion, and missing
Ddo worktrees remain in the denominator.

## Interpretation rules

- Generated `test-plan.md` and generated tests are process artifacts, never the
  final oracle.
- `pass@k` is secondary; `Pass@1` and cost per resolved task are primary.
- Report task-level wins, ties, and losses, not only a global average.
- Report negative-control overhead separately from capability gains.
- `routingCorrect` measures conformance to the versioned config router; it does
  not by itself prove that the routing policy is optimal.
- Do not combine correctness, cost, documentation, and HITL into a single score.
- Use calibrated human or LLM review only for maintainability; never replace
  executable functional verification with an LLM judge.

## Known v0.1 limitations

- Interruption metadata is present, but automated process termination and
  resume injection are not yet enabled in the public Runner.
- Token budgets are recorded but Codex CLI currently exposes no hard per-run
  token cap; wall-time budgets are enforced.
- The Smoke suite validates infrastructure and failure mechanisms. It is too
  small for a publication-level superiority claim; expand to the 18-task Pilot
  and then the held-out 48-task suite.
