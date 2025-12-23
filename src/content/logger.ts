/**
 * @fileoverview Logger for content scripts.
 * @module content/logger
 */

// ============================================================================
// Imports
// ============================================================================

import { sendLog } from "./messaging.js";

// ============================================================================
// Types
// ============================================================================

/** Log level. */
type LogLevel = "debug" | "info" | "warn" | "error";

/** Content script logger interface. */
interface ContentLogger {
  debug(msg: string, data?: unknown): void;
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  error(msg: string, data?: unknown): void;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Logs to console and sends to background.
 *
 * @param level - Log level
 * @param module - Module name
 * @param message - Log message
 * @param data - Optional data
 */
function log(
  level: LogLevel,
  module: string,
  message: string,
  data?: unknown
): void {
  const prefix = `[Content:${module}]`;
  const consoleFn =
    level === "error"
      ? console.error
      : level === "warn"
      ? console.warn
      : level === "debug"
      ? console.debug
      : console.log;

  if (data !== undefined) {
    consoleFn(prefix, message, data);
  } else {
    consoleFn(prefix, message);
  }

  sendLog(level, `Content:${module}`, message, data);
}

/**
 * Creates a logger for a content script module.
 *
 * @param module - Module name for log prefix
 * @returns Logger instance
 */
function createContentLogger(module: string): ContentLogger {
  return {
    debug: (msg: string, data?: unknown): void => {
      log("debug", module, msg, data);
    },
    info: (msg: string, data?: unknown): void => {
      log("info", module, msg, data);
    },
    warn: (msg: string, data?: unknown): void => {
      log("warn", module, msg, data);
    },
    error: (msg: string, data?: unknown): void => {
      log("error", module, msg, data);
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export type { ContentLogger };

export { createContentLogger };
