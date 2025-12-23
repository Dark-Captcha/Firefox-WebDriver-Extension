/**
 * @fileoverview Preload script handlers.
 * @module modules/script/preload
 */

// ============================================================================
// Imports
// ============================================================================

import type { RequestContext } from "../../../types/index.js";
import type { ScriptId } from "../../../types/identifiers.js";

import { generateScriptId } from "../../../types/identifiers.js";
import { createLogger } from "../../../core/logger.js";

// ============================================================================
// Types
// ============================================================================

interface AddPreloadScriptParams {
  script: string;
  matches?: string[];
}

interface AddPreloadScriptResult {
  scriptId: ScriptId;
}

interface RemovePreloadScriptParams {
  scriptId: ScriptId;
}

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("Script.Preload");

// ============================================================================
// State
// ============================================================================

const registeredScripts = new Map<ScriptId, string>();

// ============================================================================
// Implementation
// ============================================================================

async function handleAddPreloadScript(
  params: unknown,
  _ctx: RequestContext
): Promise<AddPreloadScriptResult> {
  const { script, matches = ["<all_urls>"] } = params as AddPreloadScriptParams;

  if (!script) {
    throw new Error("Script is required");
  }

  const scriptId = generateScriptId();
  const registrationId = `preload-${scriptId}`;

  log.debug("Registering preload script", {
    scriptId,
    matches,
    scriptLength: script.length,
  });

  const wrappedScript = `(function() { ${script} })();`;

  await browser.scripting.registerContentScripts([
    {
      id: registrationId,
      matches,
      js: [{ code: wrappedScript }] as unknown as string[],
      runAt: "document_start",
      world: "MAIN",
      allFrames: true,
    },
  ]);

  registeredScripts.set(scriptId, registrationId);

  log.info(`Registered preload script ${scriptId}`, { matches });

  return { scriptId };
}

async function handleRemovePreloadScript(
  params: unknown,
  _ctx: RequestContext
): Promise<void> {
  const { scriptId } = params as RemovePreloadScriptParams;

  if (!scriptId) {
    throw new Error("scriptId is required");
  }

  const registrationId = registeredScripts.get(scriptId);
  if (!registrationId) {
    throw new Error(`No such script: ${scriptId}`);
  }

  log.debug("Unregistering preload script", { scriptId });

  await browser.scripting.unregisterContentScripts({ ids: [registrationId] });

  registeredScripts.delete(scriptId);

  log.info(`Unregistered preload script ${scriptId}`);
}

function getPreloadScriptCount(): number {
  return registeredScripts.size;
}

// ============================================================================
// Exports
// ============================================================================

export {
  handleAddPreloadScript,
  handleRemovePreloadScript,
  getPreloadScriptCount,
};
