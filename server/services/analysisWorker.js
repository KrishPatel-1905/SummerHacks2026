import { analyzePendingBatch } from "./analysisService.js";
import { processPendingVisionBatch } from "./visionProcessor.js";

export function startAnalysisWorker({ intervalMs = 15_000, batchSize = 100 } = {}) {
  let running = false;
  let stopped = false;

  async function run() {
    if (running || stopped) return;
    running = true;
    try {
      await Promise.all([
        analyzePendingBatch({ limit: batchSize }),
        process.env.GEMINI_API_KEY ? processPendingVisionBatch({ limit: batchSize, concurrency: 2 }) : null,
      ]);
    } catch (error) {
      console.error({ component: "analysis-worker", error });
    } finally {
      running = false;
    }
  }

  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  run();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
