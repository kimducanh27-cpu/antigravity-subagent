# Brief template

Replace every `<...>`. Delete a section only when it truly does not apply.
Remember: the subagent cannot see your chat, your files, or your earlier tool
results.

```markdown
### Task: <imperative title: "Audit X for Y", "Fix Y in Z">

#### Goal
<One sentence. One deliverable. What must exist when the run ends.>

#### Context (you cannot see my chat)
<Runtime and versions. The failing behavior or the decision being reviewed.
Paste the relevant excerpt or error; do not say "see above".>

#### Files / paths
- Read: <exact paths or globs>
- Write: <exact paths, or "none — report only">

#### Constraints
- Mode: <read-only | read-write | test-execution>
- Do not: <install dependencies | change public APIs | reformat untouched code | ...>
- One run, one task. No follow-up questions.

#### Capabilities (optional)
- Use: <skill / MCP server / plugin, only if installed>
- If unavailable: <stop and report | fall back to X>

#### Acceptance criteria
- [ ] <objective check 1>
- [ ] <objective check 2>

#### Output format
<Exact shape: table columns; unified diff; JSON keys; "if clean, print NO_ISSUES_FOUND".>
<Length cap. No preamble, no closing summary.>

#### Verify before answering
<Command to run, or "re-read every cited file:line and confirm the quote".>
```

## Fill rules

| Section | Must answer |
|---|---|
| Goal | What single thing must be true at the end? |
| Context | What do I know that the subagent cannot infer? |
| Files | Where may it look, and where may it write? |
| Constraints | What must it not do, and how many tasks? |
| Capabilities | Which skill/MCP/plugin may it use, and what if it is missing? |
| Acceptance | How will I decide the answer is correct? |
| Output | How will I parse the answer without asking again? |
| Verify | What should it check before it claims done? |
