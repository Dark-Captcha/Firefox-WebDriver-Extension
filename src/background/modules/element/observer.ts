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
  strategy: string;
  value: string;
  oneShot: boolean;
  timeout?: number;
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
// State - Active subscriptions that need to survive navigation
// ============================================================================

interface ActiveSubscription {
  subscriptionId: string;
  strategy: string;
  value: string;
  oneShot: boolean;
  tabId: number;
  frameId: number;
  resolve: (result: { subscriptionId: string; elementId?: string }) => void;
  reject: (error: Error) => void;
  resolved: boolean;
  timeoutId?: ReturnType<typeof setTimeout>;
}

// Map of tabId -> active subscriptions waiting for element
const activeSubscriptions = new Map<number, ActiveSubscription[]>();

// ============================================================================
// Implementation
// ============================================================================

async function trySubscribe(
  tabId: number,
  frameId: number,
  strategy: string,
  value: string,
  oneShot: boolean
): Promise<ContentResponse> {
  return (await browser.tabs.sendMessage(
    tabId,
    { type: "ELEMENT_SUBSCRIBE", strategy, value, oneShot },
    { frameId }
  )) as ContentResponse;
}

async function handleSubscribe(
  params: unknown,
  context: { tabId: TabId; frameId: FrameId }
): Promise<{ subscriptionId: string; elementId?: string }> {
  const { strategy, value, oneShot, timeout } = params as SubscribeParams;
  const tabId = context.tabId as number;
  const frameId = context.frameId as number;

  log.info(
    `subscribe: strategy="${strategy}", value="${value}", oneShot=${oneShot}, timeout=${timeout ?? "none"}, tab=${tabId}, frame=${frameId}`
  );

  // For non-oneShot subscriptions, just forward to content script and return immediately
  if (!oneShot) {
    try {
      const response = await trySubscribe(
        tabId,
        frameId,
        strategy,
        value,
        oneShot
      );

      log.info(`subscribe response: ${JSON.stringify(response)}`);

      if (!response.success) {
        throw new Error(response.error ?? "Subscribe failed");
      }

      const result: { subscriptionId: string; elementId?: string } = {
        subscriptionId: response.subscriptionId!,
      };
      if (response.elementId) {
        result.elementId = response.elementId;
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Subscribe failed: ${message}`);
    }
  }

  // For oneShot subscriptions, track and wait for element
  return new Promise((resolve, reject) => {
    const subscriptionId = crypto.randomUUID();

    const activeSub: ActiveSubscription = {
      subscriptionId,
      strategy,
      value,
      oneShot,
      tabId,
      frameId,
      resolve,
      reject,
      resolved: false,
    };

    // Set up timeout if specified
    if (timeout && timeout > 0) {
      activeSub.timeoutId = setTimeout(() => {
        if (!activeSub.resolved) {
          log.info(
            `Subscription ${subscriptionId} timed out after ${timeout}ms`
          );
          activeSub.resolved = true;
          removeSubscription(tabId, subscriptionId);

          // Also unsubscribe from content script
          void browser.tabs
            .sendMessage(
              tabId,
              { type: "ELEMENT_UNSUBSCRIBE", subscriptionId },
              { frameId }
            )
            .catch(() => {});

          const error = new Error(
            `Element not found within ${timeout}ms: ${strategy}="${value}"`
          );
          error.name = "timeout";
          reject(error);
        }
      }, timeout);
    }

    // Track this subscription
    const subs = activeSubscriptions.get(tabId) ?? [];
    subs.push(activeSub);
    activeSubscriptions.set(tabId, subs);

    // Try to subscribe now
    void sendSubscribeToContentScript(activeSub);
  });
}

async function sendSubscribeToContentScript(
  sub: ActiveSubscription
): Promise<void> {
  if (sub.resolved) return;

  try {
    log.debug(
      `Sending subscribe to content script: ${sub.strategy}="${sub.value}"`
    );

    const response = await trySubscribe(
      sub.tabId,
      sub.frameId,
      sub.strategy,
      sub.value,
      sub.oneShot
    );

    log.info(`subscribe response: ${JSON.stringify(response)}`);

    if (!response.success) {
      log.error(`subscribe failed: ${response.error}`);
      // Don't reject yet - might work after navigation
      return;
    }

    // If element already exists, resolve immediately
    if (response.elementId) {
      log.info(`Element found immediately: ${response.elementId}`);
      sub.resolved = true;
      removeSubscription(sub.tabId, sub.subscriptionId);
      sub.resolve({
        subscriptionId: sub.subscriptionId,
        elementId: response.elementId,
      });
    } else {
      log.info(
        `Subscription active, waiting for element: ${sub.subscriptionId}`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.debug(`Subscribe failed (will retry after navigation): ${message}`);
    // Don't reject - will retry after navigation
  }
}

function removeSubscription(tabId: number, subscriptionId: string): void {
  const subs = activeSubscriptions.get(tabId);
  if (subs) {
    const sub = subs.find((s) => s.subscriptionId === subscriptionId);
    if (sub?.timeoutId) {
      clearTimeout(sub.timeoutId);
    }

    const filtered = subs.filter((s) => s.subscriptionId !== subscriptionId);
    if (filtered.length > 0) {
      activeSubscriptions.set(tabId, filtered);
    } else {
      activeSubscriptions.delete(tabId);
    }
  }
}

// Called when element.added event is received from content script
function handleElementAddedEvent(
  tabId: number,
  elementId: string,
  strategy: string,
  value: string
): void {
  log.info(
    `Element added event: tab=${tabId}, strategy=${strategy}, value=${value}, elementId=${elementId}`
  );

  const subs = activeSubscriptions.get(tabId);
  if (!subs) return;

  for (const sub of subs) {
    if (sub.strategy === strategy && sub.value === value && !sub.resolved) {
      log.info(
        `Resolving subscription ${sub.subscriptionId} with elementId ${elementId}`
      );
      sub.resolved = true;
      removeSubscription(tabId, sub.subscriptionId);
      sub.resolve({
        subscriptionId: sub.subscriptionId,
        elementId,
      });
      break;
    }
  }
}

// Re-send all active subscriptions after navigation completes
async function resendSubscriptionsAfterNavigation(
  tabId: number
): Promise<void> {
  const subs = activeSubscriptions.get(tabId);
  if (!subs || subs.length === 0) return;

  log.info(
    `Navigation completed, re-sending ${subs.length} subscriptions for tab ${tabId}`
  );

  // Small delay to ensure content script is ready
  await new Promise((r) => setTimeout(r, 200));

  for (const sub of subs) {
    if (!sub.resolved) {
      void sendSubscribeToContentScript(sub);
    }
  }
}

// Listen for navigation completion to re-send subscriptions
browser.webNavigation.onCompleted.addListener((details) => {
  log.info(
    `onCompleted: tab=${details.tabId}, frame=${details.frameId}, url=${details.url}`
  );
  if (details.frameId === 0) {
    void resendSubscriptionsAfterNavigation(details.tabId);
  }
});

// Clean up subscriptions when tab closes
browser.tabs.onRemoved.addListener((tabId) => {
  const subs = activeSubscriptions.get(tabId);
  if (subs) {
    for (const sub of subs) {
      if (sub.timeoutId) {
        clearTimeout(sub.timeoutId);
      }
      if (!sub.resolved) {
        sub.reject(new Error("Tab closed"));
      }
    }
    activeSubscriptions.delete(tabId);
  }
});

// Export for session to call when element.added event is received
export function onElementAdded(
  tabId: number,
  elementId: string,
  strategy: string,
  value: string
): void {
  handleElementAddedEvent(tabId, elementId, strategy, value);
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
