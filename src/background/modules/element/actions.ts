/**
 * @fileoverview Element action handlers.
 * @module modules/element/actions
 */

// ============================================================================
// Imports
// ============================================================================

import type { RequestContext } from "../../../types/index.js";

import { createLogger } from "../../../core/logger.js";

// ============================================================================
// Types
// ============================================================================

interface GetPropertyParams {
  elementId: string;
  name: string;
}

interface SetPropertyParams {
  elementId: string;
  name: string;
  value: unknown;
}

interface CallMethodParams {
  elementId: string;
  name: string;
  args?: unknown[];
}

interface ContentResponse {
  success: boolean;
  value?: unknown;
  error?: string;
  code?: string;
}

interface ActionResult {
  value?: unknown;
}

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("Element.Actions");

// ============================================================================
// Implementation
// ============================================================================

async function handleGetProperty(
  params: unknown,
  ctx: RequestContext
): Promise<ActionResult> {
  const { elementId, name } = params as GetPropertyParams;

  if (!elementId) {
    throw new Error("elementId is required");
  }
  if (!name) {
    throw new Error("name is required");
  }

  log.debug(
    `getProperty: elementId=${elementId}, name="${name}", tab=${ctx.tabId}`
  );
  const start = Date.now();

  const response = (await browser.tabs.sendMessage(
    ctx.tabId,
    { type: "ELEMENT_ACTION", elementId, action: "getProperty", name },
    { frameId: ctx.frameId }
  )) as ContentResponse;

  if (!response || !response.success) {
    const error = new Error(response?.error || "Failed to get property");
    error.name = response?.code || "script error";
    throw error;
  }

  const elapsed = Date.now() - start;
  log.debug(
    `getProperty: completed in ${elapsed}ms, value type=${typeof response.value}`
  );

  return { value: response.value };
}

async function handleSetProperty(
  params: unknown,
  ctx: RequestContext
): Promise<ActionResult> {
  const { elementId, name, value } = params as SetPropertyParams;

  if (!elementId) {
    throw new Error("elementId is required");
  }
  if (!name) {
    throw new Error("name is required");
  }

  log.debug(
    `setProperty: elementId=${elementId}, name="${name}", tab=${ctx.tabId}`
  );
  const start = Date.now();

  const response = (await browser.tabs.sendMessage(
    ctx.tabId,
    { type: "ELEMENT_ACTION", elementId, action: "setProperty", name, value },
    { frameId: ctx.frameId }
  )) as ContentResponse;

  if (!response.success) {
    const error = new Error(response.error || "Failed to set property");
    error.name = response.code || "script error";
    throw error;
  }

  const elapsed = Date.now() - start;
  log.debug(`setProperty: completed in ${elapsed}ms`);

  return {};
}

async function handleCallMethod(
  params: unknown,
  ctx: RequestContext
): Promise<ActionResult> {
  const { elementId, name, args } = params as CallMethodParams;

  if (!elementId) {
    throw new Error("elementId is required");
  }
  if (!name) {
    throw new Error("name is required");
  }

  log.debug(
    `callMethod: elementId=${elementId}, name="${name}", args=${args?.length ?? 0}, tab=${ctx.tabId}`
  );
  const start = Date.now();

  const response = (await browser.tabs.sendMessage(
    ctx.tabId,
    {
      type: "ELEMENT_ACTION",
      elementId,
      action: "callMethod",
      name,
      args: args ?? [],
    },
    { frameId: ctx.frameId }
  )) as ContentResponse;

  if (!response.success) {
    const error = new Error(response.error || "Failed to call method");
    error.name = response.code || "script error";
    throw error;
  }

  const elapsed = Date.now() - start;
  log.debug(
    `callMethod: completed in ${elapsed}ms, result type=${typeof response.value}`
  );

  return { value: response.value };
}

// ============================================================================
// Exports
// ============================================================================

export { handleGetProperty, handleSetProperty, handleCallMethod };
