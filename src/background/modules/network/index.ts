/**
 * @fileoverview Network module - request/response interception and blocking.
 * @module modules/network
 */

// ============================================================================
// Imports
// ============================================================================

import { registry } from "../../../core/registry.js";
import { session } from "../../../core/session.js";
import { createLogger } from "../../../core/logger.js";
import { patternToRegex } from "../../../core/utils.js";
import type { RequestContext } from "../../../types/index.js";
import type { InterceptId } from "../../../types/identifiers.js";
import { generateInterceptId } from "../../../types/identifiers.js";

// ============================================================================
// Types
// ============================================================================

interface RequestAction {
  action: "allow" | "block" | "redirect";
  url?: string;
}

interface HeadersAction {
  action: "allow" | "modifyHeaders";
  headers?: Record<string, string>;
}

interface BodyAction {
  action: "allow" | "modifyBody";
  body?: string;
}

interface RequestBody {
  formData?: Record<string, string[]> | undefined;
  raw?: Array<{ bytes?: ArrayBuffer; file?: string }> | undefined;
  error?: string | undefined;
}

interface InterceptConfig {
  interceptRequests: boolean;
  interceptRequestHeaders: boolean;
  interceptRequestBody: boolean;
  interceptResponses: boolean;
  interceptResponseBody: boolean;
}

interface NetworkState {
  blockPatterns: string[];
  blockRegexes: RegExp[];
  intercepts: Map<InterceptId, InterceptConfig>;
  beforeRequestListener:
    | ((
        details: browser.webRequest._OnBeforeRequestDetails
      ) =>
        | browser.webRequest.BlockingResponse
        | Promise<browser.webRequest.BlockingResponse>)
    | null;
  beforeSendHeadersListener:
    | ((
        details: browser.webRequest._OnBeforeSendHeadersDetails
      ) =>
        | browser.webRequest.BlockingResponse
        | Promise<browser.webRequest.BlockingResponse>)
    | null;
  headersReceivedListener:
    | ((
        details: browser.webRequest._OnHeadersReceivedDetails
      ) =>
        | browser.webRequest.BlockingResponse
        | Promise<browser.webRequest.BlockingResponse>)
    | null;
  activeFilters: Map<string, browser.webRequest.StreamFilter>;
}

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("Network");

// ============================================================================
// State
// ============================================================================

const state: NetworkState = {
  blockPatterns: [],
  blockRegexes: [],
  intercepts: new Map(),
  beforeRequestListener: null,
  beforeSendHeadersListener: null,
  headersReceivedListener: null,
  activeFilters: new Map(),
};

// ============================================================================
// Implementation - Helpers
// ============================================================================

function hasActiveIntercept(flag: keyof InterceptConfig): boolean {
  for (const config of state.intercepts.values()) {
    if (config[flag]) {
      return true;
    }
  }
  return false;
}

function applyRequestAction(
  action: RequestAction
): browser.webRequest.BlockingResponse {
  switch (action.action) {
    case "block":
      return { cancel: true };
    case "redirect":
      return action.url ? { redirectUrl: action.url } : {};
    case "allow":
    default:
      return {};
  }
}

function mapResourceType(type: browser.webRequest.ResourceType): string {
  const mapping: Record<string, string> = {
    main_frame: "document",
    sub_frame: "iframe",
    stylesheet: "stylesheet",
    script: "script",
    image: "image",
    font: "font",
    object: "object",
    xmlhttprequest: "xhr",
    ping: "ping",
    media: "media",
    websocket: "websocket",
    other: "other",
  };
  return mapping[type] ?? "other";
}

function headersToRecord(
  headers?: browser.webRequest.HttpHeaders
): Record<string, string> {
  const result: Record<string, string> = {};
  if (headers) {
    for (const header of headers) {
      if (header.value !== undefined) {
        result[header.name] = header.value;
      }
    }
  }
  return result;
}

function recordToHeaders(
  record: Record<string, string>
): browser.webRequest.HttpHeaders {
  return Object.entries(record).map(([name, value]) => ({ name, value }));
}

