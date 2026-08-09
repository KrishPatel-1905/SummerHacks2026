import { waitUntil } from "@vercel/functions";
import { Memory } from "../models/Memory.js";
import { imageStorage } from "../storage/index.js";
import { publishEventUpdate } from "./eventStream.js";
import { analyzeVision, VISION_ANALYSIS_VERSION } from "./visionAnalysisService.js";

const MAX_ATTEMPTS = 3;
const STALE_PROCESSING_MS = 5 * 60_000;
const RETRY_DELAYS_MS = [15_000, 60_000, 5 * 60_000];

function isPermanentFailure(error) {
  if (error?.permanent) return true;
  const status = Number(error?.status || error?.statusCode);
  return status >= 400 && status < 500 && ![408, 409, 425, 429].includes(status);
}

function dueFilter(now) {
  return {
    $or: [
      { visionStatus: "pending", $or: [{ nextVisionAttemptAt: null }, { nextVisionAttemptAt: { $lte: now } }] },
      { visionStatus: "processing", visionStartedAt: { $lte: new Date(now.getTime() - STALE_PROCESSING_MS) } },
    ],
  };
}

export async function claimMemoryForVision(memoryId = null, { eventId = null, now = new Date() } = {}) {
  const filter = { visionAttempts: { $lt: MAX_ATTEMPTS }, ...dueFilter(now) };
  if (memoryId) filter._id = memoryId;
  if (eventId) filter.eventId = eventId;
  return Memory.findOneAndUpdate(filter, {
    $set: { visionStatus: "processing", visionStartedAt: now, visionError: null },
    $inc: { visionAttempts: 1 },
  }, { new: true }).select("+visionAttempts +visionStartedAt +visionError +nextVisionAttemptAt");
}

export async function processMemoryVision(memoryId = null, options = {}) {
  const memory = await claimMemoryForVision(memoryId, options);
  if (!memory) return null;
  const analyzer = options.analyzer || analyzeVision;
  const storage = options.storage || imageStorage;
  try {
    const [image, drawing] = await Promise.all([
      memory.imageUrl ? storage.read(memory.imageUrl) : null,
      memory.envelopeDrawing ? storage.read(memory.envelopeDrawing) : null,
    ]);
    if (!image && !drawing) {
      memory.visionStatus = "skipped";
      memory.visionAnalysis = null;
      memory.visionError = null;
      memory.nextVisionAttemptAt = null;
      await memory.save();
      return memory;
    }
    const result = await analyzer({ image, drawing });
    memory.visionStatus = result.status === "skipped" ? "skipped" : "complete";
    memory.visionAnalysis = result.analysis;
    memory.visionAnalysisVersion = VISION_ANALYSIS_VERSION;
    memory.visionModel = result.model;
    memory.visionAnalyzedAt = new Date();
    memory.visionStartedAt = null;
    memory.visionError = null;
    memory.nextVisionAttemptAt = null;
    await memory.save();
    publishEventUpdate(memory.eventId, "analysis-updated", { memoryId: String(memory._id), visionStatus: memory.visionStatus });
    return memory;
  } catch (error) {
    const permanent = isPermanentFailure(error) || memory.visionAttempts >= MAX_ATTEMPTS;
    memory.visionStatus = permanent ? "failed" : "pending";
    memory.visionStartedAt = null;
    memory.visionError = String(error?.message || "Vision analysis failed.").slice(0, 500);
    memory.nextVisionAttemptAt = permanent ? null : new Date(Date.now() + RETRY_DELAYS_MS[Math.min(memory.visionAttempts - 1, RETRY_DELAYS_MS.length - 1)]);
    await memory.save();
    publishEventUpdate(memory.eventId, "analysis-updated", { memoryId: String(memory._id), visionStatus: memory.visionStatus });
    return memory;
  }
}

export async function processPendingVisionBatch({ eventId = null, limit = 10, concurrency = 2, analyzer, storage } = {}) {
  const summary = { completed: 0, failed: 0, pending: 0, skipped: 0 };
  let claimed = 0;
  async function worker() {
    while (claimed < limit) {
      claimed += 1;
      const memory = await processMemoryVision(null, { eventId, analyzer, storage });
      if (!memory) return;
      const key = memory.visionStatus === "complete" ? "completed" : memory.visionStatus;
      if (key in summary) summary[key] += 1;
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, limit) }, () => worker()));
  return summary;
}

export async function queueStaleEventVision(eventId) {
  return Memory.updateMany({
    eventId,
    visionStatus: "complete",
    visionAnalysisVersion: { $ne: VISION_ANALYSIS_VERSION },
    $or: [{ imageUrl: { $ne: null } }, { envelopeDrawing: { $ne: null } }],
  }, {
    $set: {
      visionStatus: "pending",
      visionAttempts: 0,
      visionError: null,
      visionStartedAt: null,
      nextVisionAttemptAt: null,
    },
  });
}

function keepAlive(promise) {
  const guarded = promise.catch((error) => console.error({ component: "vision-analysis", error: error?.message || error }));
  if (process.env.VERCEL) waitUntil(guarded);
  return guarded;
}

export function scheduleMemoryVision(memoryId) {
  if (!process.env.GEMINI_API_KEY) return null;
  return keepAlive(processMemoryVision(memoryId));
}

export function scheduleEventVision(eventId) {
  if (!process.env.GEMINI_API_KEY) return null;
  return keepAlive((async () => {
    await queueStaleEventVision(eventId);
    return processPendingVisionBatch({ eventId, limit: 10, concurrency: 2 });
  })());
}
