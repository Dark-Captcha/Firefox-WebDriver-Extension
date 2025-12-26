/**
 * @fileoverview Focus handlers for browsingContext module.
 * @module modules/browsingContext/focus
 */

// ============================================================================
// Imports
// ============================================================================

import type { RequestContext } from "../../../types/index.js";

import { createLogger } from "../../../core/logger.js";

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("BrowsingContext.Focus");

// ============================================================================
// Implementation
// ============================================================================

async function handleFocusTab(
  _params: unknown,
  ctx: RequestContext
): Promise<void> {
  log.debug(`focusTab: tab=${ctx.tabId}`);
  const start = Date.now();

  await browser.tabs.update(ctx.tabId, { active: true });

  const elapsed = Date.now() - start;
  log.debug(`focusTab: completed in ${elapsed}ms`);
}

async function handleFocusWindow(
  _params: unknown,
  ctx: RequestContext
): Promise<void> {
  log.debug(`focusWindow: tab=${ctx.tabId}`);
  const start = Date.now();

  const tab = await browser.tabs.get(ctx.tabId);
  if (tab.windowId === undefined) {
    throw new Error("Tab has no window ID");
  }

  await browser.windows.update(tab.windowId, { focused: true });

  const elapsed = Date.now() - start;
  log.debug(`focusWindow: completed in ${elapsed}ms, windowId=${tab.windowId}`);
}

// ============================================================================
// Exports
// ============================================================================

export { handleFocusTab, handleFocusWindow };
