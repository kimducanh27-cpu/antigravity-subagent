import assert from "node:assert/strict"
import test from "node:test"
import { antigravityDiagnostic, createAntigravityEvents, mapAntigravityResult } from "../lib/wire.js"

/**
 * @param {...object} events - event envelopes to encode.
 * @returns {string[]} one NDJSON line per event.
 */
function lines(...events) {
  return events.map((event) => JSON.stringify(event))
}

test("consumes init, agent text, and a terminal result", () => {
  const events = createAntigravityEvents()
  for (const line of lines(
    { event: "init", conversation_id: "c1", init: { permission_mode: "always-proceed" } },
    { event: "step_update", step_update: { step_type: "user_input", state: "DONE" } },
    { event: "step_update", step_update: { step_type: "agent_response", state: "ACTIVE", text_delta: "anti" } },
    { event: "step_update", step_update: { step_type: "agent_response", state: "DONE", text_delta: "gravity\n" } },
    { event: "result", result: { conversation_id: "c1", status: "SUCCESS", response: "antigravity\n" } },
  )) {
    events.push(line)
  }
  assert.equal(events.conversationId, "c1")
  assert.equal(events.permissionMode, "always-proceed")
  assert.deepEqual(mapAntigravityResult(events, { cancelled: false, outcome: { exitCode: 0, signal: null } }), {
    output: [{ type: "text", text: "antigravity\n" }],
    stopReason: "completed",
  })
})

test("maps an ERROR envelope to a safe product-error diagnostic", () => {
  const events = createAntigravityEvents()
  events.push(JSON.stringify({ event: "init", conversation_id: "c-error", init: { permission_mode: "request-review" } }))
  events.push(JSON.stringify({
    event: "result",
    result: { status: "ERROR", response: "", error: "invalid model selection (--model \"nope\")\nAvailable models:\n  A" },
  }))
  const result = mapAntigravityResult(events, { cancelled: false, outcome: { exitCode: 1, signal: null } })
  assert.equal(result.stopReason, "error")
  assert.match(result.diagnostic, /product: Antigravity; stage: run; category: product-error/)
  assert.match(result.diagnostic, /conversation: c-error/)
  assert.match(result.diagnostic, /permission mode: request-review/)
  assert.match(result.diagnostic, /exit code: 1/)
  assert.doesNotMatch(result.diagnostic, /\n/)
  assert.match(result.diagnostic, /invalid model selection/)
})

test("maps an unauthenticated run to its own category", () => {
  const events = createAntigravityEvents()
  events.push(JSON.stringify({ event: "result", result: { status: "ERROR", error: "authentication required; run agy to sign in" } }))
  const result = mapAntigravityResult(events, { cancelled: false, outcome: undefined })
  assert.equal(result.stopReason, "error")
  assert.match(result.diagnostic, /category: authentication/)
  assert.match(result.diagnostic, /not authenticated/)
})

test("rejects an empty successful answer as a provider failure", () => {
  const events = createAntigravityEvents()
  events.push(JSON.stringify({ event: "result", result: { status: "SUCCESS", response: "  \n" } }))
  const result = mapAntigravityResult(events, { cancelled: false, outcome: undefined })
  assert.equal(result.stopReason, "error")
  assert.match(result.diagnostic, /category: invalid-result/)
})

test("treats a stream without a result as a protocol failure", () => {
  const events = createAntigravityEvents()
  events.push(JSON.stringify({ event: "step_update", step_update: { step_type: "agent_response", text_delta: "partial" } }))
  const result = mapAntigravityResult(events, { cancelled: false, outcome: { exitCode: 0, signal: null } })
  assert.deepEqual(result.output, [{ type: "text", text: "partial" }])
  assert.equal(result.stopReason, "error")
  assert.match(result.diagnostic, /category: protocol/)
})

test("local cancellation wins over a later error envelope", () => {
  const events = createAntigravityEvents()
  events.push(JSON.stringify({ event: "result", result: { status: "ERROR", error: "killed" } }))
  assert.deepEqual(mapAntigravityResult(events, { cancelled: true, outcome: undefined }), {
    output: [],
    stopReason: "aborted",
  })
})

test("reports input-required and non-terminal statuses", () => {
  const waiting = createAntigravityEvents()
  waiting.push(JSON.stringify({ event: "result", result: { status: "WAITING", response: "need input" } }))
  assert.match(mapAntigravityResult(waiting, { cancelled: false, outcome: undefined }).diagnostic, /category: input-required/)

  const running = createAntigravityEvents()
  running.push(JSON.stringify({ event: "result", result: { status: "RUNNING" } }))
  assert.match(mapAntigravityResult(running, { cancelled: false, outcome: undefined }).diagnostic, /category: non-terminal/)
})

test("ignores malformed and unknown lines without losing the result", () => {
  const events = createAntigravityEvents()
  events.push("not json")
  events.push("null")
  events.push(JSON.stringify({ event: "future_thing", payload: 1 }))
  events.push(JSON.stringify({ event: "result", result: { status: "SUCCESS", response: "ok" } }))
  assert.equal(events.malformed, 2)
  assert.equal(events.ignored, 1)
  assert.equal(mapAntigravityResult(events, { cancelled: false, outcome: undefined }).stopReason, "completed")
})

test("sanitizes multi-line messages into one bounded line", () => {
  const text = antigravityDiagnostic({
    stage: "run",
    category: "product-error",
    message: `line one\nline two\t${"x".repeat(2000)}`,
  })
  assert.doesNotMatch(text, /\n/)
  assert.ok(text.length < 700)
})
