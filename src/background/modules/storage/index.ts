/**
 * @fileoverview Storage module - cookies management.
 * @module modules/storage
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

interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
  expirationDate?: number;
}

interface GetCookieParams {
  name: string;
  url?: string;
}

interface SetCookieParams {
  cookie: Cookie;
  url?: string;
}

interface DeleteCookieParams {
  name: string;
  url?: string;
}

interface GetAllCookiesParams {
  url?: string;
}

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("Storage");

// ============================================================================
// Implementation - Helpers
// ============================================================================

async function getTabUrl(tabId: number): Promise<string | undefined> {
  try {
    const tab = await browser.tabs.get(tabId);
    return tab.url;
  } catch {
    return undefined;
  }
}

function firefoxCookieToOurs(cookie: browser.cookies.Cookie): Cookie {
  const result: Cookie = { name: cookie.name, value: cookie.value };

  if (cookie.domain) {
    result.domain = cookie.domain;
  }
  if (cookie.path) {
    result.path = cookie.path;
  }
  if (cookie.secure !== undefined) {
    result.secure = cookie.secure;
  }
  if (cookie.httpOnly !== undefined) {
    result.httpOnly = cookie.httpOnly;
  }
  if (cookie.sameSite) {
    result.sameSite = cookie.sameSite;
  }
  if (cookie.expirationDate !== undefined) {
    result.expirationDate = cookie.expirationDate;
  }

  return result;
}

function normalizeSameSite(sameSite: string): browser.cookies.SameSiteStatus {
  const lower = sameSite.toLowerCase();
  switch (lower) {
    case "strict":
      return "strict";
    case "lax":
      return "lax";
    case "none":
    case "no_restriction":
      return "no_restriction";
    default:
      return "lax";
  }
}

// ============================================================================
// Implementation - Handlers
// ============================================================================

async function handleGetCookie(
  params: unknown,
  ctx: RequestContext
): Promise<{ cookie: Cookie | null }> {
  const { name, url: providedUrl } = params as GetCookieParams;

  const url = providedUrl ?? (await getTabUrl(ctx.tabId));
  if (!url) {
    log.warn(`getCookie: No URL available for tab ${ctx.tabId}`);
    return { cookie: null };
  }

  log.debug(`getCookie: name=${name}, url=${url}`);

  try {
    const cookie = await browser.cookies.get({ name, url });
    if (!cookie) {
      return { cookie: null };
    }
    return { cookie: firefoxCookieToOurs(cookie) };
  } catch (error) {
    log.error(`getCookie failed: ${String(error)}`);
    return { cookie: null };
  }
}

async function handleSetCookie(
  params: unknown,
  ctx: RequestContext
): Promise<{ success: boolean }> {
  const { cookie, url: providedUrl } = params as SetCookieParams;

  const url = providedUrl ?? (await getTabUrl(ctx.tabId));
  if (!url) {
    log.warn(`setCookie: No URL available for tab ${ctx.tabId}`);
    return { success: false };
  }

  log.debug(`setCookie: name=${cookie.name}, url=${url}`);

  try {
    const details: browser.cookies._SetDetails = {
      url,
      name: cookie.name,
      value: cookie.value,
    };

    if (cookie.domain !== undefined) {
      details.domain = cookie.domain;
    }
    if (cookie.path !== undefined) {
      details.path = cookie.path;
    }
    if (cookie.secure !== undefined) {
      details.secure = cookie.secure;
    }
    if (cookie.httpOnly !== undefined) {
      details.httpOnly = cookie.httpOnly;
    }
    if (cookie.sameSite !== undefined) {
      details.sameSite = normalizeSameSite(cookie.sameSite);
    }
    if (cookie.expirationDate !== undefined) {
      details.expirationDate = cookie.expirationDate;
    }

    await browser.cookies.set(details);
    return { success: true };
  } catch (error) {
    log.error(`setCookie failed: ${String(error)}`);
    throw error;
  }
}

async function handleDeleteCookie(
  params: unknown,
  ctx: RequestContext
): Promise<{ success: boolean }> {
  const { name, url: providedUrl } = params as DeleteCookieParams;

  const url = providedUrl ?? (await getTabUrl(ctx.tabId));
  if (!url) {
    log.warn(`deleteCookie: No URL available for tab ${ctx.tabId}`);
    return { success: false };
  }

  log.debug(`deleteCookie: name=${name}, url=${url}`);

  try {
    await browser.cookies.remove({ name, url });
    return { success: true };
  } catch (error) {
    log.error(`deleteCookie failed: ${String(error)}`);
    throw error;
  }
}

async function handleGetAllCookies(
  params: unknown,
  ctx: RequestContext
): Promise<{ cookies: Cookie[] }> {
  const { url: providedUrl } = params as GetAllCookiesParams;

  const url = providedUrl ?? (await getTabUrl(ctx.tabId));
  if (!url) {
    log.warn(`getAllCookies: No URL available for tab ${ctx.tabId}`);
    return { cookies: [] };
  }

  log.debug(`getAllCookies: url=${url}`);

  try {
    const cookies = await browser.cookies.getAll({ url });
    return { cookies: cookies.map(firefoxCookieToOurs) };
  } catch (error) {
    log.error(`getAllCookies failed: ${String(error)}`);
    return { cookies: [] };
  }
}

// ============================================================================
// Registration
// ============================================================================

registry.register("storage.getCookie", handleGetCookie);
registry.register("storage.setCookie", handleSetCookie);
registry.register("storage.deleteCookie", handleDeleteCookie);
registry.register("storage.getAllCookies", handleGetAllCookies);

log.info("storage module registered (4 handlers)");

// ============================================================================
// Exports
// ============================================================================

export {
  handleGetCookie,
  handleSetCookie,
  handleDeleteCookie,
  handleGetAllCookies,
};
