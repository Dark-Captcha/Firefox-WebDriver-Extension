/**
 * @fileoverview Element observation handlers.
 * @module modules/element/observer
 */

// ============================================================================
// Imports
// ============================================================================

import type { TabId, FrameId } from "../../../types/identifiers.js";

import { createLogger } from "../../../core/logger.js";

// ============================================================================
// Types
// ============================================================================

interface SubscribeParams {
  selector: string;
  oneShot: boolean;
}

interface UnsubscribeParams {
  subscriptionId: string;
}

interface WatchRemovalParams {
  elementId: string;
}

interface UnwatchRemovalParams {
  elementId: string;
}

interface WatchAttributeParams {
  elementId: string;
  attributeName?: string;
}

interface UnwatchAttributeParams {
  elementId: string;
}

interface ContentResponse {
  success: boolean;
  subscriptionId?: string;
  elementId?: string;
  error?: string;
  code?: string;
}

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("Element/Observer");

// ============================================================================
// Implementation
// ============================================================================

async function handleSubscribe(
  params: unknown,
  context: { tabId: TabId; frameId: FrameId }
): Promise<{ subscriptionId: string; elementId?: string }> {
  const { selector, oneShot } = params as SubscribeParams;

  log.debug(
    `subscribe: selector="${selector}", oneShot=${oneShot}, tab=${context.tabId}`
  );

  const response = (await browser.tabs.sendMessage(
    context.tabId as number,
    { type: "ELEMENT_SUBSCRIBE", selector, oneShot },
    { frameId: context.frameId as number }
  )) as ContentResponse;

  if (!response.success) {
    throw new Error(response.error ?? "Subscribe failed");
  }

  log.debug(
    `subscribed: id=${response.subscriptionId}, elementId=${
      response.elementId ?? "none"
    }`
  );

  const result: { subscriptionId: string; elementId?: string } = {
    subscriptionId: response.subscriptionId!,
  };
  if (response.elementId !== undefined) {
    result.elementId = response.elementId;
  }
  return result;
}

async function handleUnsubscribe(
  params: unknown,
  context: { tabId: TabId; frameId: FrameId }
): Promise<void> {
  const { subscriptionId } = params as UnsubscribeParams;

  log.debug(`unsubscribe: id=${subscriptionId}, tab=${context.tabId}`);

  const response = (await browser.tabs.sendMessage(
    context.tabId as number,
    { type: "ELEMENT_UNSUBSCRIBE", subscriptionId },
    { frameId: context.frameId as number }
  )) as ContentResponse;

  if (!response.success) {
    throw new Error(response.error ?? "Unsubscribe failed");
  }

  log.debug(`unsubscribed: id=${subscriptionId}`);
}

async function handleWatchRemoval(
  params: unknown,
  context: { tabId: TabId; frameId: FrameId }
): Promise<void> {
  const { elementId } = params as WatchRemovalParams;

  log.debug(`watchRemoval: elementId=${elementId}, tab=${context.tabId}`);

  const response = (await browser.tabs.sendMessage(
    context.tabId as number,
    { type: "ELEMENT_WATCH_REMOVAL", elementId },
    { frameId: context.frameId as number }
  )) as ContentResponse;

  if (!response.success) {
    throw new Error(response.error ?? "Watch removal failed");
  }

  log.debug(`watching removal: elementId=${elementId}`);
}

async function handleUnwatchRemoval(
  params: unknown,
  context: { tabId: TabId; frameId: FrameId }
): Promise<void> {
  const { elementId } = params as UnwatchRemovalParams;

  log.debug(`unwatchRemoval: elementId=${elementId}, tab=${context.tabId}`);

  const response = (await browser.tabs.sendMessage(
    context.tabId as number,
    { type: "ELEMENT_UNWATCH_REMOVAL", elementId },
    { frameId: context.frameId as number }
  )) as ContentResponse;

  if (!response.success) {
    throw new Error(response.error ?? "Unwatch removal failed");
  }

  log.debug(`stopped watching removal: elementId=${elementId}`);
}

async function handleWatchAttribute(
  params: unknown,
  context: { tabId: TabId; frameId: FrameId }
): Promise<void> {
  const { elementId, attributeName } = params as WatchAttributeParams;

  log.debug(
    `watchAttribute: elementId=${elementId}, attr=${
      attributeName ?? "all"
    }, tab=${context.tabId}`
  );

  const response = (await browser.tabs.sendMessage(
    context.tabId as number,
    {
      type: "ELEMENT_WATCH_ATTRIBUTE",
      elementId,
      attributeName: attributeName ?? null,
    },
    { frameId: context.frameId as number }
  )) as ContentResponse;

  if (!response.success) {
    throw new Error(response.error ?? "Watch attribute failed");
  }

  log.debug(`watching attribute: elementId=${elementId}`);
}

async function handleUnwatchAttribute(
  params: unknown,
  context: { tabId: TabId; frameId: FrameId }
): Promise<void> {
  const { elementId } = params as UnwatchAttributeParams;

  log.debug(`unwatchAttribute: elementId=${elementId}, tab=${context.tabId}`);

  const response = (await browser.tabs.sendMessage(
    context.tabId as number,
    { type: "ELEMENT_UNWATCH_ATTRIBUTE", elementId },
    { frameId: context.frameId as number }
  )) as ContentResponse;

  if (!response.success) {
    throw new Error(response.error ?? "Unwatch attribute failed");
  }

  log.debug(`stopped watching attribute: elementId=${elementId}`);
}

// ============================================================================
// Exports
// ============================================================================

export {
  handleSubscribe,
  handleUnsubscribe,
  handleWatchRemoval,
  handleUnwatchRemoval,
  handleWatchAttribute,
  handleUnwatchAttribute,
};