function mergeHeaders(
  original: browser.webRequest.HttpHeaders | undefined,
  modified: Record<string, string>
): browser.webRequest.HttpHeaders {
  const result: browser.webRequest.HttpHeaders = [];
  const modifiedNames = new Set(
    Object.keys(modified).map((n) => n.toLowerCase())
  );

  if (original) {
    for (const header of original) {
      if (!modifiedNames.has(header.name.toLowerCase())) {
        result.push(header);
      }
    }
  }

  for (const [name, value] of Object.entries(modified)) {
    result.push({ name, value });
  }

  return result;
}

function serializeRequestBody(
  body: RequestBody
): Record<string, unknown> | null {
  if (body.error) {
    return { error: body.error };
  }
  if (body.formData) {
    return { type: "formData", data: body.formData };
  }
  if (body.raw && body.raw.length > 0) {
    const rawData = body.raw
      .map((r) => {
        if (r.bytes) {
          const bytes = new Uint8Array(r.bytes);
          return { type: "bytes", data: btoa(String.fromCharCode(...bytes)) };
        }
        if (r.file) {
          return { type: "file", path: r.file };
        }
        return null;
      })
      .filter(Boolean);
    return { type: "raw", data: rawData };
  }
  return null;
}

function getContentType(headers?: browser.webRequest.HttpHeaders): string {
  if (!headers) return "";
  for (const header of headers) {
    if (header.name.toLowerCase() === "content-type") {
      return header.value ?? "";
    }
  }
  return "";
}

function isTextContent(contentType: string): boolean {
  const textTypes = [
    "text/",
    "application/json",
    "application/javascript",
    "application/xml",
    "application/xhtml",
    "application/x-www-form-urlencoded",
  ];
  const lower = contentType.toLowerCase();
  return textTypes.some((t) => lower.includes(t));
}

// ============================================================================
// Implementation - Listener Factories
// ============================================================================

function createBeforeRequestListener(): (
  details: browser.webRequest._OnBeforeRequestDetails
) =>
  | browser.webRequest.BlockingResponse
  | Promise<browser.webRequest.BlockingResponse> {
  return (details) => {
    if (details.tabId < 0) return {};

    const url = details.url;

    for (let i = 0; i < state.blockRegexes.length; i++) {
      const regex = state.blockRegexes[i];
      if (regex?.test(url)) {
        log.debug(
          `Blocked by rule: ${url} (pattern: ${state.blockPatterns[i]})`
        );
        return { cancel: true };
      }
    }

    let body: RequestBody | null = null;
    if (details.requestBody) {
      const rawData = details.requestBody.raw?.map((r) => {
        const item: { bytes?: ArrayBuffer; file?: string } = {};
        if (r.bytes !== undefined) item.bytes = r.bytes;
        if (r.file !== undefined) item.file = r.file;
        return item;
      });
      body = {
        formData: details.requestBody.formData as
          | Record<string, string[]>
          | undefined,
        raw: rawData,
        error: details.requestBody.error,
      };
    }

    if (hasActiveIntercept("interceptRequestBody") && session.isConnected()) {
      const bodyEventParams = {
        requestId: details.requestId,
        url: details.url,
        method: details.method ?? "GET",
        resourceType: mapResourceType(details.type),
        tabId: details.tabId,
        frameId: details.frameId ?? 0,
        body: body ? serializeRequestBody(body) : null,
      };

      log.debug(`Logging request body: ${details.method} ${details.url}`);
      session.sendEvent(
        "network.requestBody",
        bodyEventParams as unknown as Record<string, unknown>
      );
    }

    if (hasActiveIntercept("interceptRequests")) {
      if (!session.isConnected()) {
        log.warn("WebSocket not connected, allowing request");
        return {};
      }

      const eventParams = {
        requestId: details.requestId,
        url: details.url,
        method: details.method ?? "GET",
        resourceType: mapResourceType(details.type),
        tabId: details.tabId,
        frameId: details.frameId ?? 0,
        body: body ? serializeRequestBody(body) : null,
      };

      log.debug(`Intercepting request: ${details.method} ${details.url}`);

      return session
        .sendEventWithReply<RequestAction>(
          "network.beforeRequestSent",
          eventParams as unknown as Record<string, unknown>
        )
        .then((action: RequestAction) => {
          log.debug(`Request action for ${details.url}: ${action.action}`);
          return applyRequestAction(action);
        })
        .catch((err: unknown) => {
          log.error("Failed to get request action:", err);
          return {};
        });
    }

    return {};
  };
}

