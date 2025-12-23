/**
 * @fileoverview Input module entry point.
 * @module modules/input
 */

// ============================================================================
// Imports
// ============================================================================

import { registry } from "../../../core/registry.js";
import { createLogger } from "../../../core/logger.js";

import { handleTypeKey, handleTypeText } from "./keyboard.js";
import {
  handleMouseClick,
  handleMouseMove,
  handleMouseDown,
  handleMouseUp,
} from "./mouse.js";

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("Input");

// ============================================================================
// Registration
// ============================================================================

registry.register("input.typeKey", handleTypeKey);
registry.register("input.typeText", handleTypeText);

registry.register("input.mouseClick", handleMouseClick);
registry.register("input.mouseMove", handleMouseMove);
registry.register("input.mouseDown", handleMouseDown);
registry.register("input.mouseUp", handleMouseUp);

log.info("input module registered (6 handlers)");

// ============================================================================
// Exports
// ============================================================================

export {
  handleTypeKey,
  handleTypeText,
  handleMouseClick,
  handleMouseMove,
  handleMouseDown,
  handleMouseUp,
};
