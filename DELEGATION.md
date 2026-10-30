# Delegating to Antigravity: the leader's playbook

`subagent_antigravity` (DeepSeek Harness) and `scripts/agy-task.mjs` (any agent)
run **one task in an isolated agent**. It cannot see your chat, the files you
have already read, your tool results, or your assumptions. Everything it needs
must be in the brief you write.

This page is for the **leader** — the agent that delegates. It distills how to
write a brief that gets a useful answer on the first run.

## When to delegate

Delegate when the work is:

- **self-contained and bounded** — one review, one bug, one research question;
- **context-heavy** — large files, multi-file audits, log or failure triage;
- **parallel to your current line of work** — the answer is not needed for your
  very next step.

Keep it in the leader when the work is:

- interactive or ambiguous — it needs back-and-forth with the user;
- dependent on secrets or credentials;
- a one-line change or a decision that defines architecture;
- already answered by what you have read.

## The brief in seven parts

The brief is the whole interface. Fill all seven; leave nothing implied.

1. **Goal** — one sentence, one deliverable.
2. **Context** — facts the subagent cannot infer: runtime, versions, the failing
   behavior, the relevant excerpt. Paste the excerpt instead of pointing at a chat.
3. **Paths** — exact absolute or repo-relative files/globs it may read, and any
   file it may write.
4. **Constraints and permissions** — read-only or read-write, no new
   dependencies, no schema changes, what to avoid. State that it runs once with
   no follow-up.
5. **Acceptance criteria** — the pass/fail checks the answer must satisfy.
6. **Output contract** — the exact shape (findings as `file:line` + severity;
   a patch summary; JSON; a table) and a length cap. Ban conversational filler.
7. **Verification** — the command or check the subagent should run before
   answering, and what you will run yourself afterwards.

Start from [prompts/brief.md](prompts/brief.md). Ready-made variants live in
[`prompts/`](prompts/): review, implement, research, debug.

## Template

```markdown
### Task: <imperative title>

#### Goal
<one sentence + one deliverable>

#### Context (you cannot see my chat)
<facts, versions, failing behavior, the relevant excerpt>

#### Files / paths
- Read: <exact paths or globs>
- Write: <exact paths, or "none — report only">

#### Constraints
- Mode: read-only | read-write | test-execution
- Do not: <install dependencies | change public APIs | reformat untouched code | …>
- One run, one task. No follow-up questions.

#### Acceptance criteria
- [ ] <check 1>
- [ ] <check 2>

#### Output format
<exact shape + length cap; no preamble>

#### Verify before answering
<command or check to run, or "spot-check every file:line citation">
```

## Examples

### Review a module

```markdown
### Task: Audit src/cache.ts for correctness bugs

#### Goal
Find correctness and concurrency bugs in the cache layer. Report only; do not edit.

#### Context (you cannot see my chat)
Node 20 service. The cache falls back to Redis during failover; memory grows
under load. Tests pass locally, failures appear only in production.

#### Files / paths
- Read: src/cache.ts, src/types/cache.d.ts
- Write: none

#### Constraints
- Read-only. Do not run the service, install packages, or modify files.
- Ignore style and formatting.

#### Acceptance criteria
- Every finding names the concrete failure scenario and the line.
- No speculation without a code citation.

#### Output format
Markdown table: | Severity | file:line | Finding | Suggested fix |.
Max 15 rows. If clean, print NO_ISSUES_FOUND. No preamble.

#### Verify before answering
Re-read each cited line and confirm the quote matches.
```

### Fix a bug

```markdown
### Task: Fix the unhandled timeout rejection in src/client.ts

#### Goal
Return { success: false, error: "TIMEOUT" } instead of throwing on a slow backend.

#### Context (you cannot see my chat)
When the downstream takes >5s, ApiClient throws an uncaught TimeoutError.
Repro: test/client.test.ts "times out cleanly" (currently failing).

#### Files / paths
- Read/write: src/client.ts, test/client.test.ts
- Do not touch: src/index.ts, package.json

#### Constraints
- No new dependencies. Keep public method signatures unchanged.
- Minimal diff; no unrelated refactoring. One run, one task.

#### Acceptance criteria
- [ ] node --test test/client.test.ts passes
- [ ] No public API change

#### Output format
1 short paragraph, then a unified diff, then the test command output.
No commentary outside those three parts.

#### Verify before answering
Run node --test test/client.test.ts and include the real output.
```

## Anti-patterns

- **Vague asks** — "fix the bug", "clean this up": no target, no failure, no check.
- **Conversational carry-over** — "as we discussed", "continue from earlier": the
  subagent has no memory of it.
- **Multi-task bundling** — review + refactor + tests in one run: split it.
- **Secrets in the brief** — tokens, keys, customer data: never.
- **Unbounded scope** — "look around the repo": name the files.
- **Blind acceptance** — trusting a completion claim without checking the diff,
  the test output, or the citations.
