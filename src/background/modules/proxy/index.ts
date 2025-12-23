/**
 * @fileoverview Proxy module - per-tab and per-window proxy configuration.
 * @module modules/proxy
 */

// ============================================================================
// Imports
// ============================================================================

import { registry } from "../../../core/registry.js";
import { createLogger } from "../../../core/logger.js";
import type { RequestContext } from "../../../types/index.js";

// ============================================================================
// Types
// ============================================================================

type ProxyType = "direct" | "http" | "https" | "socks4" | "socks";

interface ProxyConfig {
  type: ProxyType;
  host: string;
  port: number;
  username?: string;
  password?: string;
  proxyDns?: boolean;
}

interface ProxyInfo {
  type: ProxyType;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  proxyDNS?: boolean;
  proxyAuthorizationHeader?: string;
}

interface SetProxyParams {
  type: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  proxyDns?: boolean;
}

interface ProxyState {
  windowProxy: ProxyConfig | null;
  tabProxies: Map<number, ProxyConfig>;
  httpCredentials: Map<string, { username: string; password: string }>;
  listenerActive: boolean;
  authListenerActive: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("Proxy");

// ============================================================================
// State
// ============================================================================

const state: ProxyState = {
  windowProxy: null,
  tabProxies: new Map(),
  httpCredentials: new Map(),
  listenerActive: false,
  authListenerActive: false,
};

// ============================================================================
// Implementation - Helpers
// ============================================================================

function normalizeProxyType(type: string): ProxyType {
  const lower = type.toLowerCase();
  switch (lower) {
    case "http":
      return "http";
    case "https":
      return "https";
    case "socks4":
      return "socks4";
    case "socks":
    case "socks5":
      return "socks";
    case "direct":
    default:
      return "direct";
  }
}

function configToProxyInfo(config: ProxyConfig): ProxyInfo {
  const info: ProxyInfo = {
    type: config.type,
    host: config.host,
    port: config.port,
  };

  if (
    (config.type === "socks" || config.type === "socks4") &&
    config.username &&
    config.password
  ) {
    info.username = config.username;
    info.password = config.password;
  }

  if (
    (config.type === "socks" || config.type === "socks4") &&
    config.proxyDns
  ) {
    info.proxyDNS = config.proxyDns;
  }

  if (
    (config.type === "http" || config.type === "https") &&
    config.username &&
    config.password
  ) {
    const credentials = btoa(`${config.username}:${config.password}`);
    info.proxyAuthorizationHeader = `Basic ${credentials}`;
  }

  return info;
}

function storeHttpCredentials(config: ProxyConfig): void {
  if (
    (config.type === "http" || config.type === "https") &&
    config.username &&
    config.password
  ) {
    const key = `${config.host}:${config.port}`;
    state.httpCredentials.set(key, {
      username: config.username,
      password: config.password,
    });
    log.debug(`Stored HTTP credentials for ${key}`);
  }
}

function removeHttpCredentials(config: ProxyConfig | null): void {
  if (config && (config.type === "http" || config.type === "https")) {
    const key = `${config.host}:${config.port}`;
    state.httpCredentials.delete(key);
    log.debug(`Removed HTTP credentials for ${key}`);
  }
}

// ============================================================================
// Implementation - Request Handlers
// ============================================================================

function handleProxyRequest(
  details: browser.proxy._OnRequestDetails
): ProxyInfo | ProxyInfo[] {
  const { tabId } = details;

  if (tabId < 0) {
    return { type: "direct" };
  }

  const tabProxy = state.tabProxies.get(tabId);
  if (tabProxy) {
    log.debug(
      `Using tab proxy for tab ${tabId}: ${tabProxy.type}://${tabProxy.host}:${tabProxy.port}`
    );
    return configToProxyInfo(tabProxy);
  }

  if (state.windowProxy) {
    log.debug(
      `Using window proxy for tab ${tabId}: ${state.windowProxy.type}://${state.windowProxy.host}:${state.windowProxy.port}`
    );
    return configToProxyInfo(state.windowProxy);
  }

  return { type: "direct" };
}

function handleAuthRequired(
  details: browser.webRequest._OnAuthRequiredDetails
):
  | browser.webRequest.BlockingResponse
  | Promise<browser.webRequest.BlockingResponse> {
  if (!details.isProxy) {
    return {};
  }

  const { challenger } = details;
  if (!challenger) {
    return {};
  }

  const key = `${challenger.host}:${challenger.port}`;
  const creds = state.httpCredentials.get(key);

  if (creds) {
    log.debug(`Providing auth for proxy ${key}`);
    return {
      authCredentials: { username: creds.username, password: creds.password },
    };
  }

  log.warn(`No credentials found for proxy ${key}`);
  return {};
}

// ============================================================================
// Implementation - Listener Management
// ============================================================================

function updateListeners(): void {
  const needProxy = state.windowProxy !== null || state.tabProxies.size > 0;
  const needAuth = state.httpCredentials.size > 0;

  if (needProxy && !state.listenerActive) {
    browser.proxy.onRequest.addListener(handleProxyRequest, {
      urls: ["<all_urls>"],
    });
    state.listenerActive = true;
    log.debug("Proxy listener added");
  } else if (!needProxy && state.listenerActive) {
    browser.proxy.onRequest.removeListener(handleProxyRequest);
    state.listenerActive = false;
    log.debug("Proxy listener removed");
  }

  if (needAuth && !state.authListenerActive) {
    browser.webRequest.onAuthRequired.addListener(
      handleAuthRequired,
      { urls: ["<all_urls>"] },
      ["blocking"]
    );
    state.authListenerActive = true;
    log.debug("Auth listener added");
  } else if (!needAuth && state.authListenerActive) {
    browser.webRequest.onAuthRequired.removeListener(handleAuthRequired);
    state.authListenerActive = false;
    log.debug("Auth listener removed");
  }
}

// ============================================================================
// Implementation - Command Handlers
// ============================================================================

function handleSetWindowProxy(
  params: unknown,
  _ctx: RequestContext
): Promise<{ active: boolean; type: string; host: string; port: number }> {
  const { type, host, port, username, password, proxyDns } =
    params as SetProxyParams;

  log.info(`setWindowProxy: ${type}://${host}:${port}`);

  removeHttpCredentials(state.windowProxy);

  const config: ProxyConfig = { type: normalizeProxyType(type), host, port };
  if (username !== undefined) config.username = username;
  if (password !== undefined) config.password = password;
  if (proxyDns !== undefined) config.proxyDns = proxyDns;

  state.windowProxy = config;
  storeHttpCredentials(config);
  updateListeners();

  return Promise.resolve({
    active: true,
    type: config.type,
    host: config.host,
    port: config.port,
  });
}

function handleClearWindowProxy(
  _params: unknown,
  _ctx: RequestContext
): Promise<{ cleared: boolean }> {
  log.info("clearWindowProxy");

  const wasActive = state.windowProxy !== null;
  removeHttpCredentials(state.windowProxy);
  state.windowProxy = null;
  updateListeners();

  return Promise.resolve({ cleared: wasActive });
}

function handleSetTabProxy(
  params: unknown,
  ctx: RequestContext
): Promise<{
  active: boolean;
  tabId: number;
  type: string;
  host: string;
  port: number;
}> {
  const { type, host, port, username, password, proxyDns } =
    params as SetProxyParams;
  const tabId = ctx.tabId;

  log.info(`setTabProxy: tab=${tabId}, ${type}://${host}:${port}`);

  const oldConfig = state.tabProxies.get(tabId);
  removeHttpCredentials(oldConfig ?? null);

  const config: ProxyConfig = { type: normalizeProxyType(type), host, port };
  if (username !== undefined) config.username = username;
  if (password !== undefined) config.password = password;
  if (proxyDns !== undefined) config.proxyDns = proxyDns;

  state.tabProxies.set(tabId, config);
  storeHttpCredentials(config);
  updateListeners();

  return Promise.resolve({
    active: true,
    tabId,
    type: config.type,
    host: config.host,
    port: config.port,
  });
}

function handleClearTabProxy(
  _params: unknown,
  ctx: RequestContext
): Promise<{ cleared: boolean; tabId: number }> {
  const tabId = ctx.tabId;

  log.info(`clearTabProxy: tab=${tabId}`);

  const oldConfig = state.tabProxies.get(tabId);
  const wasActive = oldConfig !== undefined;

  removeHttpCredentials(oldConfig ?? null);
  state.tabProxies.delete(tabId);
  updateListeners();

  return Promise.resolve({ cleared: wasActive, tabId });
}

// ============================================================================
// Tab Cleanup
// ============================================================================

browser.tabs.onRemoved.addListener((tabId) => {
  const config = state.tabProxies.get(tabId);
  if (config) {
    log.debug(`Cleaning up proxy for closed tab ${tabId}`);
    removeHttpCredentials(config);
    state.tabProxies.delete(tabId);
    updateListeners();
  }
});

// ============================================================================
// State Access
// ============================================================================

function getProxyState(): {
  windowProxy: ProxyConfig | null;
  tabProxies: Array<{ tabId: number; config: ProxyConfig }>;
  listenerActive: boolean;
} {
  return {
    windowProxy: state.windowProxy,
    tabProxies: Array.from(state.tabProxies.entries()).map(
      ([tabId, config]) => ({ tabId, config })
    ),
    listenerActive: state.listenerActive,
  };
}

// ============================================================================
// Registration
// ============================================================================

registry.register("proxy.setWindowProxy", handleSetWindowProxy);
registry.register("proxy.clearWindowProxy", handleClearWindowProxy);
registry.register("proxy.setTabProxy", handleSetTabProxy);
registry.register("proxy.clearTabProxy", handleClearTabProxy);

log.info("proxy module registered (4 handlers)");

// ============================================================================
// Exports
// ============================================================================

export {
  handleSetWindowProxy,
  handleClearWindowProxy,
  handleSetTabProxy,
  handleClearTabProxy,
  getProxyState,
};
