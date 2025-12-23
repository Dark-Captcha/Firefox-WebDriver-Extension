/**
 * @fileoverview Property handlers for browsingContext module.
 * @module modules/browsingContext/properties
 */

// ============================================================================
// Imports
// ============================================================================

import type { RequestContext } from "../../../types/index.js";

import { MAIN_FRAME_ID } from "../../../types/identifiers.js";
import { createLogger } from "../../../core/logger.js";
import { handleEvaluate } from "../script/evaluate.js";

// ============================================================================
// Types
// ============================================================================

interface GetTitleResult {
  title: string;
}

interface GetUrlResult {
  url: string;
}

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("BrowsingContext.Properties");

// ============================================================================
// Implementation
// ============================================================================

async function handleGetTitle(
  _params: unknown,
  ctx: RequestContext
): Promise<GetTitleResult> {
  log.debug("Getting page title", { tabId: ctx.tabId, frameId: ctx.frameId });

  if (ctx.frameId === MAIN_FRAME_ID) {
    const tab = await browser.tabs.get(ctx.tabId);
    const title = tab.title || "";
    log.debug(`Got title: ${title}`, { tabId: ctx.tabId });
    return { title };
  }

  const result = await handleEvaluate({ script: "return document.title" }, ctx);
  const title = (result.value as string) || "";
  log.debug(`Got iframe title: ${title}`, {
    tabId: ctx.tabId,
    frameId: ctx.frameId,
  });
  return { title };
}

async function handleGetUrl(
  _params: unknown,
  ctx: RequestContext
): Promise<GetUrlResult> {
  log.debug("Getting page URL", { tabId: ctx.tabId, frameId: ctx.frameId });

  if (ctx.frameId === MAIN_FRAME_ID) {
    const tab = await browser.tabs.get(ctx.tabId);
    const url = tab.url || "";
    log.debug(`Got URL: ${url}`, { tabId: ctx.tabId });
    return { url };
  }

  const result = await handleEvaluate(
    { script: "return window.location.href" },
    ctx
  );
  const url = (result.value as string) || "";
  log.debug(`Got iframe URL: ${url}`, {
    tabId: ctx.tabId,
    frameId: ctx.frameId,
  });
  return { url };
}

// ============================================================================
// Exports
// ============================================================================

export { handleGetTitle, handleGetUrl };
