import "dotenv/config";
import { createApp } from "./server/app.js";
import { connectToDatabase, disconnectFromDatabase } from "./server/config/db.js";
import { readServerConfig } from "./server/config/env.js";
import { reconcileEventMemoryCounts } from "./server/services/eventService.js";
import { startAnalysisWorker } from "./server/services/analysisWorker.js";

try {
  const { port, publicAppUrl, analysisIntervalMs } = readServerConfig();
  if (publicAppUrl) process.env.PUBLIC_APP_URL = publicAppUrl;
  await connectToDatabase();
  const reconciledEvents = await reconcileEventMemoryCounts();
  const stopAnalysisWorker = startAnalysisWorker({ intervalMs: analysisIntervalMs });
  const app = createApp();
  const server = app.listen(port, () => {
    console.log(`Event Capsule is ready at http://localhost:${port}`);
    if (reconciledEvents) console.log(`Reconciled memory counts for ${reconciledEvents} event(s).`);
  });

  async function shutdown(signal) {
    console.log(`${signal} received; shutting down.`);
    stopAnalysisWorker();
    await new Promise((resolve) => server.close(resolve));
    await disconnectFromDatabase();
  }

  process.once("SIGINT", () => shutdown("SIGINT").then(() => process.exit(0)));
  process.once("SIGTERM", () => shutdown("SIGTERM").then(() => process.exit(0)));
} catch (error) {
  console.error(`Event Capsule failed to start: ${error.message}`);
  process.exitCode = 1;
}
