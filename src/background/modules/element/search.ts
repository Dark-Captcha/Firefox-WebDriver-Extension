/**
 * @fileoverview Element search handlers.
 * @module modules/element/search
 */

// ============================================================================
// Imports
// ============================================================================

import type { RequestContext } from "../../../types/index.js";

import { createLogger } from "../../../core/logger.js";

// ============================================================================
// Types
// ============================================================================

interface FindParams {
  strategy: string;
  value: string;
  parentId?: string;
}

interface FindAllParams {
  strategy: string;
  value: string;
  parentId?: string;
}

interface ContentResponse {
  success: boolean;
  elementId?: string;
  elementIds?: string[];
  error?: string;
  code?: string;
}

interface FindResult {
  elementId: string;
}

interface FindAllResult {
  elementIds: string[];
}

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("Element.Search");

// ============================================================================
// Implementation
// ============================================================================

async function handleFind(
  params: unknown,
  ctx: RequestContext
): Promise<FindResult> {
  const { strategy, value, parentId } = params as FindParams;

  if (!strategy) {
    throw new Error("strategy is required");
  }
  if (!value) {
    throw new Error("value is required");
  }

  log.debug(
    `find: strategy="${strategy}", value="${value}", parentId=${parentId ?? "none"}, tab=${ctx.tabId}, frame=${ctx.frameId}`
  );
  const start = Date.now();

  const response = (await browser.tabs.sendMessage(
    ctx.tabId,
    { type: "ELEMENT_FIND", strategy, value, parentId },
    { frameId: ctx.frameId }
  )) as ContentResponse;

  if (!response || !response.success) {
    const error = new Error(response?.error || "Element not found");
    error.name = response?.code || "no such element";
    throw error;
  }

  const elapsed = Date.now() - start;
  log.debug(`find: completed in ${elapsed}ms, elementId=${response.elementId}`);

  return { elementId: response.elementId! };
}

async function handleFindAll(
  params: unknown,
  ctx: RequestContext
): Promise<FindAllResult> {
  const { strategy, value, parentId } = params as FindAllParams;

  if (!strategy) {
    throw new Error("strategy is required");
  }
  if (!value) {
    throw new Error("value is required");
  }

  log.debug(
    `findAll: strategy="${strategy}", value="${value}", parentId=${parentId ?? "none"}, tab=${ctx.tabId}, frame=${ctx.frameId}`
  );
  const start = Date.now();

  const response = (await browser.tabs.sendMessage(
    ctx.tabId,
    { type: "ELEMENT_FIND_ALL", strategy, value, parentId },
    { frameId: ctx.frameId }
  )) as ContentResponse;

  if (!response.success) {
    const error = new Error(response.error || "Elements not found");
    error.name = response.code || "no such element";
    throw error;
  }

  const elapsed = Date.now() - start;
  log.debug(
    `findAll: completed in ${elapsed}ms, count=${response.elementIds?.length ?? 0}`
  );

  return { elementIds: response.elementIds ?? [] };
}

// ============================================================================
// Exports
// ============================================================================

export { handleFind, handleFindAll };
