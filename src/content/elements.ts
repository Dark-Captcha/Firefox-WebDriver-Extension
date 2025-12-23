/**
 * @fileoverview Element store for content script.
 * @module content/elements
 */

// ============================================================================
// Imports
// ============================================================================

import { generateUUID } from "../core/utils.js";
import { registerHandler, registerStateProvider } from "./messaging.js";
import { createContentLogger } from "./logger.js";

// ============================================================================
// Types
// ============================================================================

interface ElementFindMessage {
  type: "ELEMENT_FIND";
  selector: string;
  parentId?: string;
}

interface ElementFindAllMessage {
  type: "ELEMENT_FIND_ALL";
  selector: string;
  parentId?: string;
}

interface ElementActionMessage {
  type: "ELEMENT_ACTION";
  elementId: string;
  action: "getProperty" | "setProperty" | "callMethod";
  name: string;
  value?: unknown;
  args?: unknown[];
}

interface InputTypeKeyMessage {
  type: "INPUT_TYPE_KEY";
  elementId: string;
  key: string;
  code: string;
  keyCode: number;
  printable: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

interface InputTypeTextMessage {
  type: "INPUT_TYPE_TEXT";
  elementId: string;
  text: string;
}

interface InputMouseClickMessage {
  type: "INPUT_MOUSE_CLICK";
  elementId?: string;
  x?: number;
  y?: number;
  button: number;
}

interface InputMouseMoveMessage {
  type: "INPUT_MOUSE_MOVE";
  elementId?: string;
  x?: number;
  y?: number;
}

interface InputMouseDownMessage {
  type: "INPUT_MOUSE_DOWN";
  elementId?: string;
  x?: number;
  y?: number;
  button: number;
}

interface InputMouseUpMessage {
  type: "INPUT_MOUSE_UP";
  elementId?: string;
  x?: number;
  y?: number;
  button: number;
}

interface FrameGetIndexMessage {
  type: "FRAME_GET_INDEX";
  elementId: string;
  frameId: number;
}

interface SuccessResponse {
  success: true;
  elementId?: string;
  elementIds?: string[];
  value?: unknown;
}

interface ErrorResponse {
  success: false;
  error: string;
  code:
    | "no such element"
    | "stale element"
    | "invalid argument"
    | "script error";
}

type ElementResponse = SuccessResponse | ErrorResponse;

// ============================================================================
// Constants
// ============================================================================

const log = createContentLogger("Elements");

// ============================================================================
// State
// ============================================================================

const elementStore = new Map<string, Element>();

// ============================================================================
// Implementation - Helpers
// ============================================================================

function isElementAttached(element: Element): boolean {
  return document.contains(element);
}

function getElement(elementId: string): Element | ErrorResponse {
  const element = elementStore.get(elementId);

  if (!element) {
    return {
      success: false,
      error: `Element not found: ${elementId}`,
      code: "no such element",
    };
  }

  if (!isElementAttached(element)) {
    elementStore.delete(elementId);
    return {
      success: false,
      error: `Element is stale: ${elementId}`,
      code: "stale element",
    };
  }

  return element;
}

function getSearchRoot(parentId?: string): Element | Document | ErrorResponse {
  if (!parentId) {
    return document;
  }

  const result = getElement(parentId);
  if ("success" in result && !result.success) {
    return result;
  }

  return result as Element;
}

function isFormElement(element: Element): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  );
}

function isInputElement(element: Element): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  );
}

function getElementCenter(element: Element): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// ============================================================================
// Implementation - Serialization
// ============================================================================

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "function") {
    return { __type: "function", name: value.name || "anonymous" };
  }

  if (value instanceof Element) {
    const elementId = generateUUID();
    elementStore.set(elementId, value);
    return { __type: "element", elementId, tagName: value.tagName };
  }

  if (value instanceof NodeList || value instanceof HTMLCollection) {
    const refs: unknown[] = [];
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (item instanceof Element) {
        const elementId = generateUUID();
        elementStore.set(elementId, item);
        refs.push({ __type: "element", elementId, tagName: item.tagName });
      }
    }
    return refs;
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (typeof value === "object") {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return { __type: "object", toString: String(value) };
    }
  }

  return String(value);
}

