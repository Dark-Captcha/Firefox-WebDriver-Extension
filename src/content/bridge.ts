/**
 * @fileoverview Bridge between page context and background script.
 * @module content/bridge
 */

// ============================================================================
// Imports
// ============================================================================

import { sendInit } from "./messaging.js";
import { createContentLogger } from "./logger.js";

// ============================================================================
// Constants
// ============================================================================

const log = createContentLogger("Bridge");

// ============================================================================
// State
// ============================================================================

let initialized = false;

// ============================================================================
// Implementation
// ============================================================================

/**
 * Checks if origin is trusted.
 *
 * @param eventOrigin - Event origin to check
 * @returns True if trusted
 */
function isTrustedOrigin(eventOrigin: string): boolean {
  return (
    eventOrigin === "null" ||
    window.location.protocol === "data:" ||
    window.location.href === "about:blank"
  );
}

/**
 * Checks if WebSocket URL is localhost.
 *
 * @param wsUrl - WebSocket URL to check
 * @returns True if localhost
 */
function isLocalhostWsUrl(wsUrl: string | undefined): boolean {
  if (!wsUrl) return false;
  return (
    wsUrl.startsWith("ws://127.0.0.1:") || wsUrl.startsWith("ws://localhost:")
  );
}

/**
 * Type guard for WEBDRIVER_INIT message.
 *
 * @param data - Data to check
 * @returns True if valid init message
 */
function isValidInitMessage(
  data: unknown
): data is { type: string; wsUrl: string; sessionId: number } {
  if (typeof data !== "object" || data === null) return false;
  const msg = data as Record<string, unknown>;
  return (
    msg.type === "WEBDRIVER_INIT" &&
    typeof msg.wsUrl === "string" &&
    typeof msg.sessionId === "number"
  );
}

/**
 * Handles window message events.
 *
 * @param event - Message event
 */
function handleMessage(event: MessageEvent): void {
  if (initialized) return;
  if (!isTrustedOrigin(event.origin)) return;
  if (!isValidInitMessage(event.data)) return;

  const { wsUrl, sessionId } = event.data;

  if (!isLocalhostWsUrl(wsUrl)) return;

  initialized = true;

  log.info("Forwarding WEBDRIVER_INIT to background", { wsUrl, sessionId });

  sendInit(wsUrl, sessionId).catch((err) => {
    log.error("Failed to forward init message", err);
    initialized = false;
  });
}

/**
 * Initializes the bridge.
 */
function initBridge(): void {
  window.addEventListener("message", handleMessage);
  log.info("Listening for WEBDRIVER_INIT");
}

// ============================================================================
// Exports
// ============================================================================

export { initBridge };
