/**
 * @fileoverview Mouse input handlers.
 * @module modules/input/mouse
 */

// ============================================================================
// Imports
// ============================================================================

import type { RequestContext } from "../../../types/index.js";

import { createLogger } from "../../../core/logger.js";

// ============================================================================
// Types
// ============================================================================

interface MouseParams {
  elementId?: string;
  x?: number;
  y?: number;
  button?: number;
}

interface ContentResponse {
  success: boolean;
  error?: string;
  code?: string;
}

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("Input.Mouse");

// ============================================================================
// Implementation
// ============================================================================

async function handleMouseClick(
  params: unknown,
  ctx: RequestContext
): Promise<void> {
  const { elementId, x, y, button = 0 } = params as MouseParams;

  if (!elementId && (x === undefined || y === undefined)) {
    throw new Error("Either elementId or coordinates (x, y) must be provided");
  }

  const target = elementId ?? `(${x}, ${y})`;
  log.debug(`mouseClick: ${target}, button=${button}, tab=${ctx.tabId}`);
  const start = Date.now();

  const response = (await browser.tabs.sendMessage(
    ctx.tabId,
    { type: "INPUT_MOUSE_CLICK", elementId, x, y, button },
    { frameId: ctx.frameId }
  )) as ContentResponse;

  if (!response || !response.success) {
    const error = new Error(response?.error || "Failed to click");
    error.name = response?.code || "script error";
    throw error;
  }

  const elapsed = Date.now() - start;
  log.debug(`mouseClick: completed in ${elapsed}ms`);
}

async function handleMouseMove(
  params: unknown,
  ctx: RequestContext
): Promise<void> {
  const { elementId, x, y } = params as MouseParams;

  if (!elementId && (x === undefined || y === undefined)) {
    throw new Error("Either elementId or coordinates (x, y) must be provided");
  }

  const target = elementId ?? `(${x}, ${y})`;
  log.debug(`mouseMove: ${target}, tab=${ctx.tabId}`);
  const start = Date.now();

  const response = (await browser.tabs.sendMessage(
    ctx.tabId,
    { type: "INPUT_MOUSE_MOVE", elementId, x, y },
    { frameId: ctx.frameId }
  )) as ContentResponse;

  if (!response || !response.success) {
    const error = new Error(response?.error || "Failed to move mouse");
    error.name = response?.code || "script error";
    throw error;
  }

  const elapsed = Date.now() - start;
  log.debug(`mouseMove: completed in ${elapsed}ms`);
}

async function handleMouseDown(
  params: unknown,
  ctx: RequestContext
): Promise<void> {
  const { elementId, x, y, button = 0 } = params as MouseParams;

  if (!elementId && (x === undefined || y === undefined)) {
    throw new Error("Either elementId or coordinates (x, y) must be provided");
  }

  const target = elementId ?? `(${x}, ${y})`;
  log.debug(`mouseDown: ${target}, button=${button}, tab=${ctx.tabId}`);
  const start = Date.now();

  const response = (await browser.tabs.sendMessage(
    ctx.tabId,
    { type: "INPUT_MOUSE_DOWN", elementId, x, y, button },
    { frameId: ctx.frameId }
  )) as ContentResponse;

  if (!response || !response.success) {
    const error = new Error(response?.error || "Failed to mousedown");
    error.name = response?.code || "script error";
    throw error;
  }

  const elapsed = Date.now() - start;
  log.debug(`mouseDown: completed in ${elapsed}ms`);
}

async function handleMouseUp(
  params: unknown,
  ctx: RequestContext
): Promise<void> {
  const { elementId, x, y, button = 0 } = params as MouseParams;

  if (!elementId && (x === undefined || y === undefined)) {
    throw new Error("Either elementId or coordinates (x, y) must be provided");
  }

  const target = elementId ?? `(${x}, ${y})`;
  log.debug(`mouseUp: ${target}, button=${button}, tab=${ctx.tabId}`);
  const start = Date.now();

  const response = (await browser.tabs.sendMessage(
    ctx.tabId,
    { type: "INPUT_MOUSE_UP", elementId, x, y, button },
    { frameId: ctx.frameId }
  )) as ContentResponse;

  if (!response || !response.success) {
    const error = new Error(response?.error || "Failed to mouseup");
    error.name = response?.code || "script error";
    throw error;
  }

  const elapsed = Date.now() - start;
  log.debug(`mouseUp: completed in ${elapsed}ms`);
}

// ============================================================================
// Exports
// ============================================================================

export { handleMouseClick, handleMouseMove, handleMouseDown, handleMouseUp };