function charToKeyProps(char: string): {
  key: string;
  code: string;
  keyCode: number;
} {
  const key = char;
  const keyCode = char.charCodeAt(0);

  let code: string;

  if (char >= "a" && char <= "z") {
    code = `Key${char.toUpperCase()}`;
  } else if (char >= "A" && char <= "Z") {
    code = `Key${char}`;
  } else if (char >= "0" && char <= "9") {
    code = `Digit${char}`;
  } else if (char === " ") {
    code = "Space";
  } else if (char === "-") {
    code = "Minus";
  } else if (char === "=") {
    code = "Equal";
  } else if (char === "[") {
    code = "BracketLeft";
  } else if (char === "]") {
    code = "BracketRight";
  } else if (char === "\\") {
    code = "Backslash";
  } else if (char === ";") {
    code = "Semicolon";
  } else if (char === "'") {
    code = "Quote";
  } else if (char === "`") {
    code = "Backquote";
  } else if (char === ",") {
    code = "Comma";
  } else if (char === ".") {
    code = "Period";
  } else if (char === "/") {
    code = "Slash";
  } else {
    code = "";
  }

  return { key, code, keyCode };
}

// ============================================================================
// Implementation - Find Operations
// ============================================================================

function findElement(selector: string, parentId?: string): ElementResponse {
  log.debug(`find: selector="${selector}", parentId=${parentId ?? "none"}`);

  const root = getSearchRoot(parentId);
  if ("success" in root && !root.success) {
    return root;
  }

  const element = (root as Element | Document).querySelector(selector);

  if (!element) {
    return {
      success: false,
      error: `Element not found: ${selector}`,
      code: "no such element",
    };
  }

  const elementId = generateUUID();
  elementStore.set(elementId, element);

  log.debug(`found: elementId=${elementId}, tag=${element.tagName}`);

  return { success: true, elementId };
}

function findAllElements(selector: string, parentId?: string): ElementResponse {
  log.debug(`findAll: selector="${selector}", parentId=${parentId ?? "none"}`);

  const root = getSearchRoot(parentId);
  if ("success" in root && !root.success) {
    return root;
  }

  const elements = (root as Element | Document).querySelectorAll(selector);
  const elementIds: string[] = [];

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (element) {
      const elementId = generateUUID();
      elementStore.set(elementId, element);
      elementIds.push(elementId);
    }
  }

  log.debug(`foundAll: count=${elementIds.length}`);

  return { success: true, elementIds };
}

// ============================================================================
// Implementation - Property/Method Operations
// ============================================================================

function getProperty(elementId: string, name: string): ElementResponse {
  log.debug(`getProperty: elementId=${elementId}, name="${name}"`);

  const element = getElement(elementId);
  if ("success" in element && !element.success) {
    return element;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (element as any)[name];
    log.debug(`getProperty result: ${typeof value}`);
    return { success: true, value: serializeValue(value) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Failed to get property "${name}": ${message}`,
      code: "script error",
    };
  }
}

function setProperty(
  elementId: string,
  name: string,
  value: unknown
): ElementResponse {
  log.debug(`setProperty: elementId=${elementId}, name="${name}"`);

  const element = getElement(elementId);
  if ("success" in element && !element.success) {
    return element;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (element as any)[name] = value;

    if (name === "value" && isFormElement(element as Element)) {
      (element as Element).dispatchEvent(new Event("input", { bubbles: true }));
      (element as Element).dispatchEvent(
        new Event("change", { bubbles: true })
      );
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Failed to set property "${name}": ${message}`,
      code: "script error",
    };
  }
}

