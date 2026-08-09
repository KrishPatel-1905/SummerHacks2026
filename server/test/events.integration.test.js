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
let analyzePendingMemories;

const jsonRequest = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const capsuleRequest = (event, options = {}) => ({
  ...options,
  headers: { ...(options.headers || {}), "x-capsule-code": event.inviteCode },
});

before(async () => {
  mongo = await MongoMemoryServer.create();
  uploadDirectory = await mkdtemp(path.join(tmpdir(), "event-capsule-test-"));
  process.env.MONGODB_URI = mongo.getUri("event-capsule-test");
  process.env.UPLOAD_DIR = uploadDirectory;
  process.env.UPLOAD_STORAGE = "local";

  const [{ createApp }, dbModule, eventModule, memoryModule, analysisModule] = await Promise.all([
    import("../app.js"),
    import("../config/db.js"),
    import("../models/Event.js"),
    import("../models/Memory.js"),
    import("../services/analysisService.js"),
  ]);
  disconnectFromDatabase = dbModule.disconnectFromDatabase;
  Event = eventModule.Event;
  Memory = memoryModule.Memory;
  analyzePendingMemories = analysisModule.analyzePendingMemories;
  server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (disconnectFromDatabase) await disconnectFromDatabase();
  if (mongo) await mongo.stop();
  if (uploadDirectory) await rm(uploadDirectory, { recursive: true, force: true });
});

