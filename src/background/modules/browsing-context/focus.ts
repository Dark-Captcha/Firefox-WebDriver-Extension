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
  log.debug("Focusing tab", { tabId: ctx.tabId });
  await browser.tabs.update(ctx.tabId, { active: true });
  log.info(`Focused tab ${ctx.tabId}`);
}

async function handleFocusWindow(
  _params: unknown,
  ctx: RequestContext
): Promise<void> {
  log.debug("Focusing window for tab", { tabId: ctx.tabId });

  const tab = await browser.tabs.get(ctx.tabId);
  if (tab.windowId === undefined) {
    throw new Error("Tab has no window ID");
  }

  await browser.windows.update(tab.windowId, { focused: true });
  log.info(`Focused window ${tab.windowId} for tab ${ctx.tabId}`);
}

// ============================================================================
// Exports
// ============================================================================

export { handleFocusTab, handleFocusWindow };
