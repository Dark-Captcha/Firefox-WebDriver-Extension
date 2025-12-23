/**
 * @fileoverview WebSocket session manager.
 * @module core/session
 */

// ============================================================================
// Imports
// ============================================================================

import type {
  Request,
  Response,
  Event,
  EventReply,
  RequestContext,
} from "../types/index.js";
import {
  successResponse,
  errorResponse,
  ErrorCode,
  isRequest,
  isEventReply,
  READY_REQUEST_ID,
  createTabId,
  createFrameId,
  generateRequestId,
} from "../types/index.js";

import { registry } from "./registry.js";
import { createLogger } from "./logger.js";

// ============================================================================
// Types
// ============================================================================

/** Pending event waiting for reply. */
interface PendingEvent {
  resolve: (reply: EventReply) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

/** Debug state for popup. */
interface DebugState {
  connected: boolean;
  sessionId: number | null;
  tabId: number | null;
  port: number | null;
  wsUrl: string | null;
  requests: number;
  errors: number;
  handlers: number;
  elements: number;
  totalTabs: number;
  tabProxy: string | null;
  windowProxy: string | null;
  blockUrls: string[];
  interceptRequests: boolean;
  interceptResponses: boolean;
  mutationObservers: string[];
  registeredHandlers: string[];
}

// ============================================================================
// Constants
// ============================================================================

const EVENT_TIMEOUT_MS = 30_000;

const log = createLogger("Session");

// ============================================================================
// Implementation
// ============================================================================

/**
 * WebSocket session manager (singleton).
 */
class Session {
  private static instance: Session | null = null;

  private ws: WebSocket | null = null;
  private wsUrl: string | null = null;
  private sessionId: number | null = null;
  private tabId: number | null = null;
  private requestCount = 0;
  private errorCount = 0;
  private readonly pendingEvents = new Map<string, PendingEvent>();

  private constructor() {}

  /**
   * Gets the singleton instance.
   *
   * @returns Session instance
   */
  static getInstance(): Session {
    if (!Session.instance) {
      Session.instance = new Session();
    }
    return Session.instance;
  }

