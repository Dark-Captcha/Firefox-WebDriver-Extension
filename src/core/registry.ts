/**
 * @fileoverview Handler registry for command dispatch.
 * @module core/registry
 */

// ============================================================================
// Imports
// ============================================================================

import type { RequestContext } from "../types/index.js";

import { createLogger } from "./logger.js";

// ============================================================================
// Types
// ============================================================================

/** Handler function signature. */
type Handler = (params: unknown, context: RequestContext) => Promise<unknown>;

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("Registry");

// ============================================================================
// Implementation
// ============================================================================

/**
 * Handler registry for command dispatch.
 */
class HandlerRegistry {
  private readonly handlers = new Map<string, Handler>();

  /**
   * Registers a handler for a method.
   *
   * @param method - Method name in module.methodName format
   * @param handler - Handler function
   * @throws Error if method already registered
   */
  register(method: string, handler: Handler): void {
    if (this.handlers.has(method)) {
      throw new Error(`Handler already registered: ${method}`);
    }
    this.handlers.set(method, handler);
    log.debug(`Registered: ${method}`);
  }

  /**
   * Dispatches a command to its handler.
   *
   * @param method - Method name in module.methodName format
   * @param params - Command parameters
   * @param context - Request context (tabId, frameId)
   * @returns Handler result
   * @throws Error if method not registered
   */
  async dispatch(
    method: string,
    params: unknown,
    context: RequestContext
  ): Promise<unknown> {
    const handler = this.handlers.get(method);
    if (!handler) {
      throw new Error(`Unknown method: ${method}`);
    }
    return handler(params, context);
  }

  /**
   * Checks if a method is registered.
   *
   * @param method - Method name to check
   * @returns True if registered
   */
  has(method: string): boolean {
    return this.handlers.has(method);
  }

  /**
   * Gets all registered method names.
   *
   * @returns Array of method names
   */
  getMethods(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Gets count of registered handlers.
   *
   * @returns Number of handlers
   */
  get size(): number {
    return this.handlers.size;
  }
}

// ============================================================================
// Exports
// ============================================================================

/** Global handler registry instance. */
const registry = new HandlerRegistry();

export type { Handler };

export { registry };