function createBeforeSendHeadersListener(): (
  details: browser.webRequest._OnBeforeSendHeadersDetails
) =>
  | browser.webRequest.BlockingResponse
  | Promise<browser.webRequest.BlockingResponse> {
  return (details) => {
    if (details.tabId < 0) return {};

    if (!hasActiveIntercept("interceptRequestHeaders")) {
      return {};
    }

    if (!session.isConnected()) {
      log.warn("WebSocket not connected, allowing headers");
      return {};
    }

    const eventParams = {
      requestId: details.requestId,
      url: details.url,
      method: details.method ?? "GET",
      headers: headersToRecord(details.requestHeaders),
      tabId: details.tabId,
      frameId: details.frameId ?? 0,
    };

    log.debug(`Intercepting request headers: ${details.url}`);

    return session
      .sendEventWithReply<HeadersAction>(
        "network.requestHeaders",
        eventParams as unknown as Record<string, unknown>
      )
      .then((action: HeadersAction) => {
        log.debug(`Headers action for ${details.url}: ${action.action}`);
        if (action.action === "modifyHeaders" && action.headers) {
          return { requestHeaders: recordToHeaders(action.headers) };
        }
        return {};
      })
      .catch((err: unknown) => {
        log.error("Failed to get headers action:", err);
        return {};
      });
  };
}

function createHeadersReceivedListener(): (
  details: browser.webRequest._OnHeadersReceivedDetails
) =>
  | browser.webRequest.BlockingResponse
  | Promise<browser.webRequest.BlockingResponse> {
  return (details) => {
    if (details.tabId < 0) return {};

    if (hasActiveIntercept("interceptResponseBody")) {
      const contentType = getContentType(details.responseHeaders);
      if (isTextContent(contentType)) {
        startResponseBodyFilter(
          details.requestId,
          details.url,
          details.tabId,
          details.frameId ?? 0
        );
      }
    }

    if (!hasActiveIntercept("interceptResponses")) {
      return {};
    }

    if (!session.isConnected()) {
      log.warn("WebSocket not connected, allowing response");
      return {};
    }

    const eventParams = {
      requestId: details.requestId,
      url: details.url,
      status: details.statusCode,
      statusText: details.statusLine ?? "",
      headers: headersToRecord(details.responseHeaders),
      tabId: details.tabId,
      frameId: details.frameId ?? 0,
    };

    log.debug(
      `Intercepting response headers: ${details.statusCode} ${details.url}`
    );

    return session
      .sendEventWithReply<HeadersAction>(
        "network.responseHeaders",
        eventParams as unknown as Record<string, unknown>
      )
      .then((action: HeadersAction) => {
        log.debug(
          `Response headers action for ${details.url}: ${action.action}`
        );
        if (action.action === "modifyHeaders" && action.headers) {
          const responseHeaders = mergeHeaders(
            details.responseHeaders,
            action.headers
          );
          return { responseHeaders };
        }
        return {};
      })
      .catch((err: unknown) => {
        log.error("Failed to get response headers action:", err);
        return {};
      });
  };
}

// ============================================================================
// Implementation - Response Body Filter
// ============================================================================

