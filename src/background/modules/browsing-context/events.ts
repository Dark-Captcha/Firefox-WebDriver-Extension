/**
 * @fileoverview BrowsingContext navigation events.
 * @module modules/browsingContext/events
 */

// ============================================================================
// Imports
// ============================================================================

import { session } from "../../../core/session.js";
import { createLogger } from "../../../core/logger.js";

// ============================================================================
// Types
// ============================================================================

interface NavigationState {
  url: string;
  startTime: number;
}

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("BrowsingContext.Events");

// ============================================================================
// State
// ============================================================================

const navigationStates = new Map<number, NavigationState>();

// ============================================================================
// Implementation
// ============================================================================

function handleBeforeNavigate(
  details: browser.webNavigation._OnBeforeNavigateDetails
): void {
  if (details.frameId !== 0) return;

  const tabId = details.tabId;
  const url = details.url;

  if (url.startsWith("about:") || url.startsWith("moz-extension:")) {
    return;
  }

  log.debug(`navigationStarted: tab=${tabId}, url=${url}`);

  navigationStates.set(tabId, { url, startTime: Date.now() });

  if (session.isConnected()) {
    session.sendEvent("browsingContext.navigationStarted", {
      tabId,
      url,
      frameId: details.frameId,
      timestamp: Date.now(),
    });
  }
}

function handleDOMContentLoaded(
  details: browser.webNavigation._OnDOMContentLoadedDetails
): void {
  if (details.frameId !== 0) return;

  const tabId = details.tabId;
  const url = details.url;

  if (url.startsWith("about:") || url.startsWith("moz-extension:")) {
    return;
  }

  log.debug(`domContentLoaded: tab=${tabId}, url=${url}`);

  if (session.isConnected()) {
    session.sendEvent("browsingContext.domContentLoaded", {
      tabId,
      url,
      frameId: details.frameId,
      timestamp: Date.now(),
    });
  }
}

function handleCompleted(
  details: browser.webNavigation._OnCompletedDetails
): void {
  if (details.frameId !== 0) return;

  const tabId = details.tabId;
  const url = details.url;

  if (url.startsWith("about:") || url.startsWith("moz-extension:")) {
    return;
  }

  log.debug(`load: tab=${tabId}, url=${url}`);

  const navState = navigationStates.get(tabId);
  const loadTime = navState ? Date.now() - navState.startTime : undefined;

  navigationStates.delete(tabId);

  if (session.isConnected()) {
    session.sendEvent("browsingContext.load", {
      tabId,
      url,
      frameId: details.frameId,
      timestamp: Date.now(),
      loadTime,
    });
  }
}

function handleErrorOccurred(
  details: browser.webNavigation._OnErrorOccurredDetails
): void {
  if (details.frameId !== 0) return;

  const tabId = details.tabId;
  const url = details.url;
  const error = details.error;

  if (url.startsWith("about:") || url.startsWith("moz-extension:")) {
    return;
  }

  log.debug(`navigationFailed: tab=${tabId}, url=${url}, error=${error}`);

  navigationStates.delete(tabId);

  if (session.isConnected()) {
    session.sendEvent("browsingContext.navigationFailed", {
      tabId,
      url,
      frameId: details.frameId,
      error,
      timestamp: Date.now(),
    });
  }
}

function initBrowsingContextEvents(): void {
  browser.webNavigation.onBeforeNavigate.addListener(handleBeforeNavigate);
  browser.webNavigation.onDOMContentLoaded.addListener(handleDOMContentLoaded);
  browser.webNavigation.onCompleted.addListener(handleCompleted);
  browser.webNavigation.onErrorOccurred.addListener(handleErrorOccurred);

  browser.tabs.onRemoved.addListener((tabId) => {
    navigationStates.delete(tabId);
  });

  log.info("browsingContext events initialized");
}

// ============================================================================
// Exports
// ============================================================================

export { initBrowsingContextEvents };
