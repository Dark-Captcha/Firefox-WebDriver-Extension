/**
 * @fileoverview Navigation handlers for browsingContext module.
 * @module modules/browsingContext/navigation
 */

// ============================================================================
// Imports
// ============================================================================

import type { RequestContext } from "../../../types/index.js";

import { createLogger } from "../../../core/logger.js";

// ============================================================================
// Types
// ============================================================================

interface NavigateParams {
  url: string;
  wait?: "none" | "domContentLoaded" | "load";
}

interface NavigateResult {
  url: string;
}

// ============================================================================
// Constants
// ============================================================================

const NAVIGATION_TIMEOUT_MS = 30_000;

const log = createLogger("BrowsingContext.Navigation");

// ============================================================================
// Implementation
// ============================================================================

function waitForNavigation(
  tabId: number,
  targetUrl: string,
  timeoutMs: number
): Promise<string> {
  log.debug("Setting up navigation listener", {
    tabId,
    targetUrl: targetUrl.substring(0, 50),
    timeoutMs,
  });

  const isDataUri = targetUrl.startsWith("data:");
  const targetUrlPrefix = targetUrl.substring(0, 100);

  return new Promise((resolve, reject) => {
    let resolved = false;
    let sawLoading = false;

    const cleanup = (): void => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        browser.tabs.onUpdated.removeListener(listener);
      }
    };

    const timeoutId = setTimeout(() => {
      log.warn("Navigation timeout", {
        tabId,
        targetUrl: targetUrl.substring(0, 50),
      });
      cleanup();
      reject(new Error(`Navigation timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const listener = (
      updatedTabId: number,
      changeInfo: browser.tabs._OnUpdatedChangeInfo,
      tab: browser.tabs.Tab
    ): void => {
      if (updatedTabId !== tabId || resolved) return;

      log.debug("Tab update event", {
        tabId: updatedTabId,
        status: changeInfo.status,
        url: changeInfo.url?.substring(0, 50),
        tabUrl: tab.url?.substring(0, 50),
        sawLoading,
      });

      if (changeInfo.status === "loading") {
        sawLoading = true;
      }

      if (isDataUri) {
        if (
          changeInfo.status === "complete" &&
          tab.url?.startsWith(targetUrlPrefix)
        ) {
          log.debug("Data URI navigation completed", { tabId });
          cleanup();
          resolve(tab.url);
        }
      } else {
        if (
          changeInfo.status === "complete" &&
          tab.url &&
          !tab.url.startsWith("data:") &&
          sawLoading
        ) {
          log.debug("Navigation completed", { tabId, url: tab.url });
          cleanup();
          resolve(tab.url);
        }
      }
    };

    browser.tabs.onUpdated.addListener(listener);
    log.debug("Navigation listener registered", { tabId });
  });
}

async function handleNavigate(
  params: unknown,
  ctx: RequestContext
): Promise<NavigateResult> {
  const { url, wait = "load" } = params as NavigateParams;

  if (!url) {
    throw new Error("URL is required");
  }

  log.debug(`navigate: url=${url}, tab=${ctx.tabId}, wait=${wait}`);
  const start = Date.now();

  if (wait === "none") {
    await browser.tabs.update(ctx.tabId as number, { url });
    log.info(
      `navigate: started (no wait) in ${Date.now() - start}ms, url=${url}`
    );
    return { url };
  }

  const navigationPromise = waitForNavigation(
    ctx.tabId as number,
    url,
    NAVIGATION_TIMEOUT_MS
  );

  await browser.tabs.update(ctx.tabId as number, { url });

  const finalUrl = await navigationPromise;

  const elapsed = Date.now() - start;
  log.info(`navigate: completed in ${elapsed}ms, url=${finalUrl}`);

  return { url: finalUrl };
}

async function handleReload(
  _params: unknown,
  ctx: RequestContext
): Promise<void> {
  log.debug(`reload: tab=${ctx.tabId}`);
  const start = Date.now();

  await browser.tabs.reload(ctx.tabId);

  const elapsed = Date.now() - start;
  log.debug(`reload: completed in ${elapsed}ms`);
}

async function handleGoBack(
  _params: unknown,
  ctx: RequestContext
): Promise<void> {
  log.debug(`goBack: tab=${ctx.tabId}`);
  const start = Date.now();

  await browser.tabs.goBack(ctx.tabId);

  const elapsed = Date.now() - start;
  log.debug(`goBack: completed in ${elapsed}ms`);
}

async function handleGoForward(
  _params: unknown,
  ctx: RequestContext
): Promise<void> {
  log.debug(`goForward: tab=${ctx.tabId}`);
  const start = Date.now();

  await browser.tabs.goForward(ctx.tabId);

  const elapsed = Date.now() - start;
  log.debug(`goForward: completed in ${elapsed}ms`);
}

// ============================================================================
// Exports
// ============================================================================

export { handleNavigate, handleReload, handleGoBack, handleGoForward };
