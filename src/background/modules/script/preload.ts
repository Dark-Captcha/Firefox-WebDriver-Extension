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

  log.debug(
    `addPreloadScript: scriptId=${scriptId}, scriptLength=${script.length}, matches=${matches.join(",")}`
  );
  const start = Date.now();

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

  const elapsed = Date.now() - start;
  log.debug(
    `addPreloadScript: completed in ${elapsed}ms, scriptId=${scriptId}`
  );

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

  log.debug(`removePreloadScript: scriptId=${scriptId}`);
  const start = Date.now();

  await browser.scripting.unregisterContentScripts({ ids: [registrationId] });

  registeredScripts.delete(scriptId);

  const elapsed = Date.now() - start;
  log.debug(`removePreloadScript: completed in ${elapsed}ms`);
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
