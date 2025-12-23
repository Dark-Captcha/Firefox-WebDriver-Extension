/**
 * @fileoverview Keyboard input handlers.
 * @module modules/input/keyboard
 */

// ============================================================================
// Imports
// ============================================================================

import type { RequestContext } from "../../../types/index.js";

import { createLogger } from "../../../core/logger.js";

// ============================================================================
// Types
// ============================================================================

interface TypeKeyParams {
  elementId: string;
  key: string;
  code: string;
  keyCode: number;
  printable: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

interface TypeTextParams {
  elementId: string;
  text: string;
}

interface ContentResponse {
  success: boolean;
  error?: string;
  code?: string;
}

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("Input.Keyboard");

// ============================================================================
// Implementation
// ============================================================================

async function handleTypeKey(
  params: unknown,
  ctx: RequestContext
): Promise<void> {
  const {
    elementId,
    key,
    code,
    keyCode,
    printable,
    ctrl = false,
    shift = false,
    alt = false,
    meta = false,
  } = params as TypeKeyParams;

  if (!elementId) {
    throw new Error("elementId is required");
  }
  if (!key) {
    throw new Error("key is required");
  }

  log.debug(`typeKey: elementId=${elementId}, key="${key}", code="${code}"`);

  const response = (await browser.tabs.sendMessage(
    ctx.tabId,
    {
      type: "INPUT_TYPE_KEY",
      elementId,
      key,
      code,
      keyCode,
      printable,
      ctrl,
      shift,
      alt,
      meta,
    },
    { frameId: ctx.frameId }
  )) as ContentResponse;

  if (!response || !response.success) {
    const error = new Error(response?.error || "Failed to type key");
    error.name = response?.code || "script error";
    throw error;
  }

  log.debug("typeKey: success");
}

async function handleTypeText(
  params: unknown,
  ctx: RequestContext
): Promise<void> {
  const { elementId, text } = params as TypeTextParams;

  if (!elementId) {
    throw new Error("elementId is required");
  }
  if (text === undefined || text === null) {
    throw new Error("text is required");
  }

  log.debug(
    `typeText: elementId=${elementId}, text="${text}" (${text.length} chars)`
  );

  const response = (await browser.tabs.sendMessage(
    ctx.tabId,
    { type: "INPUT_TYPE_TEXT", elementId, text },
    { frameId: ctx.frameId }
  )) as ContentResponse;

  if (!response || !response.success) {
    const error = new Error(response?.error || "Failed to type text");
    error.name = response?.code || "script error";
    throw error;
  }

  log.debug("typeText: success");
}

// ============================================================================
// Exports
// ============================================================================

export { handleTypeKey, handleTypeText };
