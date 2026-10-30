#!/usr/bin/env node
/**
 * Standalone Antigravity bridge for any coding agent.
 *
 * Sends one self-contained task to the Antigravity CLI (`agy`) in headless
 * mode and prints the agent's final answer on stdout. It uses the CLI's own
 * cached authentication and settings; no API key is read or written.
 *
 * Usage:
 *   node scripts/agy-task.mjs [options] <task text>
 *   node scripts/agy-task.mjs [options] -- <task text with dashes>
 *
 * Options:
 *   --cwd <dir>          Working directory for the run (default: current)
 *   --model <slug>       Pin a model (default: the CLI's setting)
 *   --effort <level>     low | medium | high | xhigh | max
 *   --agent <name>       Antigravity agent to use
 *   --timeout <seconds>  Kill the run after this many seconds (default: none)
 *   --bypass-permissions Auto-approve every tool call (dangerous)
 *   --disable-slash-commands  Turn off Antigravity's native skill/command expansion
 *   --help, -h           Show this help
 *
 * Environment:
 *   AGY_BIN              Explicit path to the `agy` executable
 *
 * Exit codes: 0 success, 1 Antigravity failure or no answer, 2 usage error,
 * 124 timeout.
 */

import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { createInterface } from "node:readline"

const USAGE = `Send one task to Antigravity (agy) and print the answer.

Usage: node scripts/agy-task.mjs [options] <task text>
       node scripts/agy-task.mjs [options] -- <task text>

Options:
  --cwd <dir>          Working directory for the run (default: current)
  --model <slug>       Pin a model (default: the CLI's setting)
  --effort <level>     low | medium | high | xhigh | max
  --agent <name>       Antigravity agent to use
  --timeout <seconds>  Kill the run after this many seconds (default: none)
  --bypass-permissions Auto-approve every tool call (dangerous)
  --disable-slash-commands  Turn off Antigravity's native skill/command expansion
  --help, -h           Show this help`

const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"])

/**
 * @param {string[]} argv - process arguments after the script name.
 * @returns {object} parsed options and the task text.
 */
function parseArgs(argv) {
  const options = { cwd: process.cwd(), task: undefined, timeoutSeconds: 0, bypass: false, disableSlashCommands: false }
  const words = []
  let index = 0
  while (index < argv.length) {
    const arg = argv[index]
    if (arg === "--help" || arg === "-h") {
      console.log(USAGE)
      process.exit(0)
    }
    if (arg === "--") {
      words.push(...argv.slice(index + 1))
      break
    }
    if (arg === "--bypass-permissions") {
      options.bypass = true
      index += 1
      continue
    }
    if (arg === "--disable-slash-commands") {
      options.disableSlashCommands = true
      index += 1
      continue
    }
    if (arg.startsWith("--")) {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith("--")) throw new Error(`missing value for ${arg}`)
      switch (arg) {
        case "--cwd":
          options.cwd = value
          break
        case "--model":
          options.model = value
          break
        case "--effort":
          if (!EFFORTS.has(value)) throw new Error(`--effort must be one of ${[...EFFORTS].join(", ")}`)
          options.effort = value
          break
        case "--agent":
          options.agent = value
          break
        case "--timeout": {
          const seconds = Number(value)
          if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("--timeout must be a positive number of seconds")
          options.timeoutSeconds = seconds
          break
        }
        default:
          throw new Error(`unknown option ${arg}`)
      }
      index += 2
      continue
    }
    words.push(arg)
    index += 1
  }
  const task = words.join(" ").trim()
  if (task.length === 0) throw new Error("the task is empty")
  options.task = task
  return options
}

/**
 * @returns {string[]} known install locations to probe when `agy` is absent.
 */
function candidates() {
  if (process.platform === "win32") {
    const found = []
    if (process.env.LOCALAPPDATA) found.push(join(process.env.LOCALAPPDATA, "agy", "bin", "agy.exe"))
    if (process.env.APPDATA) found.push(join(process.env.APPDATA, "Antigravity", "bin", "agy.exe"))
    return found
  }
  return [join(homedir(), ".local", "bin", "agy"), "/usr/local/bin/agy", "/opt/homebrew/bin/agy"]
}

