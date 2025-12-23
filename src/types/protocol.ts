/**
 * @fileoverview Protocol message types for WebSocket communication.
 * @module types/protocol
 */

// ============================================================================
// Imports
// ============================================================================

import type { RequestId, TabId, FrameId } from "./identifiers.js";

// ============================================================================
// Constants
// ============================================================================

/** Error codes matching ARCHITECTURE.md Section 6.2. */
const ErrorCode = {
  UnknownCommand: "unknown command",
  InvalidArgument: "invalid argument",
  NoSuchElement: "no such element",
  StaleElement: "stale element",
  NoSuchFrame: "no such frame",
  NoSuchTab: "no such tab",
  NoSuchIntercept: "no such intercept",
  NoSuchScript: "no such script",
  ScriptError: "script error",
  Timeout: "timeout",
  ConnectionClosed: "connection closed",
  UnknownError: "unknown error",
} as const;

type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// ============================================================================
// Types - Request
// ============================================================================

/** Command request from Rust driver. */
interface Request {
  /** Unique identifier for request/response correlation. */
  id: RequestId;
  /** Command name in module.methodName format. */
  method: string;
  /** Target tab ID. */
  tabId: TabId;
  /** Target frame ID (0 = main frame). */
  frameId: FrameId;
  /** Command-specific parameters. */
  params?: Record<string, unknown>;
}

// ============================================================================
// Types - Response
// ============================================================================

/** Success response. */
interface SuccessResponse {
  /** Matches the command id. */
  id: RequestId;
  /** Response type discriminator. */
  type: "success";
  /** Command result data. */
  result: unknown;
}

/** Error response. */
interface ErrorResponse {
  /** Matches the command id. */
  id: RequestId;
  /** Response type discriminator. */
  type: "error";
  /** Error code. */
  error: string;
  /** Human-readable error message. */
  message: string;
}

/** Response union type. */
type Response = SuccessResponse | ErrorResponse;

// ============================================================================
// Types - Event
// ============================================================================

/** Event notification from extension. */
interface Event {
  /** Unique identifier for EventReply correlation. */
  id: RequestId;
  /** Event type discriminator. */
  type: "event";
  /** Event name in module.eventName format. */
  method: string;
  /** Event-specific data. */
  params: Record<string, unknown>;
}

// ============================================================================
// Types - EventReply
// ============================================================================

/** Reply to an event from Rust. */
interface EventReply {
  /** Matches the event id. */
  id: RequestId;
  /** Event method being replied to. */
  replyTo: string;
  /** Decision/action to take. */
  result: Record<string, unknown>;
}

// ============================================================================
// Types - READY Handshake
// ============================================================================

/** Data sent with READY handshake. */
interface ReadyData {
  /** Session ID from init message. */
  sessionId: number;
  /** Initial tab ID. */
  tabId: number;
}

// ============================================================================
// Types - Request Context
// ============================================================================

/** Context passed to all command handlers. */
interface RequestContext {
  /** Tab ID where request originated. */
  tabId: TabId;
  /** Frame ID within the tab. */
  frameId: FrameId;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Creates a success response.
 *
 * @param id - Request ID to respond to
 * @param result - Result data
 * @returns Success response
 */
function successResponse(id: RequestId, result: unknown): SuccessResponse {
  return { id, type: "success", result };
}

/**
 * Creates an error response.
 *
 * @param id - Request ID to respond to
 * @param error - Error code
 * @param message - Human-readable message
 * @returns Error response
 */
function errorResponse(
  id: RequestId,
  error: string,
  message: string
): ErrorResponse {
  return { id, type: "error", error, message };
}

/**
 * Type guard for Request.
 *
 * @param value - Value to check
 * @returns True if value is a Request
 */
function isRequest(value: unknown): value is Request {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.method === "string" &&
    typeof obj.tabId === "number" &&
    typeof obj.frameId === "number"
  );
}

/**
 * Type guard for EventReply.
 *
 * @param value - Value to check
 * @returns True if value is an EventReply
 */
function isEventReply(value: unknown): value is EventReply {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.replyTo === "string" &&
    typeof obj.result === "object" &&
    obj.result !== null
  );
}

// ============================================================================
// Exports
// ============================================================================

export type {
  Request,
  SuccessResponse,
  ErrorResponse,
  Response,
  Event,
  EventReply,
  ReadyData,
  RequestContext,
};

export { ErrorCode, successResponse, errorResponse, isRequest, isEventReply };
