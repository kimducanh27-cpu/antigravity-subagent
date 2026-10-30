# Debug brief

Reproduction, root cause, minimal fix. Replace `<...>`.

```markdown
### Task: Diagnose <symptom> in <component>

#### Goal
Find the root cause of <symptom> and propose the smallest correct fix.

#### Context (you cannot see my chat)
- Expected: <behavior>
- Actual: <behavior>
- Repro: <command or steps>
- Error/log excerpt: <paste, scrub secrets>
- Versions/runtime: <...>
- Already ruled out: <hypotheses you eliminated and how>

#### Files / paths
- Read: <exact files or globs>
- Write: <exact files, or "none — diagnosis only">

#### Constraints
- Do not change architecture, dependencies, or unrelated code.
- One run, one task. No follow-up questions.

#### Acceptance criteria
- Root cause is tied to a specific file:line and explains the symptom.
- Fix (or plan) reproduces the failure before and passes after.
- No speculative claims without evidence from the code or logs.

#### Output format
1. Root cause (<= 3 sentences, with file:line).
2. Evidence.
3. Minimal fix (unified diff) or "diagnosis only".
4. Verification command and its real output.
No preamble.

#### Verify before answering
Reproduce the failure, apply the fix, re-run the same command, and show both results.
```
