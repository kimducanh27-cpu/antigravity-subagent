# Implementation brief

Scoped fix or feature. Replace `<...>`.

```markdown
### Task: <Fix | Implement> <behavior> in <paths>

#### Goal
<What the code must do when the run ends.>

#### Context (you cannot see my chat)
<Current behavior, expected behavior, repro or failing test, versions/conventions.>

#### Files / paths
- Read/write: <exact files>
- Do not touch: <files that are out of scope>

#### Constraints
- Minimal diff. No new dependencies. Keep public APIs unchanged.
- Follow <project conventions / style / error handling>.
- One run, one task. No follow-up questions.

#### Acceptance criteria
- [ ] <test command> passes
- [ ] <behavior check>
- [ ] No change outside the listed files

#### Output format
1 short paragraph (what changed and why), then a unified diff, then the real
test output. No other commentary.

#### Verify before answering
Run <test command> and include the actual output. Re-read your diff before sending.
```
