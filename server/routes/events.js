import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import QRCode from "qrcode";
import { Event } from "../models/Event.js";
import { Memory } from "../models/Memory.js";
import { imageStorage } from "../storage/index.js";
import { createRateLimit } from "../middleware/rateLimit.js";
import { analyzeMemory } from "../services/analysisService.js";
import { validateImageFile } from "../services/imageValidation.js";
import { publishEventUpdate, subscribeToEvent } from "../services/eventStream.js";
import {
  createEvent,
  getEventById,
  getEventByInviteCode,
  normalizeInviteCode,
  rotateEventInviteCode,
  serializeEvent,
  serializeMemory,
  verifyEventOwner,
} from "../services/eventService.js";
import { getEventPulseData } from "../services/pulseService.js";

const router = express.Router();
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const createLimiter = createRateLimit({ windowMs: 15 * 60_000, max: 30, message: "Too many capsules created. Try again later." });
const joinLimiter = createRateLimit({ windowMs: 10 * 60_000, max: 40, message: "Too many code attempts. Try again later." });
const memoryLimiter = createRateLimit({ windowMs: 60_000, max: 30, message: "Too many memories submitted. Slow down for a moment." });
const streamLimiter = createRateLimit({ windowMs: 60_000, max: 12, message: "Too many live connections. Try again shortly." });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 2, fields: 8 },
  fileFilter: (_request, file, callback) => {
    const allowed = file.fieldname === "envelopeDrawing"
      ? file.mimetype === "image/png"
      : ALLOWED_IMAGE_TYPES.has(file.mimetype);
    callback(allowed ? null : Object.assign(new Error("Unsupported image type."), { status: 415 }), allowed);
  },
}).fields([
  { name: "image", maxCount: 1 },
  { name: "envelopeDrawing", maxCount: 1 },
]);

function requireEventId(request, response, next) {
  if (!mongoose.isValidObjectId(request.params.eventId)) {
    return response.status(400).json({ error: "Invalid event id." });
  }
  next();
}

async function requireEventOwner(request, response, next) {
  const token = request.get("x-owner-token");
  if (!token) return response.status(401).json({ error: "Owner token is required." });
  const event = await verifyEventOwner(request.params.eventId, token);
  if (!event) return response.status(403).json({ error: "Owner token is invalid." });
  request.ownerEvent = event;
  next();
}

async function requireCapsuleAccess(request, response, next) {
  const event = await Event.findById(request.params.eventId).select("inviteCode");
  if (!event) return response.status(404).json({ error: "Couldn’t find that capsule." });
  const code = normalizeInviteCode(request.get("x-capsule-code") || request.query.code);
  if (code !== event.inviteCode) return response.status(403).json({ error: "Capsule code is invalid." });
  request.capsuleEvent = event;
  next();
}

router.post("/", createLimiter, async (request, response) => {
  const { event, ownerToken } = await createEvent(request.body ?? {});
  response.status(201).json({ event, ownerToken });
});

router.get("/join/:inviteCode", joinLimiter, async (request, response) => {
  const inviteCode = normalizeInviteCode(request.params.inviteCode);
  if (!/^\d{6}$/.test(inviteCode)) return response.status(400).json({ error: "Enter a 6-digit invite code." });
  const event = await getEventByInviteCode(inviteCode);
  if (!event) return response.status(404).json({ error: "Couldn’t find that capsule." });
  response.json({ event });
});

router.patch("/:eventId", requireEventId, requireEventOwner, async (request, response) => {
  const allowed = ["name", "description", "startDate", "endDate", "timezone", "capacity", "accentColor", "sticker", "status", "submissionsOpenAt", "submissionsCloseAt"];
  for (const key of allowed) {
    if (Object.hasOwn(request.body ?? {}, key)) request.ownerEvent.set(key, request.body[key]);
  }
  await request.ownerEvent.save();
  const event = serializeEvent(request.ownerEvent);
  publishEventUpdate(request.params.eventId, "event-updated", { event });
  response.json({ event });
});

