/**
 * @fileoverview Branded type definitions for type-safe IDs.
 * @module types/identifiers
 */

// ============================================================================
// Imports
// ============================================================================

import { generateUUID } from "../core/utils.js";

// ============================================================================
// Types
// ============================================================================

/** Session ID - identifies a browser window/session. */
type SessionId = number & { readonly __brand: "SessionId" };

/** Tab ID - Firefox-assigned tab identifier. */
type TabId = number & { readonly __brand: "TabId" };

/** Frame ID - Firefox-assigned frame identifier (0 = main frame). */
type FrameId = number & { readonly __brand: "FrameId" };

/** Element ID - UUID reference to element in content script store. */
type ElementId = string & { readonly __brand: "ElementId" };

/** Request ID - UUID for WebSocket request/response correlation. */
type RequestId = string & { readonly __brand: "RequestId" };

/** Script ID - UUID for preload script reference. */
type ScriptId = string & { readonly __brand: "ScriptId" };

/** Intercept ID - UUID for network intercept reference. */
type InterceptId = string & { readonly __brand: "InterceptId" };

// ============================================================================
// Constants
// ============================================================================

/** Nil UUID used for READY handshake. */
const READY_REQUEST_ID = "00000000-0000-0000-0000-000000000000" as RequestId;

/** Main frame ID (always 0). */
const MAIN_FRAME_ID = 0 as FrameId;

// ============================================================================
// Implementation
// ============================================================================

/**
 * Creates a SessionId from a number.
 *
 * @param id - Raw session ID
 * @returns Branded SessionId
 */
function createSessionId(id: number): SessionId {
  return id as SessionId;
}

/**
 * Creates a TabId from a number.
 *
 * @param id - Raw tab ID
 * @returns Branded TabId
 */
function createTabId(id: number): TabId {
  return id as TabId;
}

/**
 * Creates a FrameId from a number.
 *
 * @param id - Raw frame ID
 * @returns Branded FrameId
 */
function createFrameId(id: number): FrameId {
  return id as FrameId;
}

/**
 * Creates an ElementId from a string.
 *
 * @param id - Raw element ID (UUID)
 * @returns Branded ElementId
 */
function createElementId(id: string): ElementId {
  return id as ElementId;
}

/**
 * Creates a RequestId from a string.
 *
 * @param id - Raw request ID (UUID)
 * @returns Branded RequestId
 */
function createRequestId(id: string): RequestId {
  return id as RequestId;
}

/**
 * Creates a ScriptId from a string.
 *
 * @param id - Raw script ID (UUID)
 * @returns Branded ScriptId
 */
function createScriptId(id: string): ScriptId {
  return id as ScriptId;
}

/**
 * Creates an InterceptId from a string.
 *
 * @param id - Raw intercept ID (UUID)
 * @returns Branded InterceptId
 */
function createInterceptId(id: string): InterceptId {
  return id as InterceptId;
}

/**
 * Generates a new RequestId.
 *
 * @returns New unique RequestId
 */
function generateRequestId(): RequestId {
  return generateUUID() as RequestId;
}

/**
 * Generates a new ElementId.
 *
 * @returns New unique ElementId
 */
function generateElementId(): ElementId {
  return generateUUID() as ElementId;
}

/**
 * Generates a new ScriptId.
 *
 * @returns New unique ScriptId
 */
function generateScriptId(): ScriptId {
  return generateUUID() as ScriptId;
}

/**
 * Generates a new InterceptId.
 *
 * @returns New unique InterceptId
 */
function generateInterceptId(): InterceptId {
  return generateUUID() as InterceptId;
}

/**
 * Checks if a frame ID represents the main frame.
 *
 * @param frameId - Frame ID to check
 * @returns True if main frame
 */
function isMainFrame(frameId: FrameId): boolean {
  return frameId === MAIN_FRAME_ID;
}

// ============================================================================
// Exports
// ============================================================================

export type {
  SessionId,
  TabId,
  FrameId,
  ElementId,
  RequestId,
  ScriptId,
  InterceptId,
};

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
};
