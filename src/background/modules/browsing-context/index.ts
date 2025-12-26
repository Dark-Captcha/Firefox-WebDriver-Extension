/**
 * @fileoverview BrowsingContext module entry point.
 * @module modules/browsingContext
 */

// ============================================================================
// Imports
// ============================================================================

import { registry } from "../../../core/registry.js";
import { createLogger } from "../../../core/logger.js";

import {
  handleNavigate,
  handleReload,
  handleGoBack,
  handleGoForward,
} from "./navigation.js";
import { handleGetTitle, handleGetUrl } from "./properties.js";
import { handleNewTab, handleCloseTab } from "./tabs.js";
import { handleFocusTab, handleFocusWindow } from "./focus.js";
import {
  handleSwitchToFrame,
  handleSwitchToFrameByIndex,
  handleSwitchToFrameByUrl,
  handleSwitchToParentFrame,
  handleGetFrameCount,
  handleGetAllFrames,
} from "./frames.js";
import { initBrowsingContextEvents } from "./events.js";
import { handleCaptureScreenshot } from "./screenshot.js";

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("BrowsingContext");

// ============================================================================
// Registration
// ============================================================================

registry.register("browsingContext.navigate", handleNavigate);
registry.register("browsingContext.reload", handleReload);
registry.register("browsingContext.goBack", handleGoBack);
registry.register("browsingContext.goForward", handleGoForward);

registry.register("browsingContext.getTitle", handleGetTitle);
registry.register("browsingContext.getUrl", handleGetUrl);

registry.register("browsingContext.newTab", handleNewTab);
registry.register("browsingContext.closeTab", handleCloseTab);

registry.register("browsingContext.focusTab", handleFocusTab);
registry.register("browsingContext.focusWindow", handleFocusWindow);

registry.register("browsingContext.switchToFrame", handleSwitchToFrame);
registry.register(
  "browsingContext.switchToFrameByIndex",
  handleSwitchToFrameByIndex
);
registry.register(
  "browsingContext.switchToFrameByUrl",
  handleSwitchToFrameByUrl
);
registry.register(
  "browsingContext.switchToParentFrame",
  handleSwitchToParentFrame
);
registry.register("browsingContext.getFrameCount", handleGetFrameCount);
registry.register("browsingContext.getAllFrames", handleGetAllFrames);

registry.register("browsingContext.captureScreenshot", handleCaptureScreenshot);

initBrowsingContextEvents();

log.info("browsingContext module registered (17 handlers + events)");

// ============================================================================
// Exports
// ============================================================================

export {
  handleNavigate,
  handleReload,
  handleGoBack,
  handleGoForward,
  handleGetTitle,
  handleGetUrl,
  handleNewTab,
  handleCloseTab,
  handleFocusTab,
  handleFocusWindow,
  handleSwitchToFrame,
  handleSwitchToFrameByIndex,
  handleSwitchToFrameByUrl,
  handleSwitchToParentFrame,
  handleGetFrameCount,
  handleGetAllFrames,
  handleCaptureScreenshot,
};
