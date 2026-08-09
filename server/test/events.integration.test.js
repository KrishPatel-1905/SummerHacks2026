import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo;
let server;
let origin;
let uploadDirectory;
let disconnectFromDatabase;
let Event;
let Memory;

const jsonRequest = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

before(async () => {
  mongo = await MongoMemoryServer.create();
  uploadDirectory = await mkdtemp(path.join(tmpdir(), "event-capsule-test-"));
  process.env.MONGODB_URI = mongo.getUri("event-capsule-test");
  process.env.UPLOAD_DIR = uploadDirectory;

  const [{ createApp }, dbModule, eventModule, memoryModule] = await Promise.all([
    import("../app.js"),
    import("../config/db.js"),
    import("../models/Event.js"),
    import("../models/Memory.js"),
  ]);
  disconnectFromDatabase = dbModule.disconnectFromDatabase;
  Event = eventModule.Event;
  Memory = memoryModule.Memory;
  server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  process.env.PUBLIC_APP_URL = origin;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (disconnectFromDatabase) await disconnectFromDatabase();
  if (mongo) await mongo.stop();
  if (uploadDirectory) await rm(uploadDirectory, { recursive: true, force: true });
});

test("event and memory data persist and power invite, viewer, QR, and pulse APIs", async () => {
  const invalidResponse = await fetch(`${origin}/api/events`, jsonRequest({ name: "" }));
  assert.equal(invalidResponse.status, 400);

  const createResponse = await fetch(`${origin}/api/events`, jsonRequest({
    name: "SummerHacks 2026",
    description: "Shared event capsule",
    startDate: "2026-08-08",
    endDate: "2026-08-09",
    capacity: 100,
    accentColor: "mint",
    sticker: "tech",
  }));
  assert.equal(createResponse.status, 201);
  const { event } = await createResponse.json();
  assert.match(event.id, /^[a-f\d]{24}$/);
  assert.match(event.inviteCode, /^\d{6}$/);
  assert.equal(event.memoryCount, 0);
  assert.equal(event.accentColor, "mint");

  await Promise.all([Event.syncIndexes(), Memory.syncIndexes()]);
  const [eventIndexes, memoryIndexes] = await Promise.all([Event.collection.indexes(), Memory.collection.indexes()]);
  assert.equal(eventIndexes.find((index) => index.name === "inviteCode_1")?.unique, true);
  assert.ok(memoryIndexes.some((index) => index.name === "eventId_1"));
  assert.ok(memoryIndexes.some((index) => index.name === "eventId_1_createdAt_1"));

  const secondCreateResponse = await fetch(`${origin}/api/events`, jsonRequest({ name: "Another capsule" }));
  const { event: secondEvent } = await secondCreateResponse.json();
  assert.notEqual(secondEvent.inviteCode, event.inviteCode);

  await disconnectFromDatabase();
  const joinResponse = await fetch(`${origin}/api/events/join/${event.inviteCode}`);
  assert.equal(joinResponse.status, 200);
  assert.equal((await joinResponse.json()).event.name, "SummerHacks 2026");

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const memoryForm = new FormData();
  memoryForm.set("message", "We shipped the persistent capsule together.");
  memoryForm.set("author", "Alex");
  memoryForm.set("emoji", "🥹");
  memoryForm.set("envelopeColor", "lavender");
  memoryForm.set("image", new Blob([png], { type: "image/png" }), "memory.png");
  memoryForm.set("envelopeDrawing", new Blob([png], { type: "image/png" }), "drawing.png");

  const memoryResponse = await fetch(`${origin}/api/events/${event.id}/memories`, { method: "POST", body: memoryForm });
  assert.equal(memoryResponse.status, 201);
  const { memory, memoryCount } = await memoryResponse.json();
  assert.equal(memoryCount, 1);
  assert.equal(memory.eventId, event.id);
  assert.equal(memory.author, "Alex");
  assert.equal(memory.analysisStatus, "pending");
  assert.equal(memory.analysis, null);
  assert.match(memory.imageUrl, /^\/uploads\/memory-/);
  assert.match(memory.envelopeDrawing, /^\/uploads\/drawing-/);
  assert.equal((await readFile(path.join(uploadDirectory, path.basename(memory.imageUrl)))).length, png.length);

  const refreshedEvent = await (await fetch(`${origin}/api/events/${event.id}`)).json();
  assert.equal(refreshedEvent.event.memoryCount, 1);
  const memories = await (await fetch(`${origin}/api/events/${event.id}/memories`)).json();
  assert.equal(memories.memories.length, 1);
  assert.equal(memories.memories[0].message, "We shipped the persistent capsule together.");
  assert.equal(memories.memories[0].author, "Alex");
  const randomMemory = await (await fetch(`${origin}/api/events/${event.id}/memories/random`)).json();
  assert.equal(randomMemory.memory.id, memory.id);

  const pendingPulse = await (await fetch(`${origin}/api/events/${event.id}/pulse`)).json();
  assert.equal(pendingPulse.pulse.memoryCount, 1);
  assert.equal(pendingPulse.pulse.analyzedMemoryCount, 0);
  assert.equal(pendingPulse.pulse.pendingAnalysisCount, 1);
  assert.equal(pendingPulse.pulse.timeline.reduce((sum, point) => sum + point.count, 0), 1);

  await Memory.updateOne({ _id: memory.id }, {
    analysisStatus: "complete",
    analysis: {
      mood: "relieved",
      themes: ["coding", "achievement"],
      visualTags: ["laptop", "crowd"],
      confidence: 0.89,
    },
  });
  const completePulse = await (await fetch(`${origin}/api/events/${event.id}/pulse`)).json();
  assert.deepEqual(completePulse.pulse.moods[0], { label: "relieved", count: 1, percentage: 100 });
  assert.equal(completePulse.pulse.themes[0].label, "achievement");
  assert.equal(completePulse.pulse.visualTags.length, 2);

  const qrResponse = await fetch(`${origin}/api/events/${event.id}/qr`);
  assert.equal(qrResponse.status, 200);
  assert.match(qrResponse.headers.get("content-type"), /image\/svg\+xml/);
  assert.match(await qrResponse.text(), /<svg/);
});
