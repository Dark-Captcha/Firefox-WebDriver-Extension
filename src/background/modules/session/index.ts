/**
 * @fileoverview Session module entry point.
 * @module modules/session
 */

// ============================================================================
// Imports
// ============================================================================

import type { RequestContext } from "../../../types/index.js";

import { registry } from "../../../core/registry.js";
import { createLogger, stealLogs } from "../../../core/logger.js";
import type { LogEntry } from "../../../core/logger.js";

// ============================================================================
// Types
// ============================================================================

interface StealLogsResult {
  logs: LogEntry[];
}

interface StatusResult {
  connected: boolean;
  handlers: number;
}

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("Session");

// ============================================================================
// Implementation
// ============================================================================

function handleStatus(
  _params: unknown,
  _ctx: RequestContext
): Promise<StatusResult> {
  log.debug(`status: handlers=${registry.size}`);
  return Promise.resolve({ connected: true, handlers: registry.size });
}

function handleStealLogs(
  _params: unknown,
  _ctx: RequestContext
): Promise<StealLogsResult> {
  const logs = stealLogs();
  log.debug(`stealLogs: returned ${logs.length} entries`);
  return Promise.resolve({ logs });
}

// ============================================================================
// Registration
// ============================================================================

registry.register("session.status", handleStatus);
registry.register("session.stealLogs", handleStealLogs);

log.info("session module registered (2 handlers)");

// ============================================================================
// Exports
// ============================================================================

export { handleStatus, handleStealLogs };