function callMethod(
  elementId: string,
  name: string,
  args: unknown[]
): ElementResponse {
  log.debug(
    `callMethod: elementId=${elementId}, name="${name}", args=${args.length}`
  );

  const element = getElement(elementId);
  if ("success" in element && !element.success) {
    return element;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const method = (element as any)[name];

    if (typeof method !== "function") {
      return {
        success: false,
        error: `"${name}" is not a method`,
        code: "invalid argument",
      };
    }

    const result = method.apply(element, args);
    log.debug(`callMethod result: ${typeof result}`);
    return { success: true, value: serializeValue(result) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Failed to call method "${name}": ${message}`,
      code: "script error",
    };
  }
}

// ============================================================================
// Implementation - Input Operations (Keyboard)
// ============================================================================

function typeKey(
  elementId: string,
  key: string,
  code: string,
  keyCode: number,
  printable: boolean,
  ctrl: boolean,
  shift: boolean,
  alt: boolean,
  meta: boolean
): ElementResponse {
  log.debug(
    `typeKey: elementId=${elementId}, key="${key}", code="${code}", printable=${printable}`
  );

  const element = getElement(elementId);
  if ("success" in element && !element.success) {
    return element;
  }

  const el = element as Element;

  try {
    if (typeof (el as HTMLElement).focus === "function") {
      (el as HTMLElement).focus();
    }

    const eventInit: KeyboardEventInit = {
      key,
      code,
      keyCode,
      which: keyCode,
      ctrlKey: ctrl,
      shiftKey: shift,
      altKey: alt,
      metaKey: meta,
      bubbles: true,
      cancelable: true,
    };

    el.dispatchEvent(new KeyboardEvent("keydown", eventInit));

    if (printable && isInputElement(el)) {
      const inputEl = el as HTMLInputElement | HTMLTextAreaElement;

      if (key === "Backspace") {
        inputEl.value = inputEl.value.slice(0, -1);
      } else if (key.length === 1) {
        inputEl.value += key;
      }

      el.dispatchEvent(
        new InputEvent("input", {
          data: key.length === 1 ? key : null,
          inputType:
            key === "Backspace" ? "deleteContentBackward" : "insertText",
          bubbles: true,
          cancelable: true,
        })
      );
    }

    if (printable && key.length === 1) {
      el.dispatchEvent(
        new KeyboardEvent("keypress", {
          ...eventInit,
          charCode: key.charCodeAt(0),
        })
      );
    }

    el.dispatchEvent(new KeyboardEvent("keyup", eventInit));

    log.debug("typeKey: success");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Failed to type key "${key}": ${message}`,
      code: "script error",
    };
  }
}

