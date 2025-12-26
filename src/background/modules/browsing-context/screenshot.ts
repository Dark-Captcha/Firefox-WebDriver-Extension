/**
 * @fileoverview Screenshot capture handlers.
 * @module modules/browsingContext/screenshot
 */

// ============================================================================
// Imports
// ============================================================================

import type { RequestContext } from "../../../types/index.js";

import { createLogger } from "../../../core/logger.js";

// ============================================================================
// Types
// ============================================================================

interface CaptureScreenshotParams {
  format?: "png" | "jpeg";
  quality?: number;
}

interface CaptureScreenshotResult {
  data: string;
}

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("BrowsingContext.Screenshot");

// ============================================================================
// Implementation
// ============================================================================

async function handleCaptureScreenshot(
  params: unknown,
  ctx: RequestContext
): Promise<CaptureScreenshotResult> {
  const { format = "png", quality } = (params as CaptureScreenshotParams) || {};

  log.debug(
    `captureScreenshot: tab=${ctx.tabId}, format=${format}, quality=${quality ?? "default"}`
  );
  const start = Date.now();

  const tab = await browser.tabs.get(ctx.tabId);
  if (!tab.windowId) {
    throw new Error("Tab has no window");
  }

  const options: browser.extensionTypes.ImageDetails = {
    format: format === "jpeg" ? "jpeg" : "png",
  };

  if (format === "jpeg" && quality !== undefined) {
    options.quality = quality;
  }

  const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, options);

  // Extract base64 data from data URL
  const base64Data = dataUrl.split(",")[1];
  if (!base64Data) {
    throw new Error("Failed to capture screenshot");
  }

  const elapsed = Date.now() - start;
  log.debug(
    `captureScreenshot: completed in ${elapsed}ms, ${base64Data.length} bytes`
  );

  return { data: base64Data };
}

// ============================================================================
// Exports
// ============================================================================

export { handleCaptureScreenshot };
