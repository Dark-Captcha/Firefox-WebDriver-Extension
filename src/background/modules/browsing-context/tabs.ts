/**
 * @fileoverview Tab management handlers for browsingContext module.
 * @module modules/browsingContext/tabs
 */

// ============================================================================
// Imports
// ============================================================================

import type { RequestContext } from "../../../types/index.js";
import type { TabId } from "../../../types/identifiers.js";

import { createTabId } from "../../../types/identifiers.js";
import { createLogger } from "../../../core/logger.js";

// ============================================================================
// Types
// ============================================================================

interface NewTabParams {
  url?: string;
}

interface NewTabResult {
  tabId: TabId;
  url: string;
}

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("BrowsingContext.Tabs");

// ============================================================================
// Implementation
// ============================================================================

async function handleNewTab(
  params: unknown,
  _ctx: RequestContext
): Promise<NewTabResult> {
  const { url } = (params as NewTabParams) || {};

  log.debug("Creating new tab", { url });

  const createProps: browser.tabs._CreateCreateProperties = {};
  if (url) {
    createProps.url = url;
  }

  const tab = await browser.tabs.create(createProps);

  if (tab.id === undefined) {
    throw new Error("Failed to create tab: no ID returned");
  }

  const tabId = createTabId(tab.id);
  const tabUrl = tab.url || "about:blank";

  log.info(`Created new tab ${tabId}`, { url: tabUrl });

  return { tabId, url: tabUrl };
}

async function handleCloseTab(
  _params: unknown,
  ctx: RequestContext
): Promise<void> {
  log.debug("Closing tab", { tabId: ctx.tabId });
  await browser.tabs.remove(ctx.tabId);
  log.info(`Closed tab ${ctx.tabId}`);
}

// ============================================================================
// Exports
// ============================================================================

export { handleNewTab, handleCloseTab };
