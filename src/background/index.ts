/**
 * @fileoverview Background script entry point.
 * @module background
 */

// ============================================================================
// Imports
// ============================================================================

import {
  session,
  createLogger,
  getLogs,
  clearLogs,
  addLog,
} from "../core/index.js";

// Module handlers (self-register on import)
import "./modules/session/index.js";
import "./modules/browsing-context/index.js";
import "./modules/script/index.js";
import "./modules/element/index.js";
import "./modules/input/index.js";
import "./modules/network/index.js";
import "./modules/proxy/index.js";
import "./modules/storage/index.js";

// ============================================================================
// Types
// ============================================================================

interface WebDriverInitMessage {
  type: "WEBDRIVER_INIT";
  wsUrl: string;
  sessionId: number;
}

interface GetStateMessage {
  type: "GET_STATE";
}

interface GetLogsMessage {
  type: "GET_LOGS";
}

interface ClearLogsMessage {
  type: "CLEAR_LOGS";
}

interface ContentEventMessage {
  type: "CONTENT_EVENT";
  method: string;
  params: Record<string, unknown>;
}

interface ContentLogMessage {
  type: "CONTENT_LOG";
  level: "debug" | "info" | "warn" | "error";
  module: string;
  message: string;
  data?: unknown;
}

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("Background");

// ============================================================================
// Implementation - Type Guards
// ============================================================================

function isWebDriverInitMessage(
  message: unknown
): message is WebDriverInitMessage {
  if (typeof message !== "object" || message === null) return false;
  const msg = message as Record<string, unknown>;
  return (
    msg.type === "WEBDRIVER_INIT" &&
    typeof msg.wsUrl === "string" &&
    typeof msg.sessionId === "number"
  );
}

function isGetStateMessage(message: unknown): message is GetStateMessage {
  if (typeof message !== "object" || message === null) return false;
  const msg = message as Record<string, unknown>;
  return msg.type === "GET_STATE";
}

function isGetLogsMessage(message: unknown): message is GetLogsMessage {
  if (typeof message !== "object" || message === null) return false;
  const msg = message as Record<string, unknown>;
  return msg.type === "GET_LOGS";
}

function isClearLogsMessage(message: unknown): message is ClearLogsMessage {
  if (typeof message !== "object" || message === null) return false;
  const msg = message as Record<string, unknown>;
  return msg.type === "CLEAR_LOGS";
}

function isContentEventMessage(
  message: unknown
): message is ContentEventMessage {
  if (typeof message !== "object" || message === null) return false;
  const msg = message as Record<string, unknown>;
  return (
    msg.type === "CONTENT_EVENT" &&
    typeof msg.method === "string" &&
    typeof msg.params === "object"
  );
}

function isContentLogMessage(message: unknown): message is ContentLogMessage {
  if (typeof message !== "object" || message === null) return false;
  const msg = message as Record<string, unknown>;
  return (
    msg.type === "CONTENT_LOG" &&
    typeof msg.level === "string" &&
    typeof msg.module === "string" &&
    typeof msg.message === "string"
  );
}

// ============================================================================
// Implementation - Message Handler
// ============================================================================

browser.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: browser.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ): boolean | Promise<boolean> => {
    if (isWebDriverInitMessage(message)) {
      const { wsUrl, sessionId } = message;
      log.info("Received WEBDRIVER_INIT, connecting...", { wsUrl, sessionId });

      session
        .connect(wsUrl, sessionId)
        .then(() => {
          log.info("WebSocket connected");
          sendResponse({ success: true });
        })
        .catch((error: unknown) => {
          log.error("Connection failed", error);
          sendResponse({ success: false, error: String(error) });
        });

      return true;
    }

    if (isGetStateMessage(message)) {
      session
        .getDebugState()
        .then((state) => sendResponse(state))
        .catch(() => sendResponse(null));
      return true;
    }

    if (isGetLogsMessage(message)) {
      sendResponse(getLogs());
      return true;
    }

    if (isClearLogsMessage(message)) {
      clearLogs();
      sendResponse({ success: true });
      return true;
    }

    if (isContentEventMessage(message)) {
      const { method, params } = message;
      const tabId = sender.tab?.id ?? 0;
      const frameId = sender.frameId ?? 0;

      const eventParams = { ...params, tabId, frameId };
      log.debug(`Content event: ${method}`, eventParams);

      // Handle element.added events locally to resolve pending subscriptions
      if (method === "element.added") {
        const { elementId, strategy, value } = params as {
          elementId: string;
          strategy: string;
          value: string;
        };
        // Import dynamically to avoid circular dependency
        import("./modules/element/observer.js")
          .then(({ onElementAdded }) => {
            onElementAdded(tabId, elementId, strategy, value);
          })
          .catch(() => {
            // Ignore import errors
          });
      }

      session.sendEvent(method, eventParams);

      return false;
    }

    if (isContentLogMessage(message)) {
      const { level, module, message: msg, data } = message;
      addLog(level, module, msg, data);
      return false;
    }

    return false;
  }
);

// ============================================================================
// Startup
// ============================================================================

log.info("Firefox WebDriver Extension loaded");
