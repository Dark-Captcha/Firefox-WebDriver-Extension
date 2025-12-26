/**
 * @fileoverview Element observation via MutationObserver.
 * @module content/observer
 */

// ============================================================================
// Imports
// ============================================================================

import { generateUUID } from "../core/utils.js";
import {
  sendEvent,
  registerHandler,
  registerStateProvider,
} from "./messaging.js";
import { createContentLogger } from "./logger.js";

// ============================================================================
// Types
// ============================================================================

interface ElementSubscription {
  id: string;
  strategy: string;
  value: string;
  oneShot: boolean;
}

interface RemovalWatch {
  elementId: string;
  element: Element;
}

interface AttributeWatch {
  elementId: string;
  element: Element;
  attributeName: string | null;
}

interface SubscribeResponse {
  success: true;
  subscriptionId: string;
  elementId?: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  code: "invalid argument" | "no such element";
}

type ObserverResponse = SubscribeResponse | { success: true } | ErrorResponse;

interface SubscribeMessage {
  type: "ELEMENT_SUBSCRIBE";
  strategy: string;
  value: string;
  oneShot: boolean;
}

interface UnsubscribeMessage {
  type: "ELEMENT_UNSUBSCRIBE";
  subscriptionId: string;
}

interface WatchRemovalMessage {
  type: "ELEMENT_WATCH_REMOVAL";
  elementId: string;
}

interface UnwatchRemovalMessage {
  type: "ELEMENT_UNWATCH_REMOVAL";
  elementId: string;
}

interface WatchAttributeMessage {
  type: "ELEMENT_WATCH_ATTRIBUTE";
  elementId: string;
  attributeName: string | null;
}

interface UnwatchAttributeMessage {
  type: "ELEMENT_UNWATCH_ATTRIBUTE";
  elementId: string;
}

// ============================================================================
// Constants
// ============================================================================

const log = createContentLogger("Observer");

// ============================================================================
// State
// ============================================================================

const subscriptions = new Map<string, ElementSubscription>();
const removalWatches = new Map<string, RemovalWatch>();
const attributeWatches = new Map<string, AttributeWatch>();

let attributeObserver: MutationObserver | null = null;
let observer: MutationObserver | null = null;
let elementStoreRef: Map<string, Element> | null = null;

// ============================================================================
// Implementation - Strategy-based Find
// ============================================================================

function findByStrategy(
  strategy: string,
  value: string,
  parent: Element | Document = document
): Element | null {
  log.debug(`findByStrategy: strategy="${strategy}", value="${value}"`);

  let result: Element | null = null;
  let selector: string | null = null;

  switch (strategy) {
    case "css":
      selector = value;
      result = parent.querySelector(value);
      break;
    case "id":
      selector = `#${CSS.escape(value)}`;
      result = parent.querySelector(selector);
      break;
    case "class":
      selector = `.${CSS.escape(value)}`;
      result = parent.querySelector(selector);
      break;
    case "tag":
      selector = value;
      result = parent.querySelector(value);
      break;
    case "name":
      selector = `[name="${CSS.escape(value)}"]`;
      result = parent.querySelector(selector);
      break;
    case "xpath": {
      const root = parent === document ? document : parent.ownerDocument;
      if (!root) {
        log.debug(`findByStrategy: xpath - no root document`);
        return null;
      }
      const xpathResult = root.evaluate(
        value,
        parent,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      result = xpathResult.singleNodeValue as Element | null;
      break;
    }
    case "text": {
      const elements = parent.querySelectorAll("*");
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el && el.textContent?.trim() === value) {
          result = el;
          break;
        }
      }
      break;
    }
    case "partialText": {
      const elements = parent.querySelectorAll("*");
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el && el.textContent?.includes(value)) {
          result = el;
          break;
        }
      }
      break;
    }
    case "linkText": {
      const links = parent.querySelectorAll("a");
      for (let i = 0; i < links.length; i++) {
        const el = links[i];
        if (el && el.textContent?.trim() === value) {
          result = el;
          break;
        }
      }
      break;
    }
    case "partialLinkText": {
      const links = parent.querySelectorAll("a");
      for (let i = 0; i < links.length; i++) {
        const el = links[i];
        if (el && el.textContent?.includes(value)) {
          result = el;
          break;
        }
      }
      break;
    }
    default:
      log.debug(`findByStrategy: unknown strategy "${strategy}"`);
      return null;
  }

  if (selector) {
    log.debug(`findByStrategy: using selector "${selector}"`);
  }
  log.debug(`findByStrategy: result=${result ? result.tagName : "null"}`);

  return result;
}

