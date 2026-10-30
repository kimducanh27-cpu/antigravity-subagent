# Research brief

One question, sourced answer. Replace `<...>`.

```markdown
### Task: Research <question> and recommend <decision/concrete answer>

#### Goal
Answer <question> with evidence, not opinion. Recommend one option and say why.

#### Context (you cannot see my chat)
<Why this matters, constraints (versions, license, hosting, team skill), what was
already tried or rejected.>

#### Sources
- Prefer: <official docs | GitHub repos | release notes>
- Use web search and read the pages; do not invent URLs or facts.

#### Capabilities (optional)
- Use: <browser MCP / a specific skill, only if installed>
- If unavailable: report it and continue with web search/fetch.

#### Constraints
- Source budget: <N> sources. Ignore marketing pages.
- One run, one task. No follow-up questions.
- If sources conflict, say so and explain the tie-breaker.

#### Acceptance criteria
- Every claim has a source URL that you actually opened.
- The recommendation names its tradeoffs and the conditions under which it is wrong.

#### Output format
1. Recommendation (<= 3 sentences).
2. Comparison table: | Option | Fit | Cost/risk | Evidence |
3. Open questions.
Max <N> words. No preamble.

#### Verify before answering
Verify every cited URL is valid and directly supports the claim; drop the rest.
```
