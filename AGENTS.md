# Agent instructions

This repository lets a coding agent delegate one self-contained task to
**Google Antigravity** and read its final answer. Pick the path that matches your
host.

## 1. Check the CLI first

Run `agy --version`. If it fails, install the Antigravity CLI and make sure it is
on `PATH`. Run `agy` once interactively to sign in; headless runs reuse those
cached credentials.

Do not read, copy, or modify `~/.gemini/antigravity-cli/`. Do not ask the user
for Antigravity API keys.

## 2. If you are not DeepSeek Harness

Use the standalone bridge:

```bash
node scripts/agy-task.mjs "The complete, self-contained task"
```

- The answer is printed on **stdout**; warnings and errors on **stderr**.
- Exit `0` = success, `1` = Antigravity failure or empty answer, `2` = usage
  error, `124` = timeout.
- The task must be self-contained: Antigravity does not see your conversation,
  repository state, or tool results. Include the paths, constraints, and expected
  output format in the task text.
- Useful flags: `--cwd <dir>`, `--model <slug>`, `--effort <level>`,
  `--agent <name>`, `--timeout <seconds>`.

Example:

```bash
node scripts/agy-task.mjs --cwd . --timeout 600 \
  "Review src/cache.ts for correctness bugs. Report findings with file:line; do not edit files."
```

## 3. If you are DeepSeek Harness

Install this clone as a bundle and enable it:

```text
plugin_manager install_bundle <absolute path to this clone>
```

Then call the tool (one task per run; no follow-up messages):

```text
subagent_antigravity({ description: "Review cache layer", prompt: "…" })
```

The call returns a child id immediately; the answer arrives in a completion
notice. The tool is registered only for sessions composed after the bundle is
enabled.

## Rules

- **One task per delegation.** The target does not accept follow-up messages.
- **Do not pass secrets** in the task text; it may reach a third-party model.
- **Review-only means review-only.** Say "report findings; do not edit files" in
  the task when you do not want changes.
- **Never enable bypass permissions** (`--bypass-permissions`, or
  `permissionMode: bypass`) unless the user explicitly asks for it. The default
  honors the Antigravity CLI permission settings.
- **Verify the result** yourself; Antigravity is an independent model and can be
  wrong.

## Tests

```bash
node --test test/wire.test.mjs test/provider.test.mjs test/seam.test.mjs
```

The plugin tests use a fake subprocess and consume no Antigravity quota.
