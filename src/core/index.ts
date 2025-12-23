/**
 * @fileoverview Core module exports.
 * @module core
 */

// ============================================================================
// Registry
// ============================================================================

export type { Handler } from "./registry.js";

export { registry } from "./registry.js";

// ============================================================================
// Session
// ============================================================================

export type { DebugState } from "./session.js";

export { session } from "./session.js";

// ============================================================================
// Logger
// ============================================================================

export type { Logger, LogEntry, LogLevel } from "./logger.js";

export {
  createLogger,
  configureLogger,
  getLogs,
  clearLogs,
  stealLogs,
  getLogsByLevel,
  addLog,
} from "./logger.js";

// ============================================================================
// Utils
// ============================================================================

export { generateUUID, patternToRegex } from "./utils.js";
