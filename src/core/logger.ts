/**
 * @fileoverview Structured logger for extension.
 * @module core/logger
 */

// ============================================================================
// Types
// ============================================================================

/** Log level. */
type LogLevel = "debug" | "info" | "warn" | "error";

/** Log entry. */
interface LogEntry {
  /** Timestamp (ISO string). */
  timestamp: string;
  /** Log level. */
  level: LogLevel;
  /** Module name. */
  module: string;
  /** Log message. */
  message: string;
  /** Optional data. */
  data?: unknown;
}

/** Logger configuration. */
interface LoggerConfig {
  /** Minimum level to log. */
  minLevel: LogLevel;
  /** Maximum entries to keep in memory. */
  maxEntries: number;
  /** Enable console output. */
  console: boolean;
}

/** Logger instance for a specific module. */
interface Logger {
  /** Logs a debug message. */
  debug(message: string, data?: unknown): void;
  /** Logs an info message. */
  info(message: string, data?: unknown): void;
  /** Logs a warning message. */
  warn(message: string, data?: unknown): void;
  /** Logs an error message. */
  error(message: string, data?: unknown): void;
}

// ============================================================================
// Constants
// ============================================================================

/** Level priority (higher = more severe). */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Default configuration. */
const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: "debug",
  maxEntries: 500,
  console: true,
};

// ============================================================================
// State
// ============================================================================

/** In-memory log storage. */
const logs: LogEntry[] = [];

/** Current configuration. */
let config: LoggerConfig = { ...DEFAULT_CONFIG };

// ============================================================================
// Implementation
// ============================================================================

/**
 * Logs a message.
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
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[config.minLevel]) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    data,
  };

  logs.push(entry);
  if (logs.length > config.maxEntries) {
    logs.shift();
  }

  if (config.console) {
    const prefix = `[${entry.timestamp.slice(
      11,
      23
    )}] [${level.toUpperCase()}] [${module}]`;
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
  }
}

/**
 * Configures the logger.
 *
 * @param options - Configuration options
 */
function configureLogger(options: Partial<LoggerConfig>): void {
  config = { ...config, ...options };
}

/**
 * Gets all log entries.
 *
 * @returns Array of log entries
 */
function getLogs(): LogEntry[] {
  return [...logs];
}

/**
 * Clears all log entries.
 */
function clearLogs(): void {
  logs.length = 0;
}

/**
 * Gets and clears all log entries.
 *
 * @returns Array of log entries (logs are cleared after return)
 */
function stealLogs(): LogEntry[] {
  const stolen = [...logs];
  logs.length = 0;
  return stolen;
}

/**
 * Gets logs filtered by level.
 *
 * @param level - Minimum level
 * @returns Filtered log entries
 */
function getLogsByLevel(level: LogLevel): LogEntry[] {
  const minPriority = LEVEL_PRIORITY[level];
  return logs.filter((entry) => LEVEL_PRIORITY[entry.level] >= minPriority);
}

/**
 * Adds a log entry directly.
 *
 * @param level - Log level
 * @param module - Module name
 * @param message - Log message
 * @param data - Optional data
 */
function addLog(
  level: LogLevel,
  module: string,
  message: string,
  data?: unknown
): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[config.minLevel]) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    data,
  };

  logs.push(entry);
  if (logs.length > config.maxEntries) {
    logs.shift();
  }
}

/**
 * Creates a logger for a specific module.
 *
 * @param module - Module name
 * @returns Logger instance
 *
 * @example
 *     const log = createLogger("MyModule");
 *     log.info("Started");
 */
function createLogger(module: string): Logger {
  return {
    debug: (message: string, data?: unknown): void => {
      log("debug", module, message, data);
    },
    info: (message: string, data?: unknown): void => {
      log("info", module, message, data);
    },
    warn: (message: string, data?: unknown): void => {
      log("warn", module, message, data);
    },
    error: (message: string, data?: unknown): void => {
      log("error", module, message, data);
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export type { Logger, LogEntry, LogLevel };

export {
  createLogger,
  configureLogger,
  getLogs,
  clearLogs,
  stealLogs,
  getLogsByLevel,
  addLog,
};
