import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";

const mongo = await MongoMemoryServer.create();
const uploadDirectory = await mkdtemp(path.join(tmpdir(), "event-capsule-dev-"));
process.env.MONGODB_URI = mongo.getUri("event-capsule-browser-test");
process.env.UPLOAD_DIR = uploadDirectory;
process.env.PUBLIC_APP_URL = "http://127.0.0.1:3100";

const [{ createApp }, { disconnectFromDatabase }] = await Promise.all([
  import("./app.js"),
  import("./config/db.js"),
]);
const server = createApp().listen(3100, "127.0.0.1", () => {
  console.log("Event Capsule browser test server is ready at http://127.0.0.1:3100");
});

async function shutdown() {
  await new Promise((resolve) => server.close(resolve));
  await disconnectFromDatabase();
  await mongo.stop();
  await rm(uploadDirectory, { recursive: true, force: true });
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