function elementMatchesStrategy(
  element: Element,
  strategy: string,
  value: string
): boolean {
  switch (strategy) {
    case "css":
      try {
        return element.matches(value);
      } catch {
        return false;
      }
    case "id":
      return element.id === value;
    case "class":
      return element.classList.contains(value);
    case "tag":
      return element.tagName.toLowerCase() === value.toLowerCase();
    case "name":
      return element.getAttribute("name") === value;
    case "xpath":
      // XPath matching for individual elements is complex, skip for mutation observer
      return false;
    case "text":
      return element.textContent?.trim() === value;
    case "partialText":
      return element.textContent?.includes(value) ?? false;
    case "linkText":
      return (
        element.tagName.toLowerCase() === "a" &&
        element.textContent?.trim() === value
      );
    case "partialLinkText":
      return (
        element.tagName.toLowerCase() === "a" &&
        (element.textContent?.includes(value) ?? false)
      );
    default:
      return false;
  }
}

// ============================================================================
// Implementation - Helpers
// ============================================================================

function checkElementAgainstSubscriptions(element: Element): void {
  const toRemove: string[] = [];

  for (const [subId, sub] of subscriptions) {
    try {
      if (elementMatchesStrategy(element, sub.strategy, sub.value)) {
        const elementId = generateUUID();

        if (elementStoreRef) {
          elementStoreRef.set(elementId, element);
        }

        log.debug(
          `Element matched: strategy="${sub.strategy}", value="${sub.value}", id=${elementId}`
        );

        sendEvent("element.added", {
          strategy: sub.strategy,
          value: sub.value,
          elementId,
          subscriptionId: subId,
          tabId: 0,
          frameId: 0,
        });

        if (sub.oneShot) {
          toRemove.push(subId);
        }
      }
    } catch (e) {
      log.error(`Invalid strategy: ${sub.strategy}="${sub.value}"`, e);
    }
  }

  for (const subId of toRemove) {
    subscriptions.delete(subId);
    log.debug(`Removed oneShot subscription: ${subId}`);
  }
}

function checkRemovedNode(node: Node): void {
  if (!(node instanceof Element)) return;

  for (const [elementId, watch] of removalWatches) {
    if (watch.element === node || node.contains(watch.element)) {
      log.debug(`Watched element removed: ${elementId}`);

      sendEvent("element.removed", { elementId, tabId: 0, frameId: 0 });

      removalWatches.delete(elementId);
    }
  }
}

function checkAddedNodeAndDescendants(node: Node): void {
  if (!(node instanceof Element)) return;

  checkElementAgainstSubscriptions(node);

  const descendants = node.querySelectorAll("*");
  for (let i = 0; i < descendants.length; i++) {
    const desc = descendants[i];
    if (desc) {
      checkElementAgainstSubscriptions(desc);
    }
  }
}

// ============================================================================
// Implementation - MutationObserver Callbacks
// ============================================================================

function handleMutations(mutations: MutationRecord[]): void {
  if (subscriptions.size === 0) return;

  let addedCount = 0;
  for (const mutation of mutations) {
    addedCount += mutation.addedNodes.length;
  }

  if (addedCount > 0) {
    log.debug(
      `handleMutations: ${mutations.length} mutations, ${addedCount} added nodes, ${subscriptions.size} active subscriptions`
    );
  }

  for (const mutation of mutations) {
    for (let i = 0; i < mutation.addedNodes.length; i++) {
      const node = mutation.addedNodes[i];
      if (node) {
        checkAddedNodeAndDescendants(node);
      }
    }

    for (let i = 0; i < mutation.removedNodes.length; i++) {
      const node = mutation.removedNodes[i];
      if (node) {
        checkRemovedNode(node);
      }
    }
  }
}