router.post("/:eventId/code", requireEventId, requireEventOwner, async (request, response) => {
  const event = await rotateEventInviteCode(request.params.eventId);
  publishEventUpdate(request.params.eventId, "code-rotated", { event });
  response.json({ event });
});

router.delete("/:eventId/memories/:memoryId", requireEventId, requireEventOwner, async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.memoryId)) return response.status(400).json({ error: "Invalid memory id." });
  const memory = await Memory.findOneAndDelete({ _id: request.params.memoryId, eventId: request.params.eventId });
  if (!memory) return response.status(404).json({ error: "Couldn’t find that memory." });
  await Promise.all([imageStorage.remove(memory.imageUrl), imageStorage.remove(memory.envelopeDrawing)]);
  await Event.updateOne({ _id: request.params.eventId, memoryCount: { $gt: 0 } }, { $inc: { memoryCount: -1 } });
  publishEventUpdate(request.params.eventId, "memory-removed", { memoryId: String(memory._id) });
  response.status(204).end();
});

router.delete("/:eventId", requireEventId, requireEventOwner, async (request, response) => {
  const memories = await Memory.find({ eventId: request.params.eventId }).select("imageUrl envelopeDrawing");
  await Promise.all(memories.flatMap((memory) => [imageStorage.remove(memory.imageUrl), imageStorage.remove(memory.envelopeDrawing)]));
  await Promise.all([
    Memory.deleteMany({ eventId: request.params.eventId }),
    Event.deleteOne({ _id: request.params.eventId }),
  ]);
  publishEventUpdate(request.params.eventId, "event-deleted");
  response.status(204).end();
});