function typeText(elementId: string, text: string): ElementResponse {
  log.debug(
    `typeText: elementId=${elementId}, text="${text}" (${text.length} chars)`
  );

  const element = getElement(elementId);
  if ("success" in element && !element.success) {
    return element;
  }

  const el = element as Element;

  if (!isInputElement(el)) {
    return {
      success: false,
      error: `Element is not an input element: ${el.tagName}`,
      code: "invalid argument",
    };
  }

  const inputEl = el as HTMLInputElement | HTMLTextAreaElement;

  try {
    if (typeof (el as HTMLElement).focus === "function") {
      (el as HTMLElement).focus();
    }

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (!char) continue;

      const { key, code, keyCode } = charToKeyProps(char);

      el.dispatchEvent(
        new KeyboardEvent("keydown", {
          key,
          code,
          keyCode,
          bubbles: true,
          cancelable: true,
        })
      );

      inputEl.value += key;

      el.dispatchEvent(
        new InputEvent("input", {
          data: key,
          inputType: "insertText",
          bubbles: true,
        })
      );

      el.dispatchEvent(
        new KeyboardEvent("keyup", {
          key,
          code,
          keyCode,
          bubbles: true,
          cancelable: true,
        })
      );
    }

    log.debug("typeText: success");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Failed to type text: ${message}`,
      code: "script error",
    };
  }
}

// ============================================================================
// Implementation - Input Operations (Mouse)
// ============================================================================

function mouseClick(
  elementId: string | undefined,
  x: number | undefined,
  y: number | undefined,
  button: number
): ElementResponse {
  log.debug(
    `mouseClick: elementId=${
      elementId ?? "none"
    }, x=${x}, y=${y}, button=${button}`
  );

  let targetElement: Element;
  let clickX: number;
  let clickY: number;

  if (elementId) {
    const element = getElement(elementId);
    if ("success" in element && !element.success) {
      return element;
    }
    targetElement = element as Element;
    const center = getElementCenter(targetElement);
    clickX = x ?? center.x;
    clickY = y ?? center.y;
  } else if (x !== undefined && y !== undefined) {
    const elementAtPoint = document.elementFromPoint(x, y);
    if (!elementAtPoint) {
      return {
        success: false,
        error: `No element at coordinates (${x}, ${y})`,
        code: "no such element",
      };
    }
    targetElement = elementAtPoint;
    clickX = x;
    clickY = y;
  } else {
    return {
      success: false,
      error: "Either elementId or coordinates must be provided",
      code: "invalid argument",
    };
  }

  try {
    const eventInit: MouseEventInit = {
      clientX: clickX,
      clientY: clickY,
      screenX: clickX,
      screenY: clickY,
      button,
      buttons: button === 0 ? 1 : button === 1 ? 4 : 2,
      bubbles: true,
      cancelable: true,
      view: window,
    };

    targetElement.dispatchEvent(new MouseEvent("mousemove", eventInit));
    targetElement.dispatchEvent(new MouseEvent("mousedown", eventInit));
    targetElement.dispatchEvent(new MouseEvent("mouseup", eventInit));
    targetElement.dispatchEvent(new MouseEvent("click", eventInit));

    log.debug("mouseClick: success");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Failed to click: ${message}`,
      code: "script error",
    };
  }
}

function mouseMove(
  elementId: string | undefined,
  x: number | undefined,
  y: number | undefined
): ElementResponse {
  log.debug(`mouseMove: elementId=${elementId ?? "none"}, x=${x}, y=${y}`);

  let targetElement: Element;
  let moveX: number;
  let moveY: number;

  if (elementId) {
    const element = getElement(elementId);
    if ("success" in element && !element.success) {
      return element;
    }
    targetElement = element as Element;
    const center = getElementCenter(targetElement);
    moveX = x ?? center.x;
    moveY = y ?? center.y;
  } else if (x !== undefined && y !== undefined) {
    const elementAtPoint = document.elementFromPoint(x, y);
    targetElement = elementAtPoint ?? document.body;
    moveX = x;
    moveY = y;
  } else {
    return {
      success: false,
      error: "Either elementId or coordinates must be provided",
      code: "invalid argument",
    };
  }

  try {
    const eventInit: MouseEventInit = {
      clientX: moveX,
      clientY: moveY,
      screenX: moveX,
      screenY: moveY,
      bubbles: true,
      cancelable: true,
      view: window,
    };

    targetElement.dispatchEvent(
      new MouseEvent("mouseenter", { ...eventInit, bubbles: false })
    );
    targetElement.dispatchEvent(new MouseEvent("mouseover", eventInit));
    targetElement.dispatchEvent(new MouseEvent("mousemove", eventInit));

    log.debug("mouseMove: success");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Failed to move mouse: ${message}`,
      code: "script error",
    };
  }
}

function mouseDown(
  elementId: string | undefined,
  x: number | undefined,
  y: number | undefined,
  button: number
): ElementResponse {
  log.debug(
    `mouseDown: elementId=${
      elementId ?? "none"
    }, x=${x}, y=${y}, button=${button}`
  );

  let targetElement: Element;
  let downX: number;
  let downY: number;

  if (elementId) {
    const element = getElement(elementId);
    if ("success" in element && !element.success) {
      return element;
    }
    targetElement = element as Element;
    const center = getElementCenter(targetElement);
    downX = x ?? center.x;
    downY = y ?? center.y;
  } else if (x !== undefined && y !== undefined) {
    const elementAtPoint = document.elementFromPoint(x, y);
    if (!elementAtPoint) {
      return {
        success: false,
        error: `No element at coordinates (${x}, ${y})`,
        code: "no such element",
      };
    }
    targetElement = elementAtPoint;
    downX = x;
    downY = y;
  } else {
    return {
      success: false,
      error: "Either elementId or coordinates must be provided",
      code: "invalid argument",
    };
  }

  try {
    const eventInit: MouseEventInit = {
      clientX: downX,
      clientY: downY,
      screenX: downX,
      screenY: downY,
      button,
      buttons: button === 0 ? 1 : button === 1 ? 4 : 2,
      bubbles: true,
      cancelable: true,
      view: window,
    };

    targetElement.dispatchEvent(new MouseEvent("mousedown", eventInit));

    log.debug("mouseDown: success");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Failed to mousedown: ${message}`,
      code: "script error",
    };
  }
}

