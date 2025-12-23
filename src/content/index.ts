/**
 * @fileoverview Content script entry point.
 * @module content
 */

// ============================================================================
// Imports
// ============================================================================

import { initMessaging } from "./messaging.js";
import { initBridge } from "./bridge.js";
import { initElements, getElementStore } from "./elements.js";
import { initObserver } from "./observer.js";

// ============================================================================
// Implementation
// ============================================================================

/**
 * Initializes all content script components.
 */
function init(): void {
  initMessaging();
  initBridge();
  initElements();

  const elementStore = getElementStore();
  initObserver(elementStore);
}

init();
