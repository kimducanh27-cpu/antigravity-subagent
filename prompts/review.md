# Review brief

Read-only audit. Replace `<...>`.

```markdown
### Task: Review <path/component> for <correctness | security | performance | concurrency> issues

#### Goal
Find real defects in <target>. Report only; do not edit any file.

#### Context (you cannot see my chat)
<System behavior, runtime/versions, symptoms, what was already checked.>

#### Files / paths
- Read: <exact paths or globs>
- Reference: <types, tests, docs>
- Write: none

#### Constraints
- Read-only. Do not run servers, install packages, or modify files.
- Report only defects that affect behavior; ignore style and formatting.
- One run, one task. No follow-up questions.

#### Acceptance criteria
- Every finding has a concrete failure scenario and a code citation.
- No speculative finding without a cited line.

#### Output format
Markdown table: | Severity | file:line | Finding | Why it fails | Suggested fix |
Max <N> rows, highest severity first. If clean, print NO_ISSUES_FOUND.
No preamble or closing summary.

#### Verify before answering
Re-read every cited line and confirm the quote matches the current file.
```
