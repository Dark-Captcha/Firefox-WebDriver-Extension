/**
 * @fileoverview Type exports for Firefox WebDriver extension.
 * @module types
 */

// ============================================================================
// Identifiers
// ============================================================================

export type {
  SessionId,
  TabId,
  FrameId,
  ElementId,
  RequestId,
  ScriptId,
  InterceptId,
} from "./identifiers.js";

export {
  READY_REQUEST_ID,
  MAIN_FRAME_ID,
  createSessionId,
  createTabId,
  createFrameId,
  createElementId,
  createRequestId,
  createScriptId,
  createInterceptId,
  generateRequestId,
  generateElementId,
  generateScriptId,
  generateInterceptId,
  isMainFrame,
} from "./identifiers.js";

// ============================================================================
// Protocol
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
} from "./protocol.js";

export {
  ErrorCode,
  successResponse,
  errorResponse,
  isRequest,
  isEventReply,
} from "./protocol.js";
