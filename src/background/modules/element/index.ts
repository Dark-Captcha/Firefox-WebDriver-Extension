/**
 * @fileoverview Element module entry point.
 * @module modules/element
 */

// ============================================================================
// Imports
// ============================================================================

import { registry } from "../../../core/registry.js";
import { createLogger } from "../../../core/logger.js";

import { handleFind, handleFindAll } from "./search.js";
import {
  handleGetProperty,
  handleSetProperty,
  handleCallMethod,
} from "./actions.js";
import {
  handleSubscribe,
  handleUnsubscribe,
  handleWatchRemoval,
  handleUnwatchRemoval,
  handleWatchAttribute,
  handleUnwatchAttribute,
} from "./observer.js";

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("Element");

// ============================================================================
// Registration
// ============================================================================

registry.register("element.find", handleFind);
registry.register("element.findAll", handleFindAll);

registry.register("element.getProperty", handleGetProperty);
registry.register("element.setProperty", handleSetProperty);
registry.register("element.callMethod", handleCallMethod);

registry.register("element.subscribe", handleSubscribe);
registry.register("element.unsubscribe", handleUnsubscribe);
registry.register("element.watchRemoval", handleWatchRemoval);
registry.register("element.unwatchRemoval", handleUnwatchRemoval);
registry.register("element.watchAttribute", handleWatchAttribute);
registry.register("element.unwatchAttribute", handleUnwatchAttribute);

log.info("element module registered (11 handlers)");

// ============================================================================
// Exports
// ============================================================================

export {
  handleFind,
  handleFindAll,
  handleGetProperty,
  handleSetProperty,
  handleCallMethod,
  handleSubscribe,
  handleUnsubscribe,
  handleWatchRemoval,
  handleUnwatchRemoval,
  handleWatchAttribute,
  handleUnwatchAttribute,
};