/**
 * @returns {string} the executable to spawn: explicit path, known location, or PATH name.
 */
function executable() {
  if (process.env.AGY_BIN) return process.env.AGY_BIN
  for (const path of candidates()) {
    if (existsSync(path)) return path
  }
  return "agy"
}

/**
 * @param {object} options - parsed options.
 * @returns {string[]} the CLI argv.
 */
function buildArgv(options) {
  const argv = [
    executable(),
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
  ]
  if (options.disableSlashCommands) argv.push("--disable-slash-commands")
  if (options.model !== undefined) argv.push("--model", options.model)
  if (options.effort !== undefined) argv.push("--effort", options.effort)
  if (options.agent !== undefined) argv.push("--agent", options.agent)
  if (options.bypass) argv.push("--dangerously-skip-permissions")
  return argv
}

/**
 * Run one task and settle the process.
 * @param {object} options - parsed options.
 * @returns {Promise<{code: number}>} the exit code.
 */
async function run(options) {
  const argv = buildArgv(options)
  const child = spawn(argv[0], argv.slice(1), {
    cwd: options.cwd,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  })

  let terminal
  let failure
  const reader = createInterface({ input: child.stdout, crlfDelay: Infinity })
  reader.on("line", (line) => {
    if (line.trim().length === 0) return
    let event
    try {
      event = JSON.parse(line)
    } catch {
      return
    }
    if (event !== null && typeof event === "object" && event.event === "result" && terminal === undefined) {
      terminal = event.result
    }
  })

  child.stderr.setEncoding("utf8")
  child.stderr.on("data", (chunk) => process.stderr.write(chunk))
  child.on("error", (error) => {
    failure = error
  })

  let timer
  if (options.timeoutSeconds > 0) {
    timer = setTimeout(() => {
      failure = new Error(`timed out after ${options.timeoutSeconds}s`)
      child.kill()
    }, options.timeoutSeconds * 1000)
    timer.unref?.()
  }

  const closed = new Promise((resolve) => {
    child.on("close", (code, signal) => resolve({ code, signal }))
  })

  try {
    // A leading "/" is read by the CLI as its own interactive command and ends
    // the run, so deliver such a task as ordinary text.
    const text = options.task.trimStart().startsWith("/") ? `Task:\n${options.task}` : options.task
    child.stdin.write(`${JSON.stringify({
      event: "user",
      message: { content: [{ type: "text", text }] },
    })}\n`)
    child.stdin.end()
  } catch (error) {
    failure = error
    child.kill()
  }

  const outcome = await closed
  if (timer !== undefined) clearTimeout(timer)

  if (failure !== undefined) {
    process.stderr.write(`antigravity: ${failure.message}\n`)
    return { code: failure.message.includes("timed out") ? 124 : 1 }
  }
  if (terminal === undefined) {
    process.stderr.write(`antigravity: the CLI exited (code ${outcome.code}) without a result\n`)
    return { code: 1 }
  }
  const status = typeof terminal.status === "string" ? terminal.status : "unknown"
  const response = typeof terminal.response === "string" ? terminal.response : ""
  if (status === "SUCCESS" && response.trim().length > 0) {
    process.stdout.write(response.endsWith("\n") ? response : `${response}\n`)
    return { code: 0 }
  }
  const detail = typeof terminal.error === "string" && terminal.error.length > 0 ? `: ${terminal.error}` : ""
  process.stderr.write(`antigravity: run finished with status ${status}${detail}\n`)
  return { code: 1 }
}

try {
  const options = parseArgs(process.argv.slice(2))
  const { code } = await run(options)
  process.exit(code)
} catch (error) {
  process.stderr.write(`antigravity: ${error instanceof Error ? error.message : String(error)}\n\n${USAGE}\n`)
  process.exit(2)
}