function startResponseBodyFilter(
  requestId: string,
  url: string,
  tabId: number,
  frameId: number
): void {
  try {
    const filter = browser.webRequest.filterResponseData(requestId);
    state.activeFilters.set(requestId, filter);

    const chunks: Uint8Array[] = [];
    const decoder = new TextDecoder("utf-8");
    const encoder = new TextEncoder();

    filter.ondata = (event: { data: ArrayBuffer }): void => {
      chunks.push(new Uint8Array(event.data));
    };

    filter.onstop = (): void => {
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const originalBody = decoder.decode(combined);

      if (session.isConnected()) {
        const eventParams = {
          requestId,
          url,
          tabId,
          frameId,
          body: originalBody,
          contentLength: totalLength,
        };

        session
          .sendEventWithReply<BodyAction>(
            "network.responseBody",
            eventParams as unknown as Record<string, unknown>
          )
          .then((action: BodyAction) => {
            if (action.action === "modifyBody" && action.body !== undefined) {
              log.debug(`Modified response body for ${url}`);
              filter.write(encoder.encode(action.body));
            } else {
              filter.write(combined);
            }
            filter.close();
          })
          .catch((err: unknown) => {
            log.error("Failed to get body action:", err);
            filter.write(combined);
            filter.close();
          });
      } else {
        filter.write(combined);
        filter.close();
      }

      state.activeFilters.delete(requestId);
    };

    filter.onerror = (): void => {
      log.error(`Filter error for ${url}`);
      state.activeFilters.delete(requestId);
    };
  } catch (err) {
    log.error("Failed to create response filter:", err);
  }
}

// ============================================================================
// Implementation - Listener Management
// ============================================================================

function updateListeners(): void {
  const needBeforeRequest =
    state.blockPatterns.length > 0 ||
    hasActiveIntercept("interceptRequests") ||
    hasActiveIntercept("interceptRequestBody");

  if (needBeforeRequest && !state.beforeRequestListener) {
    state.beforeRequestListener = createBeforeRequestListener();
    browser.webRequest.onBeforeRequest.addListener(
      state.beforeRequestListener,
      { urls: ["<all_urls>"] },
      ["blocking", "requestBody"]
    );
    log.debug("onBeforeRequest listener added");
  } else if (!needBeforeRequest && state.beforeRequestListener) {
    browser.webRequest.onBeforeRequest.removeListener(
      state.beforeRequestListener
    );
    state.beforeRequestListener = null;
    log.debug("onBeforeRequest listener removed");
  }

  const needBeforeSendHeaders = hasActiveIntercept("interceptRequestHeaders");

  if (needBeforeSendHeaders && !state.beforeSendHeadersListener) {
    state.beforeSendHeadersListener = createBeforeSendHeadersListener();
    browser.webRequest.onBeforeSendHeaders.addListener(
      state.beforeSendHeadersListener,
      { urls: ["<all_urls>"] },
      ["blocking", "requestHeaders"]
    );
    log.debug("onBeforeSendHeaders listener added");
  } else if (!needBeforeSendHeaders && state.beforeSendHeadersListener) {
    browser.webRequest.onBeforeSendHeaders.removeListener(
      state.beforeSendHeadersListener
    );
    state.beforeSendHeadersListener = null;
    log.debug("onBeforeSendHeaders listener removed");
  }

  const needHeadersReceived =
    hasActiveIntercept("interceptResponses") ||
    hasActiveIntercept("interceptResponseBody");

  if (needHeadersReceived && !state.headersReceivedListener) {
    state.headersReceivedListener = createHeadersReceivedListener();
    browser.webRequest.onHeadersReceived.addListener(
      state.headersReceivedListener,
      { urls: ["<all_urls>"] },
      ["blocking", "responseHeaders"]
    );
    log.debug("onHeadersReceived listener added");
  } else if (!needHeadersReceived && state.headersReceivedListener) {
    browser.webRequest.onHeadersReceived.removeListener(
      state.headersReceivedListener
    );
    state.headersReceivedListener = null;
    log.debug("onHeadersReceived listener removed");
  }
}

// ============================================================================
// Implementation - Command Handlers
// ============================================================================

interface AddInterceptParams {
  interceptRequests?: boolean;
  interceptRequestHeaders?: boolean;
  interceptRequestBody?: boolean;
  interceptResponses?: boolean;
  interceptResponseBody?: boolean;
}

