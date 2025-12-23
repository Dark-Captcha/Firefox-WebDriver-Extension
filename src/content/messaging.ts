/**
 * @fileoverview Central messaging hub for content scripts.
 * @module content/messaging
 */

// ============================================================================
// Types
// ============================================================================

/** Log message. */
interface ContentLogMessage {
  type: "CONTENT_LOG";
  level: "debug" | "info" | "warn" | "error";
  module: string;
  message: string;
  data?: unknown;
}

/** Event message. */
interface ContentEventMessage {
  type: "CONTENT_EVENT";
  method: string;
  params: Record<string, unknown>;
}

/** WebDriver init message. */
interface WebDriverInitMessage {
  type: "WEBDRIVER_INIT";
  wsUrl: string;
  sessionId: number;
}

type OutgoingMessage =
  | ContentLogMessage
  | ContentEventMessage
  | WebDriverInitMessage;

/** Content state for debug popup. */
interface ContentState {
  elementCount: number;
  subscriptionCount: number;
  subscriptions: string[];
}

/** State provider function. */
type StateProvider = () => Partial<ContentState>;

/** Message handler function. */
type MessageHandler<T = unknown, R = unknown> = (message: T) => R | Promise<R>;

// ============================================================================
// State
// ============================================================================

const handlers = new Map<string, MessageHandler>();
const stateProviders: StateProvider[] = [];
let initialized = false;

// ============================================================================
// Implementation - Send Functions
// ============================================================================

/**
 * Sends message to background (fire and forget).
 *
 * @param message - Message to send
 */
function send(message: OutgoingMessage): void {
  try {
    browser.runtime.sendMessage(message).catch(() => {
      // Ignore - background may not be ready
    });
  } catch {
    // Ignore
  }
}

/**
 * Sends message to background and waits for response.
 *
 * @param message - Message to send
 * @returns Promise resolving to response
 */
async function sendWithResponse<T>(message: OutgoingMessage): Promise<T> {
  return browser.runtime.sendMessage(message) as Promise<T>;
}

// ============================================================================
// Implementation - Public API
// ============================================================================

/**
 * Sends log to background.
 *
 * @param level - Log level
 * @param module - Module name
 * @param message - Log message
 * @param data - Optional data
 */
function sendLog(
  level: "debug" | "info" | "warn" | "error",
  module: string,
  message: string,
  data?: unknown
): void {
  send({ type: "CONTENT_LOG", level, module, message, data });
}

/**
 * Sends event to background.
 *
 * @param method - Event method name
 * @param params - Event parameters
 */
function sendEvent(method: string, params: Record<string, unknown>): void {
  send({ type: "CONTENT_EVENT", method, params });
}

/**
 * Sends WebDriver init to background.
 *
 * @param wsUrl - WebSocket URL
 * @param sessionId - Session ID
 * @returns Promise resolving to init result
 */
async function sendInit(
  wsUrl: string,
  sessionId: number
): Promise<{ success: boolean; error?: string }> {
  return sendWithResponse({ type: "WEBDRIVER_INIT", wsUrl, sessionId });
}

/**
 * Registers a message handler.
 *
 * @param type - Message type to handle
 * @param handler - Handler function
 */
function registerHandler<T, R>(
  type: string,
  handler: MessageHandler<T, R>
): void {
  handlers.set(type, handler as MessageHandler);
}

/**
 * Unregisters a message handler.
 *
 * @param type - Message type to unregister
 */
function unregisterHandler(type: string): void {
  handlers.delete(type);
}

/**
 * Registers a state provider for GET_CONTENT_STATE.
 *
 * @param provider - State provider function
 */
function registerStateProvider(provider: StateProvider): void {
  stateProviders.push(provider);
}

// ============================================================================
// Implementation - Internal
// ============================================================================

/**
 * Handles GET_CONTENT_STATE by aggregating all state providers.
 *
 * @returns Aggregated content state
 */
function handleGetContentState(): ContentState {
  const state: ContentState = {
    elementCount: 0,
    subscriptionCount: 0,
    subscriptions: [],
  };

  for (const provider of stateProviders) {
    const partial = provider();
    if (partial.elementCount !== undefined) {
      state.elementCount = partial.elementCount;
    }
    if (partial.subscriptionCount !== undefined) {
      state.subscriptionCount = partial.subscriptionCount;
    }
    if (partial.subscriptions !== undefined) {
      state.subscriptions = partial.subscriptions;
    }
  }

  return state;
}

/**
 * Dispatches incoming message to registered handler.
 *
 * @param message - Incoming message
 * @returns Promise resolving to handler result
 */
function dispatch(message: unknown): Promise<unknown> | undefined {
  if (typeof message !== "object" || message === null) {
    return undefined;
  }

  const msg = message as { type?: string };
  if (!msg.type) {
    return undefined;
  }

  if (msg.type === "GET_CONTENT_STATE") {
    return Promise.resolve(handleGetContentState());
  }

  const handler = handlers.get(msg.type);
  if (handler) {
    const result = handler(message);
    return result instanceof Promise ? result : Promise.resolve(result);
  }

  return undefined;
}

/**
 * Initializes the messaging hub.
 */
function initMessaging(): void {
  if (initialized) {
    return;
  }

  browser.runtime.onMessage.addListener(
    (message: unknown): Promise<unknown> | undefined => {
      return dispatch(message);
    }
  );

  initialized = true;
}

/**
 * Gets registered handler types.
 *
 * @returns Array of registered handler types
 */
function getRegisteredHandlers(): string[] {
  return Array.from(handlers.keys());
}

// ============================================================================
// Exports
// ============================================================================

export type { ContentState, MessageHandler };

export {
  sendLog,
  sendEvent,
  sendInit,
  registerHandler,
  unregisterHandler,
  registerStateProvider,
  initMessaging,
  getRegisteredHandlers,
};
