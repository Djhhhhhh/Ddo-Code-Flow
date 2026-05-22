# Execution Report — {{ runId }}

## Run metadata
- runId: `{{ runId }}`
- createdAt: `{{ createdAt }}`
- currentStage: `{{ currentStage }}`

## Requirement (verbatim)
{{ contents of run/requirement.md, fenced }}

## Per-stage artifacts

| Stage | Status | Outputs |
|---|---|---|
| context | {{ status }} | {{ files }} |
| requirement | {{ status }} | {{ files }} |
| specification | {{ status }} | {{ files }} |
| planning | {{ status }} | {{ files }} |
| test-planning | {{ status }} | {{ files }} |
| tasking | {{ status }} | {{ files }} |
| coding | {{ status }} | {{ files }} |
| verification | {{ status }} | {{ files }} |
| review | {{ status }} | {{ files }} |
| reporting | {{ status }} | this file |
| reflection | {{ status }} | {{ files }} |

## Verification summary
{{ pass-count }} passed / {{ fail-count }} failed of {{ total }} checklist items.

{{ Optional: short bulleted list of any failed item that was later fixed. }}

## Context missing
{{ list of declared-but-absent context files, from context-summary.md }}

## Decisions log
{{ entries from .state.json.history, verbatim }}

## Core documents
- Specification: [spec.md](spec.md)
- Plan: [plan.md](plan.md)
- Test plan: [test-plan.md](test-plan.md)