function handleAttributeMutations(mutations: MutationRecord[]): void {
  for (const mutation of mutations) {
    if (mutation.type !== "attributes") continue;

    const target = mutation.target;
    if (!(target instanceof Element)) continue;

    for (const [elementId, watch] of attributeWatches) {
      if (watch.element === target) {
        const attrName = mutation.attributeName;

        if (watch.attributeName !== null && watch.attributeName !== attrName) {
          continue;
        }

        const oldValue = mutation.oldValue;
        const newValue = attrName ? target.getAttribute(attrName) : null;

        log.debug(
          `Attribute changed: ${elementId}.${attrName} = "${oldValue}" -> "${newValue}"`
        );

        sendEvent("element.attributeChanged", {
          elementId,
          attributeName: attrName,
          oldValue,
          newValue,
          tabId: 0,
          frameId: 0,
        });
      }
    }
  }
}

// ============================================================================
// Implementation - Observer Management
// ============================================================================

function startObserver(): void {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver(handleMutations);

  if (document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    log.debug("MutationObserver started");
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      if (observer && document.documentElement) {
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
        });
        log.debug("MutationObserver started (after DOMContentLoaded)");
      }
    });
  }
}

function stopObserver(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function startAttributeObserver(): void {
  if (attributeObserver) return;

  attributeObserver = new MutationObserver(handleAttributeMutations);

  for (const watch of attributeWatches.values()) {
    if (document.contains(watch.element)) {
      const options: MutationObserverInit = {
        attributes: true,
        attributeOldValue: true,
      };
      if (watch.attributeName) {
        options.attributeFilter = [watch.attributeName];
      }
      attributeObserver.observe(watch.element, options);
    }
  }

  log.debug("Attribute observer started");
}

// ============================================================================
// Implementation - Public Functions
// ============================================================================

function subscribe(
  strategy: string,
  value: string,
  oneShot: boolean
): ObserverResponse {
  log.info(
    `subscribe: strategy="${strategy}", value="${value}", oneShot=${oneShot}`
  );

  startObserver();

  // Validate strategy
  const validStrategies = [
    "css",
    "xpath",
    "text",
    "partialText",
    "id",
    "tag",
    "name",
    "class",
    "linkText",
    "partialLinkText",
  ];
  if (!validStrategies.includes(strategy)) {
    log.error(`Invalid strategy: ${strategy}`);
    return {
      success: false,
      error: `Invalid strategy: ${strategy}`,
      code: "invalid argument",
    };
  }

  const subscriptionId = generateUUID();
  log.debug(`Created subscriptionId: ${subscriptionId}`);

  const existingElement = findByStrategy(strategy, value);
  if (existingElement) {
    const elementId = generateUUID();

    if (elementStoreRef) {
      elementStoreRef.set(elementId, existingElement);
    }

    log.info(
      `Element already exists: ${elementId}, tag=${existingElement.tagName}`
    );

    if (oneShot) {
      return { success: true, subscriptionId, elementId };
    }

    subscriptions.set(subscriptionId, {
      id: subscriptionId,
      strategy,
      value,
      oneShot,
    });
    return { success: true, subscriptionId, elementId };
  }

  log.info(
    `Element not found, waiting for mutations. Active subscriptions: ${subscriptions.size + 1}`
  );

  subscriptions.set(subscriptionId, {
    id: subscriptionId,
    strategy,
    value,
    oneShot,
  });
  log.debug(`Created subscription: ${subscriptionId}`);

  return { success: true, subscriptionId };
}

function unsubscribe(subscriptionId: string): ObserverResponse {
  log.debug(`unsubscribe: ${subscriptionId}`);

  if (!subscriptions.has(subscriptionId)) {
    return {
      success: false,
      error: `Subscription not found: ${subscriptionId}`,
      code: "no such element",
    };
  }

  subscriptions.delete(subscriptionId);
  return { success: true };
}

function watchRemoval(
  elementId: string,
  elementStore: Map<string, Element>
): ObserverResponse {
  log.debug(`watchRemoval: ${elementId}`);

  const element = elementStore.get(elementId);
  if (!element) {
    return {
      success: false,
      error: `Element not found: ${elementId}`,
      code: "no such element",
    };
  }

  removalWatches.set(elementId, { elementId, element });
  return { success: true };
}

function unwatchRemoval(elementId: string): ObserverResponse {
  log.debug(`unwatchRemoval: ${elementId}`);
  removalWatches.delete(elementId);
  return { success: true };
}

function watchAttribute(
  elementId: string,
  attributeName: string | null,
  elementStore: Map<string, Element>
): ObserverResponse {
  log.debug(`watchAttribute: ${elementId}, attr=${attributeName ?? "all"}`);

  const element = elementStore.get(elementId);
  if (!element) {
    return {
      success: false,
      error: `Element not found: ${elementId}`,
      code: "no such element",
    };
  }

  attributeWatches.set(elementId, { elementId, element, attributeName });
  startAttributeObserver();

  return { success: true };
}

function unwatchAttribute(elementId: string): ObserverResponse {
  log.debug(`unwatchAttribute: ${elementId}`);

  attributeWatches.delete(elementId);

  if (attributeWatches.size === 0 && attributeObserver) {
    attributeObserver.disconnect();
    attributeObserver = null;
    log.debug("Attribute observer stopped (no watches)");
  }

  return { success: true };
}

// ============================================================================
// Implementation - Message Handlers
// ============================================================================

function handleSubscribe(msg: SubscribeMessage): Promise<ObserverResponse> {
  return Promise.resolve(subscribe(msg.strategy, msg.value, msg.oneShot));
}

function handleUnsubscribe(msg: UnsubscribeMessage): Promise<ObserverResponse> {
  return Promise.resolve(unsubscribe(msg.subscriptionId));
}

function handleWatchRemoval(
  msg: WatchRemovalMessage
): Promise<ObserverResponse> {
  if (!elementStoreRef) {
    return Promise.resolve({
      success: false,
      error: "Element store not initialized",
      code: "invalid argument" as const,
    });
  }
  return Promise.resolve(watchRemoval(msg.elementId, elementStoreRef));
}

function handleUnwatchRemoval(
  msg: UnwatchRemovalMessage
): Promise<ObserverResponse> {
  return Promise.resolve(unwatchRemoval(msg.elementId));
}

function handleWatchAttribute(
  msg: WatchAttributeMessage
): Promise<ObserverResponse> {
  if (!elementStoreRef) {
    return Promise.resolve({
      success: false,
      error: "Element store not initialized",
      code: "invalid argument" as const,
    });
  }
  return Promise.resolve(
    watchAttribute(msg.elementId, msg.attributeName, elementStoreRef)
  );
}

function handleUnwatchAttribute(
  msg: UnwatchAttributeMessage
): Promise<ObserverResponse> {
  return Promise.resolve(unwatchAttribute(msg.elementId));
}

// ============================================================================
// Implementation - Initialization
// ============================================================================

function initObserver(elementStore: Map<string, Element>): void {
  elementStoreRef = elementStore;

  startObserver();

  registerHandler("ELEMENT_SUBSCRIBE", handleSubscribe);
  registerHandler("ELEMENT_UNSUBSCRIBE", handleUnsubscribe);
  registerHandler("ELEMENT_WATCH_REMOVAL", handleWatchRemoval);
  registerHandler("ELEMENT_UNWATCH_REMOVAL", handleUnwatchRemoval);
  registerHandler("ELEMENT_WATCH_ATTRIBUTE", handleWatchAttribute);
  registerHandler("ELEMENT_UNWATCH_ATTRIBUTE", handleUnwatchAttribute);

  registerStateProvider(() => ({
    subscriptionCount: subscriptions.size,
    subscriptions: Array.from(subscriptions.values()).map(
      (s) => `${s.strategy}:${s.value}`
    ),
  }));

  window.addEventListener("beforeunload", () => {
    stopObserver();
    if (attributeObserver) {
      attributeObserver.disconnect();
      attributeObserver = null;
    }
    subscriptions.clear();
    removalWatches.clear();
    attributeWatches.clear();
  });

  log.info("Element observer initialized");
}

// ============================================================================
// Exports
// ============================================================================

export {
  initObserver,
  subscribe,
  unsubscribe,
  watchRemoval,
  unwatchRemoval,
  watchAttribute,
  unwatchAttribute,
};
