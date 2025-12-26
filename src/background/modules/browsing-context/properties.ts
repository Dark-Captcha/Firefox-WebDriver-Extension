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
  log.debug(`getTitle: tab=${ctx.tabId}, frame=${ctx.frameId}`);
  const start = Date.now();

  if (ctx.frameId === MAIN_FRAME_ID) {
    const tab = await browser.tabs.get(ctx.tabId);
    const title = tab.title || "";
    const elapsed = Date.now() - start;
    log.debug(
      `getTitle: completed in ${elapsed}ms, title="${title.substring(0, 50)}${title.length > 50 ? "..." : ""}"`
    );
    return { title };
  }

  const result = await handleEvaluate({ script: "return document.title" }, ctx);
  const title = (result.value as string) || "";
  const elapsed = Date.now() - start;
  log.debug(
    `getTitle: completed in ${elapsed}ms (iframe), title="${title.substring(0, 50)}${title.length > 50 ? "..." : ""}"`
  );
  return { title };
}

async function handleGetUrl(
  _params: unknown,
  ctx: RequestContext
): Promise<GetUrlResult> {
  log.debug(`getUrl: tab=${ctx.tabId}, frame=${ctx.frameId}`);
  const start = Date.now();

  if (ctx.frameId === MAIN_FRAME_ID) {
    const tab = await browser.tabs.get(ctx.tabId);
    const url = tab.url || "";
    const elapsed = Date.now() - start;
    log.debug(`getUrl: completed in ${elapsed}ms, url=${url}`);
    return { url };
  }

  const result = await handleEvaluate(
    { script: "return window.location.href" },
    ctx
  );
  const url = (result.value as string) || "";
  const elapsed = Date.now() - start;
  log.debug(`getUrl: completed in ${elapsed}ms (iframe), url=${url}`);
  return { url };
}

// ============================================================================
// Exports
// ============================================================================

export { handleGetTitle, handleGetUrl };
