import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import QRCode from "qrcode";
import { Event } from "../models/Event.js";
import { Memory } from "../models/Memory.js";
import { imageStorage } from "../storage/index.js";
import { createRateLimit } from "../middleware/rateLimit.js";
import { analyzeMemory, analyzePendingMemories } from "../services/analysisService.js";
import {
  createEvent,
  getEventById,
  getEventByInviteCode,
  normalizeInviteCode,
  serializeMemory,
} from "../services/eventService.js";
import { getEventPulseData } from "../services/pulseService.js";

const router = express.Router();
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const createLimiter = createRateLimit({ windowMs: 15 * 60_000, max: 30, message: "Too many capsules created. Try again later." });
const joinLimiter = createRateLimit({ windowMs: 10 * 60_000, max: 40, message: "Too many code attempts. Try again later." });
const memoryLimiter = createRateLimit({ windowMs: 60_000, max: 30, message: "Too many memories submitted. Slow down for a moment." });

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

router.post("/", createLimiter, async (request, response) => {
  const event = await createEvent(request.body ?? {});
  response.status(201).json({ event });
});

router.get("/join/:inviteCode", joinLimiter, async (request, response) => {
  const inviteCode = normalizeInviteCode(request.params.inviteCode);
  if (!/^\d{6}$/.test(inviteCode)) return response.status(400).json({ error: "Enter a 6-digit invite code." });
  const event = await getEventByInviteCode(inviteCode);
  if (!event) return response.status(404).json({ error: "Couldn’t find that capsule." });
  response.json({ event });
});

router.get("/:eventId", requireEventId, async (request, response) => {
  const event = await getEventById(request.params.eventId);
  if (!event) return response.status(404).json({ error: "Couldn’t find that capsule." });
  response.json({ event });
});

router.get("/:eventId/memories", requireEventId, async (request, response) => {
  const exists = await Event.exists({ _id: request.params.eventId });
  if (!exists) return response.status(404).json({ error: "Couldn’t find that capsule." });
  const memories = await Memory.find({ eventId: request.params.eventId }).sort({ createdAt: 1 });
  response.json({ memories: memories.map(serializeMemory) });
});

router.get("/:eventId/memories/random", requireEventId, async (request, response) => {
  const [memory] = await Memory.aggregate([
    { $match: { eventId: new mongoose.Types.ObjectId(request.params.eventId) } },
    { $sample: { size: 1 } },
  ]);
  if (!memory) return response.status(404).json({ error: "No memories have been sent yet." });
  response.json({ memory: serializeMemory(memory) });
});

router.post("/:eventId/memories", requireEventId, memoryLimiter, upload, async (request, response) => {
  const image = request.files?.image?.[0];
  const drawing = request.files?.envelopeDrawing?.[0];
  if (drawing && drawing.size > 2 * 1024 * 1024) {
    return response.status(413).json({ error: "Envelope drawing is too large." });
  }

  const event = await Event.findOneAndUpdate({
    _id: request.params.eventId,
    $expr: { $lt: [{ $ifNull: ["$memoryCount", 0] }, "$capacity"] },
  }, {
    $inc: { memoryCount: 1 },
  }, { new: true }).select("capacity memoryCount");
  if (!event) {
    const exists = await Event.exists({ _id: request.params.eventId });
    return response.status(exists ? 409 : 404).json({ error: exists ? "This capsule is full." : "Couldn’t find that capsule." });
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
    response.status(201).json({ memory: serializeMemory(memory), memoryCount: event.memoryCount });
  } catch (error) {
    await Promise.all(savedUrls.map((url) => imageStorage.remove(url)));
    await Event.updateOne({ _id: request.params.eventId, memoryCount: { $gt: 0 } }, { $inc: { memoryCount: -1 } });
    throw error;
  }
});

router.get("/:eventId/pulse", requireEventId, async (request, response) => {
  const exists = await Event.exists({ _id: request.params.eventId });
  if (!exists) return response.status(404).json({ error: "Couldn’t find that capsule." });
  await analyzePendingMemories(request.params.eventId);
  response.json({ pulse: await getEventPulseData(request.params.eventId) });
});

router.get("/:eventId/qr", requireEventId, async (request, response) => {
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
