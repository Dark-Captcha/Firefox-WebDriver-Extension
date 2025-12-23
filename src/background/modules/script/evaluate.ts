/**
 * @fileoverview Script evaluation handlers.
 * @module modules/script/evaluate
 */

// ============================================================================
// Imports
// ============================================================================

import type { RequestContext } from "../../../types/index.js";

import { createLogger } from "../../../core/logger.js";

// ============================================================================
// Types
// ============================================================================

interface EvaluateParams {
  script: string;
  args?: unknown[];
}

interface EvaluateResult {
  value: unknown;
}

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("Script.Evaluate");

// ============================================================================
// Implementation
// ============================================================================

async function handleEvaluate(
  params: unknown,
  ctx: RequestContext
): Promise<EvaluateResult> {
  const { script, args = [] } = params as EvaluateParams;

  if (!script) {
    throw new Error("Script is required");
  }

  log.debug("Executing script", {
    tabId: ctx.tabId,
    frameId: ctx.frameId,
    scriptLength: script.length,
    argsCount: args.length,
  });

  const results = await browser.scripting.executeScript({
    target: { tabId: ctx.tabId, frameIds: [ctx.frameId] },
    func: (code: string, scriptArgs: unknown[]) => {
      const fn = new Function("...args", code);
      return fn(...scriptArgs);
    },
    args: [script, args],
    world: "MAIN",
  });

  const result = results[0];
  if (!result) {
    throw new Error("Script execution failed: no result");
  }

  if ("error" in result) {
    const error = result.error as { message?: string };
    throw new Error(`Script error: ${error.message || "Unknown error"}`);
  }

  log.debug("Script executed successfully", { tabId: ctx.tabId });

  return { value: result.result };
}

async function handleEvaluateAsync(
  params: unknown,
  ctx: RequestContext
): Promise<EvaluateResult> {
  const { script, args = [] } = params as EvaluateParams;

  if (!script) {
    throw new Error("Script is required");
  }

  log.debug("Executing async script", {
    tabId: ctx.tabId,
    frameId: ctx.frameId,
    scriptLength: script.length,
    argsCount: args.length,
  });

  const results = await browser.scripting.executeScript({
    target: { tabId: ctx.tabId, frameIds: [ctx.frameId] },
    func: (async (code: string, scriptArgs: unknown[]) => {
      const fn = new Function("...args", `return (async () => { ${code} })()`);
      return await fn(...scriptArgs);
    }) as (code: string, scriptArgs: unknown[]) => void,
    args: [script, args],
    world: "MAIN",
  });

  const result = results[0];
  if (!result) {
    throw new Error("Async script execution failed: no result");
  }

  if ("error" in result) {
    const error = result.error as { message?: string };
    throw new Error(`Script error: ${error.message || "Unknown error"}`);
  }

  log.debug("Async script executed successfully", { tabId: ctx.tabId });

  return { value: result.result };
}

// ============================================================================
// Exports
// ============================================================================

export { handleEvaluate, handleEvaluateAsync };