router.get("/:eventId/stream", requireEventId, streamLimiter, requireCapsuleAccess, async (request, response) => {
  response.status(200);
  response.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  response.flushHeaders();

  const send = (message) => response.write(`data: ${JSON.stringify(message)}\n\n`);
  send({ type: "connected", data: {}, sentAt: new Date().toISOString() });
  const unsubscribe = subscribeToEvent(request.params.eventId, send);
  const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 25_000);
  request.once("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

router.get("/:eventId", requireEventId, requireCapsuleAccess, async (request, response) => {
  const event = await getEventById(request.params.eventId);
  if (!event) return response.status(404).json({ error: "Couldn’t find that capsule." });
  response.json({ event });
});

router.get("/:eventId/memories", requireEventId, requireCapsuleAccess, async (request, response) => {
  const exists = await Event.exists({ _id: request.params.eventId });
  if (!exists) return response.status(404).json({ error: "Couldn’t find that capsule." });
  const requestedLimit = Number(request.query.limit || 100);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
    return response.status(400).json({ error: "Memory page limit must be between 1 and 100." });
  }
  const filter = { eventId: request.params.eventId };
  if (request.query.after) {
    if (!mongoose.isValidObjectId(request.query.after)) return response.status(400).json({ error: "Memory cursor is invalid." });
    filter._id = { $gt: new mongoose.Types.ObjectId(request.query.after) };
  }
  const page = await Memory.find(filter).sort({ _id: 1 }).limit(requestedLimit + 1);
  const hasMore = page.length > requestedLimit;
  const memories = hasMore ? page.slice(0, requestedLimit) : page;
  response.json({
    memories: memories.map((memory) => serializeMemory(memory, request.capsuleEvent.inviteCode)),
    nextCursor: hasMore ? String(memories.at(-1)._id) : null,
  });
});

router.get("/:eventId/memories/random", requireEventId, requireCapsuleAccess, async (request, response) => {
  const [memory] = await Memory.aggregate([
    { $match: { eventId: new mongoose.Types.ObjectId(request.params.eventId) } },
    { $sample: { size: 1 } },
  ]);
  if (!memory) return response.status(404).json({ error: "No memories have been sent yet." });
  response.json({ memory: serializeMemory(memory, request.capsuleEvent.inviteCode) });
});

router.post("/:eventId/memories", requireEventId, memoryLimiter, requireCapsuleAccess, upload, async (request, response) => {
  const image = request.files?.image?.[0];
  const drawing = request.files?.envelopeDrawing?.[0];
  validateImageFile(image);
  validateImageFile(drawing, { pngOnly: true });
  if (drawing && drawing.size > 2 * 1024 * 1024) {
    return response.status(413).json({ error: "Envelope drawing is too large." });
  }

  const now = new Date();
  const event = await Event.findOneAndUpdate({
    _id: request.params.eventId,
    status: "open",
    $and: [
      { $or: [{ submissionsOpenAt: null }, { submissionsOpenAt: { $lte: now } }] },
      { $or: [{ submissionsCloseAt: null }, { submissionsCloseAt: { $gt: now } }] },
    ],
    $expr: { $lt: [{ $ifNull: ["$memoryCount", 0] }, "$capacity"] },
  }, {
    $inc: { memoryCount: 1 },
  }, { new: true }).select("capacity memoryCount");
  if (!event) {
    const current = await Event.findById(request.params.eventId).select("status submissionsOpenAt submissionsCloseAt memoryCount capacity");
    if (!current) return response.status(404).json({ error: "Couldn’t find that capsule." });
    if (current.status !== "open") return response.status(423).json({ error: "This capsule is not accepting memories." });
    if (current.submissionsOpenAt && current.submissionsOpenAt > now) return response.status(423).json({ error: "This capsule is not open yet." });
    if (current.submissionsCloseAt && current.submissionsCloseAt <= now) return response.status(423).json({ error: "This capsule is closed." });
    return response.status(409).json({ error: "This capsule is full." });
  }

  const savedUrls = [];
  try {
    const imageUrl = image ? await imageStorage.save(image, "memory") : null;
    if (imageUrl) savedUrls.push(imageUrl);
    const envelopeDrawing = drawing ? await imageStorage.save(drawing, "drawing") : null;
    if (envelopeDrawing) savedUrls.push(envelopeDrawing);

    const analysis = analyzeMemory({
      message: request.body.message,
      emoji: request.body.emoji,
      imageUrl,
      envelopeDrawing,
    });
    const memory = await Memory.create({
      eventId: request.params.eventId,
      imageUrl,
      message: request.body.message,
      author: request.body.author || "",
      emoji: request.body.emoji,
      envelopeColor: request.body.envelopeColor || "cream",
      envelopeDrawing,
      analysisStatus: "complete",
      analysis,
      analysisVersion: "deterministic-v1",
      analyzedAt: new Date(),
    });
    const serializedMemory = serializeMemory(memory, request.capsuleEvent.inviteCode);
    publishEventUpdate(request.params.eventId, "memory-added", { memory: serializedMemory, memoryCount: event.memoryCount });
    response.status(201).json({ memory: serializedMemory, memoryCount: event.memoryCount });
  } catch (error) {
    await Promise.all(savedUrls.map((url) => imageStorage.remove(url)));
    await Event.updateOne({ _id: request.params.eventId, memoryCount: { $gt: 0 } }, { $inc: { memoryCount: -1 } });
    throw error;
  }
});

router.get("/:eventId/pulse", requireEventId, requireCapsuleAccess, async (request, response) => {
  const exists = await Event.exists({ _id: request.params.eventId });
  if (!exists) return response.status(404).json({ error: "Couldn’t find that capsule." });
  const pulse = await getEventPulseData(request.params.eventId);
  publishEventUpdate(request.params.eventId, "pulse-updated", { pulse });
  response.json({ pulse });
});

router.get("/:eventId/qr", requireEventId, requireCapsuleAccess, async (request, response) => {
  const event = await Event.findById(request.params.eventId).select("inviteCode");
  if (!event) return response.status(404).json({ error: "Couldn’t find that capsule." });
  const configuredOrigin = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
  const origin = configuredOrigin || `${request.protocol}://${request.get("host")}`;
  const svg = await QRCode.toString(`${origin}/${event.inviteCode}`, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#090909", light: "#ffffff" },
  });
  response.type("image/svg+xml").send(svg);
});

export { router as eventRouter };