test("event and memory data persist and power invite, viewer, QR, and pulse APIs", async () => {
  const healthResponse = await fetch(`${origin}/health`);
  assert.equal(healthResponse.status, 200);
  assert.equal((await healthResponse.json()).status, "ok");
  assert.match(healthResponse.headers.get("x-request-id"), /^[a-f\d-]{36}$/);
  assert.equal(healthResponse.headers.get("x-content-type-options"), "nosniff");
  assert.match(healthResponse.headers.get("content-security-policy"), /default-src 'self'/);
  const readyResponse = await fetch(`${origin}/ready`);
  assert.equal(readyResponse.status, 200);
  assert.equal((await readyResponse.json()).database, "connected");
  const openApiResponse = await fetch(`${origin}/api/openapi.json`);
  assert.equal(openApiResponse.status, 200);
  const openApi = await openApiResponse.json();
  assert.equal(openApi.info.version, "1.0.0");
  for (const [apiPath, pathItem] of Object.entries(openApi.paths)) {
    const placeholders = [...apiPath.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
    const parameterNames = (pathItem.parameters || []).filter(({ in: location }) => location === "path").map(({ name }) => name);
    for (const placeholder of placeholders) assert.ok(parameterNames.includes(placeholder) || Object.values(pathItem).some((operation) => operation?.parameters?.some(({ name, in: location }) => name === placeholder && location === "path")));
  }

  const invalidResponse = await fetch(`${origin}/api/events`, jsonRequest({ name: "" }));
  assert.equal(invalidResponse.status, 400);
  assert.equal((await invalidResponse.json()).code, "VALIDATION_ERROR");
  const invalidDateResponse = await fetch(`${origin}/api/events`, jsonRequest({ name: "Bad date", startDate: "2026-99-99" }));
  assert.equal(invalidDateResponse.status, 400);

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
  const { event, ownerToken } = await createResponse.json();
  assert.match(event.id, /^[a-f\d]{24}$/);
  assert.match(event.inviteCode, /^\d{6}$/);
  assert.match(ownerToken, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(event.memoryCount, 0);
  assert.equal(event.accentColor, "mint");

  await Promise.all([Event.syncIndexes(), Memory.syncIndexes()]);
  const [eventIndexes, memoryIndexes] = await Promise.all([Event.collection.indexes(), Memory.collection.indexes()]);
  assert.equal(eventIndexes.find((index) => index.name === "inviteCode_1")?.unique, true);
  assert.ok(memoryIndexes.some((index) => index.name === "eventId_1"));
  assert.ok(memoryIndexes.some((index) => index.name === "eventId_1_createdAt_1"));
  assert.equal(memoryIndexes.find((index) => index.name === "eventId_1_clientRequestId_1")?.unique, true);

  const secondCreateResponse = await fetch(`${origin}/api/events`, jsonRequest({ name: "Another capsule" }));
  const { event: secondEvent } = await secondCreateResponse.json();
  assert.notEqual(secondEvent.inviteCode, event.inviteCode);

  await disconnectFromDatabase();
  const joinResponse = await fetch(`${origin}/api/events/join/${event.inviteCode}`);
  assert.equal(joinResponse.status, 200);
  assert.equal((await joinResponse.json()).event.name, "SummerHacks 2026");
  assert.equal((await fetch(`${origin}/api/v1/events/join/${event.inviteCode}`)).status, 200);
  const badCodeResponse = await fetch(`${origin}/api/events/join/123`);
  assert.equal(badCodeResponse.status, 400);
  const badCodePayload = await badCodeResponse.json();
  assert.equal(badCodePayload.code, "BAD_REQUEST");
  assert.match(badCodePayload.requestId, /^[a-f\d-]{36}$/);
  assert.equal((await fetch(`${origin}/api/events/join/999999`)).status, 404);

  const directInviteResponse = await fetch(`${origin}/${event.inviteCode}`);
  assert.equal(directInviteResponse.status, 200);
  assert.match(directInviteResponse.headers.get("content-type"), /text\/html/);
  assert.match(await directInviteResponse.text(), /id="app"/);
  for (const appPath of ["/create", "/capsules", "/event/summerhacks-2026"]) {
    const appRouteResponse = await fetch(`${origin}${appPath}`);
    assert.equal(appRouteResponse.status, 200);
    assert.match(appRouteResponse.headers.get("content-type"), /text\/html/);
  }

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const memoryForm = new FormData();
  memoryForm.set("message", "We shipped the persistent capsule together.");
  memoryForm.set("author", "Alex");
  memoryForm.set("emoji", "🥹");
  memoryForm.set("envelopeColor", "lavender");
  memoryForm.set("clientRequestId", "550e8400-e29b-41d4-a716-446655440000");
  memoryForm.set("image", new Blob([png], { type: "image/png" }), "memory.png");
  memoryForm.set("envelopeDrawing", new Blob([png], { type: "image/png" }), "drawing.png");

  const memoryResponse = await fetch(`${origin}/api/events/${event.id}/memories`, capsuleRequest(event, { method: "POST", body: memoryForm }));
  assert.equal(memoryResponse.status, 201);
  const { memory, memoryCount } = await memoryResponse.json();
  assert.equal(memoryCount, 1);
  assert.equal(memory.eventId, event.id);
  assert.equal(memory.author, "Alex");
  assert.equal(memory.analysisStatus, "complete");
  assert.equal(memory.analysis.mood, "emotional");
  assert.ok(memory.analysis.themes.includes("achievement"));
  assert.deepEqual(memory.analysis.visualTags.sort(), ["drawing", "photo"]);
  assert.match(memory.imageUrl, /^\/uploads\/memory-/);
  assert.match(memory.envelopeDrawing, /^\/uploads\/drawing-/);
  const replayForm = new FormData();
  replayForm.set("message", "We shipped the persistent capsule together.");
  replayForm.set("emoji", "🥹");
  replayForm.set("clientRequestId", "550e8400-e29b-41d4-a716-446655440000");
  const replayResponse = await fetch(`${origin}/api/events/${event.id}/memories`, capsuleRequest(event, { method: "POST", body: replayForm }));
  assert.equal(replayResponse.status, 200);
  const replay = await replayResponse.json();
  assert.equal(replay.memory.id, memory.id);
  assert.equal(replay.memoryCount, 1);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(await Memory.countDocuments({ eventId: event.id }), 1);
  const storedImagePath = new URL(memory.imageUrl, origin).pathname;
  assert.equal((await readFile(path.join(uploadDirectory, path.basename(storedImagePath)))).length, png.length);
  assert.equal((await fetch(`${origin}${storedImagePath}`)).status, 403);
  const protectedImageResponse = await fetch(`${origin}${memory.imageUrl}`);
  assert.equal(protectedImageResponse.status, 200);
  assert.equal((await protectedImageResponse.arrayBuffer()).byteLength, png.length);

  const invalidImageForm = new FormData();
  invalidImageForm.set("message", "This upload should fail safely");
  invalidImageForm.set("emoji", "🙂");
  invalidImageForm.set("image", new Blob([Buffer.from("not really a png")], { type: "image/png" }), "fake.png");
  const invalidImageResponse = await fetch(`${origin}/api/events/${event.id}/memories`, capsuleRequest(event, { method: "POST", body: invalidImageForm }));
  assert.equal(invalidImageResponse.status, 415);
  const oversizedPng = Buffer.from(png);
  oversizedPng.writeUInt32BE(6000, 16);
  oversizedPng.writeUInt32BE(6000, 20);
  const oversizedImageForm = new FormData();
  oversizedImageForm.set("message", "Oversized image dimensions");
  oversizedImageForm.set("emoji", "🙂");
  oversizedImageForm.set("image", new Blob([oversizedPng], { type: "image/png" }), "oversized.png");
  const oversizedImageResponse = await fetch(`${origin}/api/events/${event.id}/memories`, capsuleRequest(event, { method: "POST", body: oversizedImageForm }));
  assert.equal(oversizedImageResponse.status, 413);
  assert.equal((await Event.findById(event.id)).memoryCount, 1);

  assert.equal((await fetch(`${origin}/api/events/${event.id}`)).status, 403);
  const refreshedEvent = await (await fetch(`${origin}/api/events/${event.id}`, capsuleRequest(event))).json();
  assert.equal(refreshedEvent.event.memoryCount, 1);
  const memories = await (await fetch(`${origin}/api/events/${event.id}/memories`, capsuleRequest(event))).json();
  assert.equal(memories.memories.length, 1);
  assert.equal(memories.memories[0].message, "We shipped the persistent capsule together.");
  assert.equal(memories.memories[0].author, "Alex");
  const randomMemory = await (await fetch(`${origin}/api/events/${event.id}/memories/random`, capsuleRequest(event))).json();
  assert.equal(randomMemory.memory.id, memory.id);

  const initialPulse = await (await fetch(`${origin}/api/events/${event.id}/pulse`, capsuleRequest(event))).json();
  assert.equal(initialPulse.pulse.memoryCount, 1);
  assert.equal(initialPulse.pulse.analyzedMemoryCount, 1);
  assert.equal(initialPulse.pulse.pendingAnalysisCount, 0);
  assert.equal(initialPulse.pulse.analysisCoverage, 100);
  assert.match(initialPulse.pulse.story, /event felt emotional/i);
  assert.equal(initialPulse.pulse.timeline.reduce((sum, point) => sum + point.count, 0), 1);

  await Memory.updateOne({ _id: memory.id }, {
    analysisStatus: "complete",
    analysis: {
      mood: "relieved",
      themes: ["coding", "achievement"],
      visualTags: ["laptop", "crowd"],
      confidence: 0.89,
    },
  });
  const completePulse = await (await fetch(`${origin}/api/events/${event.id}/pulse`, capsuleRequest(event))).json();
  assert.deepEqual(completePulse.pulse.moods[0], { label: "relieved", count: 1, percentage: 100 });
  assert.equal(completePulse.pulse.themes[0].label, "achievement");
  assert.equal(completePulse.pulse.visualTags.length, 2);

  const qrResponse = await fetch(`${origin}/api/events/${event.id}/qr?code=${event.inviteCode}`);
  assert.equal(qrResponse.status, 200);
  assert.match(qrResponse.headers.get("content-type"), /image\/svg\+xml/);
  assert.match(await qrResponse.text(), /<svg/);

  const pendingMemory = await Memory.create({
    eventId: event.id,
    message: "Our team learned together",
    author: "Sam",
    emoji: "🙂",
    analysisStatus: "pending",
    analysis: null,
  });
  await Event.updateOne({ _id: event.id }, { $inc: { memoryCount: 1 } });
  await analyzePendingMemories(event.id);
  const backfilledPulse = await (await fetch(`${origin}/api/events/${event.id}/pulse`, capsuleRequest(event))).json();
  assert.equal(backfilledPulse.pulse.pendingAnalysisCount, 0);
  assert.equal((await Memory.findById(pendingMemory._id)).analysisStatus, "complete");

  const { GridFsStorage } = await import("../storage/gridFsStorage.js");
  const gridStorage = new GridFsStorage("testUploads");
  const gridUrl = await gridStorage.save({ buffer: png, mimetype: "image/png" }, "test");
  const gridFilename = path.basename(gridUrl);
  assert.ok(await Memory.db.db.collection("testUploads.files").findOne({ filename: gridFilename }));
  await gridStorage.remove(gridUrl);
  assert.equal(await Memory.db.db.collection("testUploads.files").findOne({ filename: gridFilename }), null);

  const unauthorizedUpdate = await fetch(`${origin}/api/events/${event.id}`, { ...jsonRequest({ status: "closed" }), method: "PATCH" });
  assert.equal(unauthorizedUpdate.status, 401);
  const wrongOwnerUpdate = await fetch(`${origin}/api/events/${event.id}`, {
    ...jsonRequest({ status: "closed" }),
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-owner-token": "wrong-token" },
  });
  assert.equal(wrongOwnerUpdate.status, 403);

  const opensAt = new Date(Date.now() + 60_000).toISOString();
  const closesAt = new Date(Date.now() + 120_000).toISOString();
  const scheduleResponse = await fetch(`${origin}/api/events/${event.id}`, {
    ...jsonRequest({ submissionsOpenAt: opensAt, submissionsCloseAt: closesAt }),
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-owner-token": ownerToken },
  });
  assert.equal(scheduleResponse.status, 200);
  const scheduledEvent = (await scheduleResponse.json()).event;
  assert.equal(new Date(scheduledEvent.submissionsOpenAt).toISOString(), opensAt);
  assert.equal(new Date(scheduledEvent.submissionsCloseAt).toISOString(), closesAt);
  await fetch(`${origin}/api/events/${event.id}`, {
    ...jsonRequest({ submissionsOpenAt: null, submissionsCloseAt: null }),
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-owner-token": ownerToken },
  });

  const closeResponse = await fetch(`${origin}/api/events/${event.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-owner-token": ownerToken },
    body: JSON.stringify({ status: "closed" }),
  });
  assert.equal(closeResponse.status, 200);
  assert.equal((await closeResponse.json()).event.status, "closed");
  const closedMemoryForm = new FormData();
  closedMemoryForm.set("message", "Should not be accepted");
  closedMemoryForm.set("emoji", "🙂");
  assert.equal((await fetch(`${origin}/api/events/${event.id}/memories`, capsuleRequest(event, { method: "POST", body: closedMemoryForm }))).status, 423);

  const reopenResponse = await fetch(`${origin}/api/events/${event.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-owner-token": ownerToken },
    body: JSON.stringify({ status: "open" }),
  });
  assert.equal((await reopenResponse.json()).event.status, "open");

  const originalInviteCode = event.inviteCode;
  const rotateResponse = await fetch(`${origin}/api/events/${event.id}/code`, {
    method: "POST",
    headers: { "x-owner-token": ownerToken },
  });
  assert.equal(rotateResponse.status, 200);
  const { event: rotatedEvent } = await rotateResponse.json();
  assert.notEqual(rotatedEvent.inviteCode, originalInviteCode);
  assert.equal((await fetch(`${origin}/api/events/join/${originalInviteCode}`)).status, 404);
  assert.equal((await fetch(`${origin}/api/events/join/${rotatedEvent.inviteCode}`)).status, 200);

  const deleteMemoryResponse = await fetch(`${origin}/api/events/${event.id}/memories/${pendingMemory.id}`, {
    method: "DELETE",
    headers: { "x-owner-token": ownerToken },
  });
  assert.equal(deleteMemoryResponse.status, 204);
  assert.equal((await Event.findById(event.id)).memoryCount, 1);

  const capacityResponse = await fetch(`${origin}/api/events`, jsonRequest({ name: "Capacity capsule", capacity: 10 }));
  const { event: capacityEvent } = await capacityResponse.json();
  assert.equal((await fetch(`${origin}/api/events/${capacityEvent.id}/stream?code=000000`)).status, 403);
  const streamController = new AbortController();
  const streamResponse = await fetch(`${origin}/api/events/${capacityEvent.id}/stream?code=${capacityEvent.inviteCode}`, { signal: streamController.signal });
  assert.equal(streamResponse.status, 200);
  assert.match(streamResponse.headers.get("content-type"), /text\/event-stream/);
  const streamReader = streamResponse.body.getReader();
  const firstStreamChunk = await streamReader.read();
  assert.match(new TextDecoder().decode(firstStreamChunk.value), /"type":"connected"/);
  await streamReader.cancel();
  streamController.abort();

  const submissions = await Promise.all(Array.from({ length: 12 }, (_, index) => {
    const form = new FormData();
    form.set("message", `Concurrent memory ${index}`);
    form.set("emoji", "🙂");
    return fetch(`${origin}/api/events/${capacityEvent.id}/memories`, capsuleRequest(capacityEvent, { method: "POST", body: form }));
  }));
  assert.equal(submissions.filter((response) => response.status === 201).length, 10);
  assert.equal(submissions.filter((response) => response.status === 409).length, 2);
  assert.equal((await Event.findById(capacityEvent.id)).memoryCount, 10);
  assert.equal(await Memory.countDocuments({ eventId: capacityEvent.id }), 10);
  assert.equal((await fetch(`${origin}/api/events/${capacityEvent.id}/memories?after=bad-cursor`, capsuleRequest(capacityEvent))).status, 400);
  const firstPage = await (await fetch(`${origin}/api/events/${capacityEvent.id}/memories?limit=4`, capsuleRequest(capacityEvent))).json();
  assert.equal(firstPage.memories.length, 4);
  assert.ok(firstPage.nextCursor);
  const secondPage = await (await fetch(`${origin}/api/events/${capacityEvent.id}/memories?limit=4&after=${firstPage.nextCursor}`, capsuleRequest(capacityEvent))).json();
  assert.equal(secondPage.memories.length, 4);
  assert.ok(secondPage.nextCursor);
  const thirdPage = await (await fetch(`${origin}/api/events/${capacityEvent.id}/memories?limit=4&after=${secondPage.nextCursor}`, capsuleRequest(capacityEvent))).json();
  assert.equal(thirdPage.memories.length, 2);
  assert.equal(thirdPage.nextCursor, null);
  assert.equal(new Set([...firstPage.memories, ...secondPage.memories, ...thirdPage.memories].map((item) => item.id)).size, 10);

  const retryCapsuleResponse = await fetch(`${origin}/api/events`, jsonRequest({ name: "Retry-safe capsule", capacity: 10 }));
  const { event: retryEvent } = await retryCapsuleResponse.json();
  const retrySubmissions = await Promise.all([0, 1].map(() => {
    const form = new FormData();
    form.set("message", "Submit exactly once");
    form.set("emoji", "🙂");
    form.set("clientRequestId", "98e093a7-d7ab-4a2e-b59d-aa8c352e48d4");
    return fetch(`${origin}/api/events/${retryEvent.id}/memories`, capsuleRequest(retryEvent, { method: "POST", body: form }));
  }));
  assert.deepEqual(retrySubmissions.map(({ status }) => status).sort(), [200, 201]);
  assert.equal((await Event.findById(retryEvent.id)).memoryCount, 1);
  assert.equal(await Memory.countDocuments({ eventId: retryEvent.id }), 1);

  const deleteEventResponse = await fetch(`${origin}/api/events/${event.id}`, {
    method: "DELETE",
    headers: { "x-owner-token": ownerToken },
  });
  assert.equal(deleteEventResponse.status, 204);
  assert.equal(await Event.exists({ _id: event.id }), null);
  assert.equal(await Memory.countDocuments({ eventId: event.id }), 0);
});
