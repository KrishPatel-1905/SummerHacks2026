import { analyzePendingBatch } from "./analysisService.js";

export function startAnalysisWorker({ intervalMs = 15_000, batchSize = 100 } = {}) {
  let running = false;
  let stopped = false;

  async function run() {
    if (running || stopped) return;
    running = true;
    try {
      await analyzePendingBatch({ limit: batchSize });
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
