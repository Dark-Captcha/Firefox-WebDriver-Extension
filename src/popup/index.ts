/**
 * @fileoverview Debug popup for Firefox WebDriver.
 * @module popup
 */

// ============================================================================
// Types
// ============================================================================

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

interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  module: string;
  message: string;
  data?: unknown;
}

// ============================================================================
// Implementation - DOM Helpers
// ============================================================================

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function setText(id: string, text: string): void {
  const el = $(id);
  if (el) {
    if (el instanceof HTMLTextAreaElement) {
      el.value = text;
    } else {
      const valueEl = el.querySelector(".value");
      if (valueEl) {
        valueEl.textContent = text;
      } else {
        el.textContent = text;
      }
    }
  }
}

function setToggle(id: string, on: boolean): void {
  const el = $(id);
  if (el) {
    el.textContent = on ? "ON" : "OFF";
    el.className = `toggle-status ${on ? "on" : "off"}`;
  }
}

// ============================================================================
// Implementation - Copy Functionality
// ============================================================================

async function copyToClipboard(text: string, btn: HTMLElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    const original = btn.textContent;
    btn.textContent = "✓";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("copied");
    }, 1000);
  } catch {
    // Ignore
  }
}

function setupCopyButtons(): void {
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-copy");
      if (!targetId) return;

      const target = $(targetId);
      if (!target) return;

      const valueEl = target.querySelector(".value");
      const text = valueEl?.textContent ?? target.textContent ?? "";
      void copyToClipboard(text, btn as HTMLElement);
    });
  });
}

// ============================================================================
// Implementation - State Display
// ============================================================================

function updateUI(state: DebugState): void {
  const statusEl = $("status");
  if (statusEl) {
    statusEl.textContent = state.connected ? "Connected" : "Disconnected";
    statusEl.className = `status ${
      state.connected ? "connected" : "disconnected"
    }`;
  }

  setText("ws-url", state.wsUrl ?? "Not connected");
  setText("session-id", state.sessionId?.toString() ?? "—");
  setText("current-tab", state.tabId?.toString() ?? "—");
  setText("total-tabs", state.totalTabs?.toString() ?? "—");

  const requestsEl = $("requests");
  const errorsEl = $("errors");
  const handlersEl = $("handlers");
  const elementsEl = $("elements");

  if (requestsEl) requestsEl.textContent = state.requests.toString();
  if (errorsEl) errorsEl.textContent = state.errors.toString();
  if (handlersEl) handlersEl.textContent = state.handlers.toString();
  if (elementsEl) elementsEl.textContent = state.elements.toString();

  setText("tab-proxy", state.tabProxy ?? "None");
  setText("window-proxy", state.windowProxy ?? "None");

  setText(
    "block-urls",
    state.blockUrls.length > 0 ? state.blockUrls.join("\n") : "None"
  );

  setToggle("intercept-requests", state.interceptRequests);
  setToggle("intercept-responses", state.interceptResponses);

  setText(
    "mutation-observers",
    state.mutationObservers.length > 0
      ? state.mutationObservers.join("\n")
      : "None"
  );
  setText(
    "registered-handlers",
    state.registeredHandlers.length > 0
      ? state.registeredHandlers.join("\n")
      : "None"
  );
}

function updateLogs(logs: LogEntry[]): void {
  const logsEl = $("logs") as HTMLTextAreaElement | null;
  if (!logsEl) return;

  if (logs.length === 0) {
    logsEl.value = "No logs yet";
    return;
  }

  const text = logs
    .slice()
    .reverse()
    .map((entry) => {
      const time = entry.timestamp.slice(11, 23);
      const level = entry.level.toUpperCase().padEnd(5);
      const dataStr =
        entry.data !== undefined ? ` ${JSON.stringify(entry.data)}` : "";
      return `[${time}] [${level}] [${entry.module}] ${entry.message}${dataStr}`;
    })
    .join("\n");

  logsEl.value = text;
}

// ============================================================================
// Implementation - Data Fetching
// ============================================================================

async function fetchState(): Promise<DebugState | null> {
  try {
    const state = (await browser.runtime.sendMessage({
      type: "GET_STATE",
    })) as DebugState;
    return state;
  } catch {
    return null;
  }
}

async function fetchLogs(): Promise<LogEntry[]> {
  try {
    const logs = (await browser.runtime.sendMessage({
      type: "GET_LOGS",
    })) as LogEntry[];
    return logs;
  } catch {
    return [];
  }
}

async function clearLogs(): Promise<void> {
  try {
    await browser.runtime.sendMessage({ type: "CLEAR_LOGS" });
  } catch {
    // Ignore
  }
}

async function refresh(): Promise<void> {
  const [state, logs] = await Promise.all([fetchState(), fetchLogs()]);

  if (state) {
    updateUI(state);
  }
  updateLogs(logs);
}

// ============================================================================
// Implementation - Initialization
// ============================================================================

function init(): void {
  setupCopyButtons();

  const clearBtn = $("clear-logs");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      void clearLogs().then(() => refresh());
    });
  }

  void refresh();

  setInterval(() => {
    void refresh();
  }, 1000);
}

document.addEventListener("DOMContentLoaded", init);
