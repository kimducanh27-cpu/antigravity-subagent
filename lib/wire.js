/**
 * Antigravity CLI headless NDJSON adapter.
 *
 * The CLI prints one JSON object per line: an `init` event, any number of
 * `step_update` events, and one terminal `result` event. This module owns
 * event accumulation and the mapping from that envelope to the shared
 * subagent result vocabulary; the process, cancellation, and teardown
 * machinery live in `index.js`.
 *
 * @module dsh-subagent-antigravity/wire
 */

/** Ignore a single absurdly long line rather than buffering unbounded text. */
const MAX_LINE_CHARS = 8 * 1024 * 1024

/** Longest provider-authored message kept in a safe diagnostic. */
const MAX_MESSAGE_CHARS = 512

/**
 * Collapse a possibly multi-line provider message into one bounded line so a
 * diagnostic stays free of raw protocol payloads.
 * @param value - message text from the CLI or an internal error.
 * @returns a single sanitized line.
 */
function oneLine(value) {
  const text = String(value)
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return text.length > MAX_MESSAGE_CHARS ? `${text.slice(0, MAX_MESSAGE_CHARS - 1)}…` : text
}

/**
 * Build the fixed, safe failure fact line shared by terminal and
 * infrastructure failures.
 * @param facts - failure stage, category, optional process outcome, and message.
 * @returns provider-authored diagnostic text.
 */
export function antigravityDiagnostic(facts) {
  const fields = ["product: Antigravity", `stage: ${facts.stage}`, `category: ${facts.category}`]
  if (typeof facts.conversationId === "string" && facts.conversationId.length > 0) {
    fields.push(`conversation: ${oneLine(facts.conversationId)}`)
  }
  if (typeof facts.permissionMode === "string" && facts.permissionMode.length > 0) {
    fields.push(`permission mode: ${oneLine(facts.permissionMode)}`)
  }
  const outcome = facts.outcome
  if (outcome !== undefined && outcome !== null) {
    if (outcome.exitCode !== null && outcome.exitCode !== undefined) fields.push(`exit code: ${outcome.exitCode}`)
    if (outcome.signal !== null && outcome.signal !== undefined) fields.push(`signal: ${outcome.signal}`)
  }
  const message = facts.message === undefined ? undefined : oneLine(facts.message)
  const suffix = message === undefined || message.length === 0 ? "" : `; message: ${message}`
  return `Product subagent failure (${fields.join("; ")}${suffix})`
}

/**
 * Accumulate one Antigravity headless event stream.
 * @param onTerminal - called once when the terminal `result` envelope arrives.
 * @returns the accumulator; `push()` accepts one stdout line at a time.
 */
export function createAntigravityEvents(onTerminal) {
  const events = {
    /** Conversation id reported by the CLI, for diagnostics only. */
    conversationId: undefined,
    /** Effective permission mode reported by the CLI, for diagnostics only. */
    permissionMode: undefined,
    /** Terminal `result` envelope once observed. */
    terminal: undefined,
    /** Concatenated agent-response text, used as partial output on failure. */
    streamText: "",
    /** Lines that were valid JSON but not events this adapter consumes. */
    ignored: 0,
    /** Lines that were not parseable JSON objects. */
    malformed: 0,
    /**
     * Consume one stdout line.
     * @param line - one line without its terminator.
     */
    push(line) {
      if (typeof line !== "string" || line.trim().length === 0) return
      if (line.length > MAX_LINE_CHARS) {
        events.ignored += 1
        return
      }
      let parsed
      try {
        parsed = JSON.parse(line)
      } catch {
        events.malformed += 1
        return
      }
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        events.malformed += 1
        return
      }
      if (events.conversationId === undefined && typeof parsed.conversation_id === "string") {
        events.conversationId = parsed.conversation_id
      }
      switch (parsed.event) {
        case "init": {
          const init = parsed.init
          if (init !== null && typeof init === "object" && !Array.isArray(init)) {
            if (typeof init.permission_mode === "string") events.permissionMode = init.permission_mode
            if (events.conversationId === undefined && typeof init.conversation_id === "string") {
              events.conversationId = init.conversation_id
            }
          }
          return
        }
        case "step_update": {
          const step = parsed.step_update
          if (step === null || typeof step !== "object" || Array.isArray(step)) return
          if (step.step_type === "agent_response" && typeof step.text_delta === "string") {
            events.streamText += step.text_delta
          }
          return
        }
        case "result": {
          const result = parsed.result
          if (result === null || typeof result !== "object" || Array.isArray(result)) {
            events.malformed += 1
            return
          }
          if (events.terminal !== undefined) return
          events.terminal = result
          if (events.conversationId === undefined && typeof result.conversation_id === "string") {
            events.conversationId = result.conversation_id
          }
          onTerminal?.(result)
          return
        }
        default:
          events.ignored += 1
      }
    },
    /**
     * Select the best text observed so far: the terminal response when it is
     * non-empty, otherwise accumulated stream text.
     * @returns the text block sequence, or an empty array.
     */
    output() {
      const terminalText = typeof events.terminal?.response === "string" ? events.terminal.response : ""
      const text = terminalText.trim().length > 0 ? terminalText : events.streamText
      return text.trim().length > 0 ? [{ type: "text", text }] : []
    },
  }
  return events
}