interface RemoveInterceptParams {
  interceptId: string;
}

function handleAddIntercept(
  params: unknown,
  _ctx: RequestContext
): Promise<{
  interceptId: string;
  interceptRequests: boolean;
  interceptRequestHeaders: boolean;
  interceptRequestBody: boolean;
  interceptResponses: boolean;
  interceptResponseBody: boolean;
}> {
  const {
    interceptRequests = false,
    interceptRequestHeaders = false,
    interceptRequestBody = false,
    interceptResponses = false,
    interceptResponseBody = false,
  } = (params as AddInterceptParams) || {};

  const interceptId = generateInterceptId();

  const config: InterceptConfig = {
    interceptRequests,
    interceptRequestHeaders,
    interceptRequestBody,
    interceptResponses,
    interceptResponseBody,
  };

  state.intercepts.set(interceptId, config);

  log.info(
    `addIntercept: id=${interceptId}, requests=${interceptRequests}, reqHeaders=${interceptRequestHeaders}, reqBody=${interceptRequestBody}, responses=${interceptResponses}, resBody=${interceptResponseBody}`
  );

  updateListeners();

  return Promise.resolve({
    interceptId,
    interceptRequests,
    interceptRequestHeaders,
    interceptRequestBody,
    interceptResponses,
    interceptResponseBody,
  });
}

function handleRemoveIntercept(
  params: unknown,
  _ctx: RequestContext
): Promise<{ removed: boolean; interceptId: string }> {
  const { interceptId } = (params as RemoveInterceptParams) || {};

  if (!interceptId) {
    throw new Error("interceptId is required");
  }

  const existed = state.intercepts.delete(interceptId as InterceptId);

  log.info(`removeIntercept: id=${interceptId}, existed=${existed}`);

  if (!hasActiveIntercept("interceptResponseBody")) {
    for (const filter of state.activeFilters.values()) {
      try {
        filter.disconnect();
      } catch {
        // Ignore
      }
    }
    state.activeFilters.clear();
  }

  updateListeners();

  return Promise.resolve({ removed: existed, interceptId });
}

function handleSetBlockRules(
  params: unknown,
  _ctx: RequestContext
): Promise<{ count: number; patterns: string[] }> {
  const { patterns = [] } = (params as { patterns?: string[] }) || {};

  log.info(`setBlockRules: ${patterns.length} patterns`);

  state.blockPatterns = patterns;
  state.blockRegexes = patterns.map(patternToRegex);

  for (const pattern of patterns) {
    log.debug(`  Block pattern: ${pattern}`);
  }

  updateListeners();

  return Promise.resolve({
    count: state.blockPatterns.length,
    patterns: state.blockPatterns,
  });
}

function handleClearBlockRules(
  _params: unknown,
  _ctx: RequestContext
): Promise<{ cleared: number }> {
  log.info("clearBlockRules");

  const clearedCount = state.blockPatterns.length;

  state.blockPatterns = [];
  state.blockRegexes = [];

  updateListeners();

  return Promise.resolve({ cleared: clearedCount });
}

// ============================================================================
// State Access
// ============================================================================

function getNetworkState(): {
  blockPatterns: string[];
  interceptCount: number;
  intercepts: Array<{ id: string; config: InterceptConfig }>;
} {
  const intercepts = Array.from(state.intercepts.entries()).map(
    ([id, config]) => ({ id, config })
  );

  return {
    blockPatterns: [...state.blockPatterns],
    interceptCount: state.intercepts.size,
    intercepts,
  };
}

// ============================================================================
// Registration
// ============================================================================

registry.register("network.addIntercept", handleAddIntercept);
registry.register("network.removeIntercept", handleRemoveIntercept);
registry.register("network.setBlockRules", handleSetBlockRules);
registry.register("network.clearBlockRules", handleClearBlockRules);

log.info("network module registered (4 handlers)");

// ============================================================================
// Exports
// ============================================================================

export {
  handleAddIntercept,
  handleRemoveIntercept,
  handleSetBlockRules,
  handleClearBlockRules,
  getNetworkState,
};
