/**
 * @fileoverview Element screenshot capture handler.
 * @module modules/element/screenshot
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
  elementId: string;
  format?: "png" | "jpeg";
  quality?: number;
}

interface CaptureScreenshotResult {
  data: string;
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
  };
}

interface ContentResponse {
  success: boolean;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  dpr?: number;
  error?: string;
  code?: string;
}

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("Element.Screenshot");

// ============================================================================
// Implementation
// ============================================================================

async function handleCaptureScreenshot(
  params: unknown,
  ctx: RequestContext
): Promise<CaptureScreenshotResult> {
  const {
    elementId,
    format = "png",
    quality,
  } = params as CaptureScreenshotParams;

  if (!elementId) {
    throw new Error("elementId is required");
  }

  log.debug(
    `captureScreenshot: elementId=${elementId}, tab=${ctx.tabId}, format=${format}, quality=${quality ?? "default"}`
  );
  const start = Date.now();

  // Scroll element into view and get its bounds + device pixel ratio
  const boundsResponse = (await browser.tabs.sendMessage(
    ctx.tabId,
    {
      type: "ELEMENT_GET_BOUNDS_AND_SCROLL",
      elementId,
    },
    { frameId: ctx.frameId }
  )) as ContentResponse;

  if (!boundsResponse || !boundsResponse.success || !boundsResponse.bounds) {
    const error = new Error(
      boundsResponse?.error || "Failed to get element bounds"
    );
    error.name = boundsResponse?.code || "no such element";
    throw error;
  }

  const bounds = boundsResponse.bounds;
  const dpr = boundsResponse.dpr || 1;

  // Capture the visible tab
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

  // Extract base64 data
  const base64Data = dataUrl.split(",")[1];
  if (!base64Data) {
    throw new Error("Failed to capture screenshot");
  }

  const elapsed = Date.now() - start;
  log.debug(
    `captureScreenshot: completed in ${elapsed}ms, bounds=${JSON.stringify(bounds)}, dpr=${dpr}`
  );

  // Return full screenshot with clip info for Rust to crop
  return {
    data: base64Data,
    clip: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      scale: dpr,
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export { handleCaptureScreenshot };