/**
 * Map one completed event stream onto the shared subagent result.
 *
 * `SUCCESS` yields the CLI's exact response bytes, an empty success is a
 * provider failure, and every other terminal status (or a stream that ends
 * without one) becomes an errored result with a safe diagnostic.
 *
 * @param events - accumulator filled while the child ran.
 * @param options - local cancellation state and process exit facts.
 * @returns the terminal subagent result; never throws.
 */
export function mapAntigravityResult(events, options) {
  const output = events.output()
  if (options.cancelled) return { output, stopReason: "aborted" }

  const base = {
    outcome: options.outcome,
    conversationId: events.conversationId,
    permissionMode: events.permissionMode,
  }
  const terminal = events.terminal
  if (terminal === undefined) {
    return {
      output,
      stopReason: "error",
      diagnostic: antigravityDiagnostic({
        stage: "protocol",
        category: "protocol",
        ...base,
        message: "Antigravity CLI ended without a result",
      }),
    }
  }

  const status = typeof terminal.status === "string" ? terminal.status : "unknown"
  if (status === "SUCCESS") {
    const response = typeof terminal.response === "string" ? terminal.response : ""
    if (response.trim().length > 0) {
      return { output: [{ type: "text", text: response }], stopReason: "completed" }
    }
    return {
      output,
      stopReason: "error",
      diagnostic: antigravityDiagnostic({
        stage: "run",
        category: "invalid-result",
        ...base,
        message: "Antigravity completed without an answer",
      }),
    }
  }

  if (status === "ERROR") {
    const raw = typeof terminal.error === "string" ? terminal.error : ""
    if (/authenticat|sign[ -]?in|log[ -]?in required/i.test(raw)) {
      return {
        output,
        stopReason: "error",
        diagnostic: antigravityDiagnostic({
          stage: "run",
          category: "authentication",
          ...base,
          message: "Antigravity is not authenticated; run `agy` once interactively to sign in",
        }),
      }
    }
    return {
      output,
      stopReason: "error",
      diagnostic: antigravityDiagnostic({
        stage: "run",
        category: "product-error",
        ...base,
        message: raw.length > 0 ? raw : "Antigravity reported an error",
      }),
    }
  }

  if (status === "CANCELED" || status === "INTERRUPTED") {
    return {
      output,
      stopReason: "error",
      diagnostic: antigravityDiagnostic({
        stage: "run",
        category: status === "CANCELED" ? "cancelled" : "interrupted",
        ...base,
        message: `Antigravity reported ${status}`,
      }),
    }
  }

  if (status === "WAITING") {
    return {
      output,
      stopReason: "error",
      diagnostic: antigravityDiagnostic({
        stage: "run",
        category: "input-required",
        ...base,
        message: "Antigravity ended while waiting on input",
      }),
    }
  }

  return {
    output,
    stopReason: "error",
    diagnostic: antigravityDiagnostic({
      stage: "run",
      category: "non-terminal",
      outcome: options.outcome,
      message: `Antigravity ended with status ${status}`,
    }),
  }
}
