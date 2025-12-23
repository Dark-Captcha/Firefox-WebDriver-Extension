/**
 * @fileoverview Frame switching handlers for browsingContext module.
 * @module modules/browsingContext/frames
 */

// ============================================================================
// Imports
// ============================================================================

import type { RequestContext } from "../../../types/index.js";

import { createLogger } from "../../../core/logger.js";
import { patternToRegex } from "../../../core/utils.js";

// ============================================================================
// Types
// ============================================================================

interface FrameInfo {
  frameId: number;
  parentFrameId: number;
  url: string;
}

interface SwitchToFrameParams {
  elementId: string;
}

interface SwitchToFrameByIndexParams {
  index: number;
}

interface SwitchToFrameByUrlParams {
  urlPattern: string;
}

interface FrameResult {
  frameId: number;
}

interface FrameCountResult {
  count: number;
}

interface AllFramesResult {
  frames: FrameInfo[];
}

// ============================================================================
// Constants
// ============================================================================

const log = createLogger("Frames");

// ============================================================================
// Implementation
// ============================================================================

async function getChildFrames(
  tabId: number,
  parentFrameId: number
): Promise<FrameInfo[]> {
  const frames = await browser.webNavigation.getAllFrames({ tabId });
  if (!frames) return [];

  return frames
    .filter((f) => f.parentFrameId === parentFrameId)
    .map((f) => ({
      frameId: f.frameId,
      parentFrameId: f.parentFrameId,
      url: f.url,
    }));
}

async function handleSwitchToFrame(
  params: unknown,
  ctx: RequestContext
): Promise<FrameResult> {
  const { elementId } = params as SwitchToFrameParams;

  if (!elementId) {
    throw new Error("elementId is required");
  }

  log.debug(
    `switchToFrame: elementId=${elementId}, tab=${ctx.tabId}, frame=${ctx.frameId}`
  );

  const childFrames = await getChildFrames(ctx.tabId, ctx.frameId);
  log.debug(`Found ${childFrames.length} child frames`);

  if (childFrames.length === 0) {
    throw new Error("No child frames found in current context");
  }

  const response = (await browser.tabs.sendMessage(ctx.tabId, {
    type: "FRAME_GET_INDEX",
    elementId,
    frameId: ctx.frameId,
  })) as { success: boolean; frameIndex?: number; error?: string };

  if (!response || !response.success) {
    throw new Error(
      response?.error ?? "Failed to get frame index from element"
    );
  }

  const frameIndex = response.frameIndex as number;
  log.debug(`Element maps to frame index: ${frameIndex}`);

  if (frameIndex < 0 || frameIndex >= childFrames.length) {
    throw new Error(
      `Frame index ${frameIndex} out of bounds (${childFrames.length} frames)`
    );
  }

  const targetFrame = childFrames[frameIndex];
  if (!targetFrame) {
    throw new Error(`No frame at index ${frameIndex}`);
  }

  log.info(
    `Switched to frame: ${targetFrame.frameId} (url: ${targetFrame.url})`
  );

  return { frameId: targetFrame.frameId };
}

async function handleSwitchToFrameByIndex(
  params: unknown,
  ctx: RequestContext
): Promise<FrameResult> {
  const { index } = params as SwitchToFrameByIndexParams;

  if (index === undefined || index < 0) {
    throw new Error("Valid index is required");
  }

  log.debug(
    `switchToFrameByIndex: index=${index}, tab=${ctx.tabId}, frame=${ctx.frameId}`
  );

  const childFrames = await getChildFrames(ctx.tabId, ctx.frameId);

  if (index >= childFrames.length) {
    throw new Error(
      `Frame index ${index} out of bounds (${childFrames.length} frames)`
    );
  }

  const targetFrame = childFrames[index];
  if (!targetFrame) {
    throw new Error(`No frame at index ${index}`);
  }

  log.info(
    `Switched to frame by index: ${targetFrame.frameId} (url: ${targetFrame.url})`
  );

  return { frameId: targetFrame.frameId };
}

async function handleSwitchToFrameByUrl(
  params: unknown,
  ctx: RequestContext
): Promise<FrameResult> {
  const { urlPattern } = params as SwitchToFrameByUrlParams;

  if (!urlPattern) {
    throw new Error("urlPattern is required");
  }

  log.debug(
    `switchToFrameByUrl: pattern=${urlPattern}, tab=${ctx.tabId}, frame=${ctx.frameId}`
  );

  const childFrames = await getChildFrames(ctx.tabId, ctx.frameId);
  const regex = patternToRegex(urlPattern);

  const targetFrame = childFrames.find((f) => regex.test(f.url));
  if (!targetFrame) {
    throw new Error(`No frame matching URL pattern: ${urlPattern}`);
  }

  log.info(
    `Switched to frame by URL: ${targetFrame.frameId} (url: ${targetFrame.url})`
  );

  return { frameId: targetFrame.frameId };
}

async function handleSwitchToParentFrame(
  _params: unknown,
  ctx: RequestContext
): Promise<FrameResult> {
  log.debug(`switchToParentFrame: tab=${ctx.tabId}, frame=${ctx.frameId}`);

  if (ctx.frameId === 0) {
    log.debug("Already in main frame");
    return { frameId: 0 };
  }

  const frames = await browser.webNavigation.getAllFrames({ tabId: ctx.tabId });
  const currentFrame = frames?.find((f) => f.frameId === ctx.frameId);

  if (!currentFrame) {
    throw new Error(`Current frame not found: ${ctx.frameId}`);
  }

  log.info(`Switched to parent frame: ${currentFrame.parentFrameId}`);

  return { frameId: currentFrame.parentFrameId };
}

async function handleGetFrameCount(
  _params: unknown,
  ctx: RequestContext
): Promise<FrameCountResult> {
  log.debug(`getFrameCount: tab=${ctx.tabId}, frame=${ctx.frameId}`);

  const childFrames = await getChildFrames(ctx.tabId, ctx.frameId);

  log.debug(`Frame count: ${childFrames.length}`);

  return { count: childFrames.length };
}

async function handleGetAllFrames(
  _params: unknown,
  ctx: RequestContext
): Promise<AllFramesResult> {
  log.debug(`getAllFrames: tab=${ctx.tabId}`);

  const frames = await browser.webNavigation.getAllFrames({ tabId: ctx.tabId });

  const frameInfos: FrameInfo[] = (frames ?? []).map((f) => ({
    frameId: f.frameId,
    parentFrameId: f.parentFrameId,
    url: f.url,
  }));

  log.debug(`Total frames: ${frameInfos.length}`);

  return { frames: frameInfos };
}

// ============================================================================
// Exports
// ============================================================================

export {
  handleSwitchToFrame,
  handleSwitchToFrameByIndex,
  handleSwitchToFrameByUrl,
  handleSwitchToParentFrame,
  handleGetFrameCount,
  handleGetAllFrames,
};