function mouseUp(
  elementId: string | undefined,
  x: number | undefined,
  y: number | undefined,
  button: number
): ElementResponse {
  log.debug(
    `mouseUp: elementId=${
      elementId ?? "none"
    }, x=${x}, y=${y}, button=${button}`
  );

  let targetElement: Element;
  let upX: number;
  let upY: number;

  if (elementId) {
    const element = getElement(elementId);
    if ("success" in element && !element.success) {
      return element;
    }
    targetElement = element as Element;
    const center = getElementCenter(targetElement);
    upX = x ?? center.x;
    upY = y ?? center.y;
  } else if (x !== undefined && y !== undefined) {
    const elementAtPoint = document.elementFromPoint(x, y);
    if (!elementAtPoint) {
      return {
        success: false,
        error: `No element at coordinates (${x}, ${y})`,
        code: "no such element",
      };
    }
    targetElement = elementAtPoint;
    upX = x;
    upY = y;
  } else {
    return {
      success: false,
      error: "Either elementId or coordinates must be provided",
      code: "invalid argument",
    };
  }

  try {
    const eventInit: MouseEventInit = {
      clientX: upX,
      clientY: upY,
      screenX: upX,
      screenY: upY,
      button,
      buttons: 0,
      bubbles: true,
      cancelable: true,
      view: window,
    };

    targetElement.dispatchEvent(new MouseEvent("mouseup", eventInit));

    log.debug("mouseUp: success");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Failed to mouseup: ${message}`,
      code: "script error",
    };
  }
}

// ============================================================================
// Implementation - Frame Operations
// ============================================================================

function getFrameIndex(
  elementId: string
): ElementResponse & { frameIndex?: number } {
  log.debug(`getFrameIndex: elementId=${elementId}`);

  const element = getElement(elementId);
  if ("success" in element && !element.success) {
    return element;
  }

  const el = element as Element;

  if (!(el instanceof HTMLIFrameElement)) {
    return {
      success: false,
      error: `Element is not an iframe: ${el.tagName}`,
      code: "invalid argument",
    };
  }

  const targetWindow = el.contentWindow;
  if (!targetWindow) {
    return {
      success: false,
      error: "Cannot access iframe contentWindow",
      code: "script error",
    };
  }

  for (let i = 0; i < window.frames.length; i++) {
    try {
      if (window.frames[i] === targetWindow) {
        log.debug(`Found frame at index: ${i}`);
        return { success: true, frameIndex: i };
      }
    } catch {
      // Cross-origin comparison may throw
    }
  }

  return {
    success: false,
    error: "Could not find frame index",
    code: "no such element",
  };
}

// ============================================================================
// Implementation - Cleanup
// ============================================================================

function cleanupStaleElements(): void {
  let removed = 0;

  for (const [elementId, element] of elementStore) {
    if (!isElementAttached(element)) {
      elementStore.delete(elementId);
      removed++;
    }
  }

  if (removed > 0) {
    log.debug(`cleanup: removed ${removed} stale elements`);
  }
}

function getStoreSize(): number {
  return elementStore.size;
}

function getElementStore(): Map<string, Element> {
  return elementStore;
}

// ============================================================================
// Implementation - Message Handlers
// ============================================================================

function handleElementFind(msg: ElementFindMessage): Promise<ElementResponse> {
  return Promise.resolve(findElement(msg.selector, msg.parentId));
}

function handleElementFindAll(
  msg: ElementFindAllMessage
): Promise<ElementResponse> {
  return Promise.resolve(findAllElements(msg.selector, msg.parentId));
}

function handleElementAction(
  msg: ElementActionMessage
): Promise<ElementResponse> {
  const { elementId, action, name, value, args } = msg;

  let response: ElementResponse;

  switch (action) {
    case "getProperty":
      response = getProperty(elementId, name);
      break;
    case "setProperty":
      response = setProperty(elementId, name, value);
      break;
    case "callMethod":
      response = callMethod(elementId, name, args ?? []);
      break;
    default:
      response = {
        success: false,
        error: `Unknown action: ${action}`,
        code: "invalid argument",
      };
  }

  return Promise.resolve(response);
}

function handleFrameGetIndex(
  msg: FrameGetIndexMessage
): Promise<ElementResponse & { frameIndex?: number }> {
  return Promise.resolve(getFrameIndex(msg.elementId));
}

function handleInputTypeKey(
  msg: InputTypeKeyMessage
): Promise<ElementResponse> {
  const { elementId, key, code, keyCode, printable, ctrl, shift, alt, meta } =
    msg;
  return Promise.resolve(
    typeKey(elementId, key, code, keyCode, printable, ctrl, shift, alt, meta)
  );
}

function handleInputTypeText(
  msg: InputTypeTextMessage
): Promise<ElementResponse> {
  return Promise.resolve(typeText(msg.elementId, msg.text));
}

function handleInputMouseClick(
  msg: InputMouseClickMessage
): Promise<ElementResponse> {
  return Promise.resolve(mouseClick(msg.elementId, msg.x, msg.y, msg.button));
}

function handleInputMouseMove(
  msg: InputMouseMoveMessage
): Promise<ElementResponse> {
  return Promise.resolve(mouseMove(msg.elementId, msg.x, msg.y));
}

function handleInputMouseDown(
  msg: InputMouseDownMessage
): Promise<ElementResponse> {
  return Promise.resolve(mouseDown(msg.elementId, msg.x, msg.y, msg.button));
}

function handleInputMouseUp(
  msg: InputMouseUpMessage
): Promise<ElementResponse> {
  return Promise.resolve(mouseUp(msg.elementId, msg.x, msg.y, msg.button));
}

// ============================================================================
// Implementation - Initialization
// ============================================================================

function initElements(): void {
  registerHandler("ELEMENT_FIND", handleElementFind);
  registerHandler("ELEMENT_FIND_ALL", handleElementFindAll);
  registerHandler("ELEMENT_ACTION", handleElementAction);
  registerHandler("FRAME_GET_INDEX", handleFrameGetIndex);
  registerHandler("INPUT_TYPE_KEY", handleInputTypeKey);
  registerHandler("INPUT_TYPE_TEXT", handleInputTypeText);
  registerHandler("INPUT_MOUSE_CLICK", handleInputMouseClick);
  registerHandler("INPUT_MOUSE_MOVE", handleInputMouseMove);
  registerHandler("INPUT_MOUSE_DOWN", handleInputMouseDown);
  registerHandler("INPUT_MOUSE_UP", handleInputMouseUp);

  registerStateProvider(() => ({ elementCount: elementStore.size }));

  window.addEventListener("beforeunload", () => {
    elementStore.clear();
  });

  setInterval(cleanupStaleElements, 30000);

  log.info("Element store initialized");
}

// ============================================================================
// Exports
// ============================================================================

export { initElements, getStoreSize, cleanupStaleElements, getElementStore };
