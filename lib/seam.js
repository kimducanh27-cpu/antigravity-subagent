/**
 * Local copy of the provider-side out-of-process contract helpers.
 *
 * A profile bundle linked from a workspace directory is resolved by Node from
 * that directory, so the Harness installation's own `@deepseek-ai/dsh-subagent`
 * package is not on its import path. These helpers are small, stable, and
 * reproduced here from the runtime's published `0.2.1-rc.5` implementation so
 * the bundle is self-contained; substitute the package import if a future
 * runtime exposes it to linked bundles.
 *
 * @module dsh-subagent-antigravity/seam
 */

import { accessSync, constants, statSync } from "node:fs"
import { isAbsolute } from "node:path"

/** Maximum UTF-8 size of a subagent diagnostic. */
const MAX_DIAGNOSTIC_BYTES = 4096
const TRUNCATION_SUFFIX = "\n[diagnostic truncated]"
const encoder = new TextEncoder()
const decoder = new TextDecoder()

/**
 * @param diagnostic - provider-authored failure text.
 * @returns the text, visibly truncated when it exceeds the byte limit.
 */
function limitDiagnostic(diagnostic) {
  const bytes = encoder.encode(diagnostic)
  if (bytes.byteLength <= MAX_DIAGNOSTIC_BYTES) return diagnostic
  const suffixBytes = encoder.encode(TRUNCATION_SUFFIX).byteLength
  let prefixBytes = MAX_DIAGNOSTIC_BYTES - suffixBytes
  while ((bytes[prefixBytes] & 0b1100_0000) === 0b1000_0000) prefixBytes -= 1
  return decoder.decode(bytes.subarray(0, prefixBytes)) + TRUNCATION_SUFFIX
}

/**
 * @param result - terminal result produced by the provider.
 * @returns the result with its diagnostic within the byte limit.
 */
function normalizeResult(result) {
  return result.diagnostic === undefined ? result : { ...result, diagnostic: limitDiagnostic(result.diagnostic) }
}

/** The capability advertisement of an out-of-process backend: none. */
export const NO_START_CAPABILITIES = Object.freeze({
  agentOptions: false,
  agentPreset: false,
  outputSchema: false,
  depthLimit: false,
})

/**
 * Assert a configured timing bound is a positive finite number.
 * @param prefix - diagnostic prefix.
 * @param name - config field name.
 * @param value - configured value.
 */
export function assertPositiveFinite(prefix, name, value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${prefix}: ${name} must be a positive finite number`)
  }
}

/**
 * @param path - candidate directory.
 * @returns whether it is a directory this process can enter.
 */
function isEnterableDirectory(path) {
  try {
    if (!statSync(path).isDirectory()) return false
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Assert `cwd` can host the child: absolute and an accessible directory.
 * @param prefix - diagnostic prefix.
 * @param label - value source for the diagnostic.
 * @param cwd - candidate working directory.
 * @returns the validated directory.
 */
export function assertUsableCwd(prefix, label, cwd) {
  if (typeof cwd !== "string" || !isAbsolute(cwd)) {
    throw new Error(`${prefix}: ${label} must be an absolute path: ${cwd}`)
  }
  if (!isEnterableDirectory(cwd)) {
    throw new Error(`${prefix}: ${label} is not an accessible directory: ${cwd}`)
  }
  return cwd
}

/**
 * @param value - unknown thrown value.
 * @returns an Error preserving the original when possible.
 */
function toError(value) {
  return value instanceof Error ? value : new Error(String(value))
}

/**
 * Settle an out-of-process run result under the seam contract: after the run is
 * published, `result` never rejects. Local cancellation resolves as `aborted`.
 * @param parts - the attempt, output snapshots, cancellation state, and signal wiring.
 * @returns the terminal subagent result.
 */
export async function settleRunResult(parts) {
  try {
    const result = await parts.attempt()
    return parts.cancelled() ? { output: parts.collectOutput(), stopReason: "aborted" } : normalizeResult(result)
  } catch (error) {
    if (parts.cancelled()) return { output: parts.collectOutput(), stopReason: "aborted" }
    try {
      parts.onError?.(toError(error), "error")
    } catch {}
    const collected = parts.collectDiagnostic?.()
    const diagnostic = collected === undefined ? undefined : limitDiagnostic(collected)
    return {
      output: parts.collectOutput(),
      ...(diagnostic === undefined ? {} : { diagnostic }),
      stopReason: "error",
    }
  } finally {
    parts.signal.removeEventListener("abort", parts.onAbort)
  }
}

/**
 * Publish a run handle whose `dispose()` is idempotent: it settles local
 * cancellation, then awaits the backend teardown to quiescence.
 * @param parts - run id, settled result, cancellation wiring, and teardown.
 * @returns the external run handle.
 */
export function subprocessRunHandle(parts) {
  let disposal
  return {
    id: parts.id,
    result: parts.result,
    dispose() {
      if (disposal !== undefined) return disposal
      parts.signal.removeEventListener("abort", parts.onAbort)
      parts.requestCancel()
      disposal = parts.teardown()
      return disposal
    },
  }
}