  /**
   * Connects to WebSocket server.
   *
   * @param wsUrl - WebSocket URL
   * @param sessionId - Session ID from init message
   * @returns Promise that resolves when connected
   */
  async connect(wsUrl: string, sessionId: number): Promise<void> {
    this.wsUrl = wsUrl;
    this.sessionId = sessionId;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = async (): Promise<void> => {
        log.info("WebSocket connected", { wsUrl, sessionId });

        try {
          const [tab] = await browser.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (tab?.id !== undefined) {
            this.tabId = tab.id;
          }
        } catch {
          // May not have active tab yet
        }

        this.sendReady(sessionId);
        resolve();
      };

      this.ws.onmessage = async (event): Promise<void> => {
        try {
          const message = JSON.parse(event.data as string) as unknown;
          await this.handleMessage(message);
        } catch (err) {
          log.error("Failed to parse message", err);
        }
      };

      this.ws.onerror = (error): void => {
        log.error("WebSocket error", error);
        reject(new Error("WebSocket connection failed"));
      };

      this.ws.onclose = (): void => {
        log.info("WebSocket closed");
        this.ws = null;
        this.failAllPendingEvents();
      };
    });
  }

  /**
   * Checks if WebSocket is connected.
   *
   * @returns True if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Sends an event and waits for reply.
   *
   * @param eventMethod - Event method name
   * @param params - Event parameters
   * @returns Promise resolving to reply result
   */
  async sendEventWithReply<T>(
    eventMethod: string,
    params: Record<string, unknown>
  ): Promise<T> {
    if (!this.isConnected()) {
      throw new Error("WebSocket not connected");
    }

    const eventId = generateRequestId();
    const event: Event = {
      id: eventId,
      type: "event",
      method: eventMethod,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingEvents.delete(eventId);
        reject(
          new Error(
            `Event ${eventMethod} timed out after ${EVENT_TIMEOUT_MS}ms`
          )
        );
      }, EVENT_TIMEOUT_MS);

      this.pendingEvents.set(eventId, {
        resolve: (reply: EventReply) => resolve(reply.result as T),
        reject,
        timeoutId,
      });

      this.ws!.send(JSON.stringify(event));
    });
  }

  /**
   * Sends an event without waiting for reply.
   *
   * @param eventMethod - Event method name
   * @param params - Event parameters
   */
  sendEvent(eventMethod: string, params: Record<string, unknown>): void {
    if (!this.isConnected()) {
      log.warn(`Cannot send event ${eventMethod}: not connected`);
      return;
    }

    const eventId = generateRequestId();
    const event: Event = {
      id: eventId,
      type: "event",
      method: eventMethod,
      params,
    };

    this.ws!.send(JSON.stringify(event));
    log.debug(`Sent event: ${eventMethod}`, params);
  }

  /**
   * Gets debug state for popup.
   *
   * @returns Debug state
   */
  async getDebugState(): Promise<DebugState> {
    let port: number | null = null;
    if (this.wsUrl) {
      const match = this.wsUrl.match(/:(\d+)/);
      if (match?.[1]) {
        port = parseInt(match[1], 10);
      }
    }

    let currentTabId: number | null = null;
    let totalTabs = 0;
    try {
      const tabs = await browser.tabs.query({});
      totalTabs = tabs.length;

      const [activeTab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (activeTab?.id !== undefined) {
        currentTabId = activeTab.id;
      }
    } catch {
      // Ignore
    }

    const { getNetworkState } = await import(
      "../background/modules/network/index.js"
    );
    const { getProxyState } = await import(
      "../background/modules/proxy/index.js"
    );

    const networkState = getNetworkState();
    const proxyState = getProxyState();

    const formatProxy = (
      cfg: { type: string; host: string; port: number } | null
    ): string | null => {
      if (!cfg) return null;
      return `${cfg.type}://${cfg.host}:${cfg.port}`;
    };

    const currentTabProxy = currentTabId
      ? proxyState.tabProxies.find((p) => p.tabId === currentTabId)?.config
      : null;

    const interceptRequests = networkState.intercepts.some(
      (i) => i.config.interceptRequests
    );
    const interceptResponses = networkState.intercepts.some(
      (i) => i.config.interceptResponses
    );

    let elements = 0;
    let mutationObservers: string[] = [];

    if (currentTabId !== null) {
      try {
        const contentState = (await browser.tabs.sendMessage(currentTabId, {
          type: "GET_CONTENT_STATE",
        })) as { elementCount: number; subscriptions: string[] } | undefined;

        if (contentState) {
          elements = contentState.elementCount;
          mutationObservers = contentState.subscriptions;
        }
      } catch {
        // Content script may not be loaded
      }
    }

    return {
      connected: this.isConnected(),
      sessionId: this.sessionId,
      tabId: currentTabId,
      port,
      wsUrl: this.wsUrl,
      requests: this.requestCount,
      errors: this.errorCount,
      handlers: registry.size,
      elements,
      totalTabs,
      tabProxy: formatProxy(currentTabProxy ?? null),
      windowProxy: formatProxy(proxyState.windowProxy),
      blockUrls: networkState.blockPatterns,
      interceptRequests,
      interceptResponses,
      mutationObservers,
      registeredHandlers: registry.getMethods(),
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async handleMessage(message: unknown): Promise<void> {
    if (isEventReply(message)) {
      this.handleEventReply(message);
      return;
    }

    if (isRequest(message)) {
      await this.handleRequest(message);
      return;
    }

    log.warn("Unknown message type", message);
  }

  private async handleRequest(request: Request): Promise<void> {
    const { id, method, tabId, frameId, params } = request;
    log.debug(`Received: ${method}`, { tabId, frameId, params });
    this.requestCount++;

    const context: RequestContext = {
      tabId: createTabId(tabId),
      frameId: createFrameId(frameId),
    };

    try {
      const result = await registry.dispatch(method, params, context);
      log.debug(`Completed: ${method}`, { result });
      this.send(successResponse(id, result));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error(`Failed: ${method} - ${errorMsg}`, err);
      this.errorCount++;

      const errorCode = this.getErrorCode(err);
      this.send(errorResponse(id, errorCode, errorMsg));
    }
  }

  private getErrorCode(err: unknown): string {
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();
      if (msg.includes("unknown method")) return ErrorCode.UnknownCommand;
      if (msg.includes("element not found")) return ErrorCode.NoSuchElement;
      if (msg.includes("stale")) return ErrorCode.StaleElement;
      if (msg.includes("frame not found")) return ErrorCode.NoSuchFrame;
      if (msg.includes("tab not found")) return ErrorCode.NoSuchTab;
      if (msg.includes("timeout")) return ErrorCode.Timeout;
    }
    return ErrorCode.UnknownError;
  }

  private sendReady(sessionId: number): void {
    const response = successResponse(READY_REQUEST_ID, {
      sessionId,
      tabId: this.tabId,
    });
    this.send(response);
    log.info("Sent READY handshake", { sessionId, tabId: this.tabId });
  }

  private handleEventReply(reply: EventReply): void {
    const pending = this.pendingEvents.get(reply.id);
    if (pending) {
      clearTimeout(pending.timeoutId);
      this.pendingEvents.delete(reply.id);
      pending.resolve(reply);
      log.debug("Event reply received", {
        id: reply.id,
        replyTo: reply.replyTo,
      });
    } else {
      log.warn("Received reply for unknown event", { id: reply.id });
    }
  }

  private failAllPendingEvents(): void {
    const error = new Error("WebSocket connection closed");
    for (const [, pending] of this.pendingEvents) {
      clearTimeout(pending.timeoutId);
      pending.reject(error);
    }
    this.pendingEvents.clear();
  }

  private send(response: Response): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(response));
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

/** Global session instance. */
const session = Session.getInstance();

export type { DebugState };

export { session };
