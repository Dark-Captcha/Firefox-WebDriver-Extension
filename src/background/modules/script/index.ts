/**
 * @fileoverview Script module entry point.
 * @module modules/script
 */

// ============================================================================
// Imports
// ============================================================================

import { registry } from "../../../core/registry.js";
import { createLogger } from "../../../core/logger.js";

import { handleEvaluate, handleEvaluateAsync } from "./evaluate.js";
import {
  handleAddPreloadScript,
  handleRemovePreloadScript,
  getPreloadScriptCount,
} from "./preload.js";

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("Script");

// ============================================================================
// Registration
// ============================================================================

registry.register("script.evaluate", handleEvaluate);
registry.register("script.evaluateAsync", handleEvaluateAsync);

registry.register("script.addPreloadScript", handleAddPreloadScript);
registry.register("script.removePreloadScript", handleRemovePreloadScript);

log.info("script module registered (4 handlers)");

// ============================================================================
// Exports
// ============================================================================

export {
  handleEvaluate,
  handleEvaluateAsync,
  handleAddPreloadScript,
  handleRemovePreloadScript,
  getPreloadScriptCount,
};
