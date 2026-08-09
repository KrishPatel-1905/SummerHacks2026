import "dotenv/config";
import { pathToFileURL } from "node:url";
import { connectToDatabase, disconnectFromDatabase } from "../server/config/db.js";
import { Memory } from "../server/models/Memory.js";
import { processPendingVisionBatch } from "../server/services/visionProcessor.js";

export const eligibleVisionMemories = { $or: [{ imageUrl: { $ne: null } }, { envelopeDrawing: { $ne: null } }] };
export const memoriesNeedingVisionBackfill = { $and: [eligibleVisionMemories, { $or: [{ visionStatus: { $exists: false } }, { visionStatus: { $in: ["skipped", "failed"] } }] }] };

export async function runVisionBackfill({
  apply = false,
  MemoryModel = Memory,
  processBatch = processPendingVisionBatch,
  geminiApiKey = process.env.GEMINI_API_KEY,
  log = console.log,
} = {}) {
  const [eligibleCount, completeCount, backfillCount, noMediaCount] = await Promise.all([
    MemoryModel.countDocuments(eligibleVisionMemories),
    MemoryModel.countDocuments({ ...eligibleVisionMemories, visionStatus: "complete" }),
    MemoryModel.countDocuments(memoriesNeedingVisionBackfill),
    MemoryModel.countDocuments({ imageUrl: null, envelopeDrawing: null, $or: [{ visionStatus: { $exists: false } }, { visionStatus: { $ne: "skipped" } }] }),
  ]);
  const report = { mode: apply ? "apply" : "dry-run", eligibleCount, completeCount, backfillCount, noMediaCount };
  log(JSON.stringify(report));
  if (!apply) {
    log("Dry run only. Re-run with --apply to process eligible memories.");
    return report;
  } else {
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY is required for --apply.");
    await Promise.all([
      MemoryModel.updateMany(memoriesNeedingVisionBackfill, { $set: { visionStatus: "pending", visionAttempts: 0, visionError: null, nextVisionAttemptAt: null } }),
      MemoryModel.updateMany({ imageUrl: null, envelopeDrawing: null, visionStatus: { $ne: "complete" } }, { $set: { visionStatus: "skipped", visionAnalysis: null } }),
    ]);
    const totals = { completed: 0, failed: 0, pending: 0, skipped: 0 };
    while (true) {
      const batch = await processBatch({ limit: 20, concurrency: 2 });
      const processed = Object.values(batch).reduce((sum, value) => sum + value, 0);
      for (const key of Object.keys(totals)) totals[key] += batch[key] || 0;
      if (!processed) break;
    }
    const result = { mode: "complete", ...totals };
    log(JSON.stringify(result));
    return result;
  }
}

async function main() {
  try {
    await connectToDatabase();
    await runVisionBackfill({ apply: process.argv.includes("--apply") });
  } finally {
    await disconnectFromDatabase();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
