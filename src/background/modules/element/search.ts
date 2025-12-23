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
  selector: string;
  parentId?: string;
}

interface FindAllParams {
  selector: string;
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
  const { selector, parentId } = params as FindParams;

  if (!selector) {
    throw new Error("selector is required");
  }

  log.debug(
    `find: selector="${selector}", tab=${ctx.tabId}, frame=${ctx.frameId}`
  );

  const response = (await browser.tabs.sendMessage(
    ctx.tabId,
    { type: "ELEMENT_FIND", selector, parentId },
    { frameId: ctx.frameId }
  )) as ContentResponse;

  if (!response || !response.success) {
    const error = new Error(response?.error || "Element not found");
    error.name = response?.code || "no such element";
    throw error;
  }

  log.debug(`found: elementId=${response.elementId}`);

  return { elementId: response.elementId! };
}

async function handleFindAll(
  params: unknown,
  ctx: RequestContext
): Promise<FindAllResult> {
  const { selector, parentId } = params as FindAllParams;

  if (!selector) {
    throw new Error("selector is required");
  }

  log.debug(
    `findAll: selector="${selector}", tab=${ctx.tabId}, frame=${ctx.frameId}`
  );

  const response = (await browser.tabs.sendMessage(
    ctx.tabId,
    { type: "ELEMENT_FIND_ALL", selector, parentId },
    { frameId: ctx.frameId }
  )) as ContentResponse;

  if (!response.success) {
    const error = new Error(response.error || "Elements not found");
    error.name = response.code || "no such element";
    throw error;
  }

  log.info(`foundAll: count=${response.elementIds?.length ?? 0}`);

  return { elementIds: response.elementIds ?? [] };
}

// ============================================================================
// Exports
// ============================================================================

export { handleFind, handleFindAll };
