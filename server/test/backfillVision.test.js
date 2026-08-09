import assert from "node:assert/strict";
import test from "node:test";
import {
  memoriesNeedingVisionBackfill,
  runVisionBackfill,
} from "../../scripts/backfillVision.js";

function fakeMemoryModel(counts, updates = []) {
  let index = 0;
  return {
    countDocuments: async () => counts[index++],
    updateMany: async (filter, update) => updates.push({ filter, update }),
  };
}

test("vision backfill dry-run reports work without mutating records", async () => {
  const updates = [];
  const messages = [];
  const report = await runVisionBackfill({
    MemoryModel: fakeMemoryModel([7, 2, 5, 3], updates),
    processBatch: async () => assert.fail("dry-run must not process work"),
    log: (message) => messages.push(message),
  });
  assert.deepEqual(report, { mode: "dry-run", eligibleCount: 7, completeCount: 2, backfillCount: 5, noMediaCount: 3 });
  assert.equal(updates.length, 0);
  assert.match(messages[1], /dry run only/i);
});

test("vision backfill is resumable, refreshes outdated analyses, skips current and media-less records, and preserves partial failures", async () => {
  const updates = [];
  const batches = [
    { completed: 2, failed: 1, pending: 1, skipped: 1 },
    { completed: 0, failed: 0, pending: 0, skipped: 0 },
  ];
  const result = await runVisionBackfill({
    apply: true,
    geminiApiKey: "test-only",
    MemoryModel: fakeMemoryModel([4, 1, 3, 2], updates),
    processBatch: async ({ concurrency }) => {
      assert.equal(concurrency, 2);
      return batches.shift();
    },
    log: () => {},
  });
  assert.deepEqual(result, { mode: "complete", completed: 2, failed: 1, pending: 1, skipped: 1 });
  assert.equal(updates.length, 2);
  assert.deepEqual(memoriesNeedingVisionBackfill.$and[1].$or[1].visionStatus.$in, ["skipped", "failed"]);
  assert.equal(memoriesNeedingVisionBackfill.$and[1].$or[2].visionStatus, "complete");
  assert.deepEqual(memoriesNeedingVisionBackfill.$and[1].$or[2].visionAnalysisVersion, { $ne: "gemini-vision-v2" });
  assert.equal(updates[1].filter.visionStatus.$ne, "complete");
});