- **Expecting a conversation** — asking an open question and planning to clarify
  in a second turn; that turn does not exist.

## Verify before you trust

1. Check the answer against every acceptance criterion.
2. Re-run the checks yourself; do not trust a reported exit code.
3. Spot-check `file:line` citations and diffs.
4. Reduce the result to a 2-line summary for your own context; drop the raw output.
5. Only then integrate.

## Skills and slash commands

Antigravity picks its own skills and tools from the task text; its catalog
(browser, document, code, and plugin skills) is available to the child. Describe
the capability you want and let it choose — do not name a tool you are guessing
at.

Slash commands (`/browser`, `/model`, `/usage`, …) are interactive CLI commands.
They cannot run inside a one-shot delegation: the CLI answers them outside the
event stream and ends the run. The bridge delivers a task that starts with `/` as
ordinary text, so it will not abort, but it will not execute the command either.
When you need a slash command, run `agy` directly.

## Skills, MCP, and plugins

Antigravity brings its own skill catalog and can call the MCP servers and plugins
installed on the machine (browser, Figma, Google Docs/Slides/Drive, Firebase,
Chrome DevTools, …). The child selects them itself; your job is to make the
capability requirement explicit.

- **Describe the capability, not a guessed tool name.** "Use the browser to open
  …" beats "call browser_navigate".
- **Name a skill/MCP/plugin only when you know it is installed.** Check in your
  own shell with `agy plugin list` and `agy mcp list` before writing the brief;
  otherwise ask the subagent to verify availability.
- **Require an explicit fallback.** "If the Figma MCP is unavailable or
  unauthenticated, stop and report; do not substitute a different source."
- **For capability-dependent tasks, ask for a check first**: "First confirm
  <skill/MCP> is available; if not, report and stop."
- **Bound external access.** Say read-only or read-write; do not ask for writes
  to Figma, Drive, or cloud resources unless the user asked for them.
- **Keep artifacts out of the leader.** Ask for a summary plus paths/URLs of
  screenshots or documents, not raw dumps.
- **Never ask a one-shot run to install or enable** a plugin, skill, or MCP
  server. If something is missing, report it and let the leader handle setup.

## Handling failures

A headless run can fail in a few distinguishable ways; match the fix to the
diagnostic instead of retrying the same brief.

| Diagnostic | Meaning | Leader action |
|---|---|---|
| `category: authentication` | The CLI has no cached login | Sign in once interactively (`agy`), then retry |
| `category: product-error` (model or permission text) | Bad `--model`, or a tool the CLI refused | Fix the model slug; for refusals add a scoped `permissions.allow` rule |
| `category: protocol` or `process` (with exit code) | The CLI died before a result | Retry once; then split the task or check `agy --version` |
| `category: invalid-result` | `SUCCESS` with an empty answer | Tighten the brief or ask for a shorter output |
| `category: cancelled` / `interrupted` | The run was stopped | Re-run only if stopping was not intentional |
| Standalone bridge exit `124` | `--timeout` expired | Split the task or raise `--timeout` |

Headless Antigravity soft-denies tools it cannot ask about: the run may still
succeed with part of the work skipped. When a task needs writes or shell
commands, either pre-allow those tools in the CLI settings or do that step in the
leader. Do not retry a denied task unchanged.

## Token-saving playbook

- **Offload ingestion**: let the subagent read the huge file or log; only its
  summary enters your context.
- **Contract the output**: tables, diffs, JSON, and length caps keep returns small.
- **Batch context once**: a complete first brief avoids a second round.
- **Keep the summary, not the transcript**: store the answer, not the run details.
- **Delegate the second opinion**: ask for a review of a change instead of
  re-reading the whole diff yourself.
- **One task per run**: small scopes produce short answers and fewer retries.

## Prompts library

| File | Use |
|---|---|
| [prompts/brief.md](prompts/brief.md) | Blank six-part template |
| [prompts/review.md](prompts/review.md) | Read-only audit/review |
| [prompts/implement.md](prompts/implement.md) | Scoped fix or feature |
| [prompts/research.md](prompts/research.md) | Web/repo research question |
| [prompts/debug.md](prompts/debug.md) | Reproduction and root cause |

## References

Verified on 2026-10-30:

- [AGENTS.md](https://agents.md) — the open `AGENTS.md` convention for
  agent-facing repository instructions; a good model for a repo brief.
- [openai/swarm](https://github.com/openai/swarm) — stateless agent handoffs and
  single-responsibility routines.
- [github/awesome-copilot](https://github.com/github/awesome-copilot) — community
  instruction and prompt collections to borrow patterns from.
- [Anthropic: subagents in Claude Code](https://platform.claude.com/docs/en/agents-and-tools/claude-code/sub-agents)
  — isolated context windows and distilled summaries from subagents.
- [Anthropic: effective harnesses for long-running agents](https://www.anthropic.com/research/effective-harnesses-for-long-running-agents)
  — fresh-context sessions, incremental progress, and self-verification.
