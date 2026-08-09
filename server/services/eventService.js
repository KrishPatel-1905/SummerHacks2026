import mongoose from "mongoose";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { Event } from "../models/Event.js";
import { Memory } from "../models/Memory.js";

const MAX_INVITE_ATTEMPTS = 20;

export function normalizeInviteCode(value = "") {
  return String(value).replace(/\s/g, "");
}

function generateInviteCode() {
  return String(randomInt(100_000, 1_000_000));
}

function generateOwnerToken() {
  return randomBytes(32).toString("base64url");
}

function hashOwnerToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function serializeEvent(event, memoryCount = event.memoryCount ?? 0) {
  return {
    id: String(event._id),
    name: event.name,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    timezone: event.timezone,
    capacity: event.capacity,
    accentColor: event.accentColor,
    sticker: event.sticker,
    inviteCode: event.inviteCode,
    status: event.status || "open",
    submissionsOpenAt: event.submissionsOpenAt,
    submissionsCloseAt: event.submissionsCloseAt,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    memoryCount,
  };
}

export function serializeMemory(memory, capsuleCode = null) {
  const protectedUrl = (url) => url && capsuleCode ? `${url}?code=${encodeURIComponent(capsuleCode)}` : url;
  return {
    id: String(memory._id),
    eventId: String(memory.eventId),
    imageUrl: protectedUrl(memory.imageUrl),
    message: memory.message,
    author: memory.author,
    emoji: memory.emoji,
    envelopeColor: memory.envelopeColor,
    envelopeDrawing: protectedUrl(memory.envelopeDrawing),
    analysisStatus: memory.analysisStatus,
    analysis: memory.analysis,
    analysisVersion: memory.analysisVersion,
    analyzedAt: memory.analyzedAt,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
  };
}

export async function createEvent({
  name,
  description = "",
  startDate = null,
  endDate = null,
  timezone = "UTC",
  capacity = 100,
  accentColor = "blue",
  sticker = "star",
  submissionsOpenAt = null,
  submissionsCloseAt = null,
}) {
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedDescription = typeof description === "string" ? description.trim() : "";

  for (let attempt = 0; attempt < MAX_INVITE_ATTEMPTS; attempt += 1) {
    try {
      const ownerToken = generateOwnerToken();
      const event = await Event.create({
        name: normalizedName,
        description: normalizedDescription,
        startDate,
        endDate,
        timezone,
        capacity,
        accentColor,
        sticker,
        inviteCode: generateInviteCode(),
        ownerTokenHash: hashOwnerToken(ownerToken),
        status: "open",
        submissionsOpenAt,
        submissionsCloseAt,
      });
      return { event: serializeEvent(event, 0), ownerToken };
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }

  throw Object.assign(new Error("Could not generate a unique invite code. Try again."), { status: 503 });
}

export async function getEventById(eventId) {
  if (!mongoose.isValidObjectId(eventId)) return null;
  const event = await Event.findById(eventId);
  if (!event) return null;
  return serializeEvent(event);
}

export async function getEventByInviteCode(value) {
  const inviteCode = normalizeInviteCode(value);
  if (!/^\d{6}$/.test(inviteCode)) return null;
  const event = await Event.findOne({ inviteCode });
  if (!event) return null;
  return serializeEvent(event);
}

export async function verifyEventOwner(eventId, token) {
  if (!mongoose.isValidObjectId(eventId) || typeof token !== "string" || !token) return null;
  const event = await Event.findById(eventId).select("+ownerTokenHash");
  if (!event?.ownerTokenHash) return null;
  const expected = Buffer.from(event.ownerTokenHash, "hex");
  const received = Buffer.from(hashOwnerToken(token), "hex");
  return expected.length === received.length && timingSafeEqual(expected, received) ? event : null;
}

export async function rotateEventInviteCode(eventId) {
  for (let attempt = 0; attempt < MAX_INVITE_ATTEMPTS; attempt += 1) {
    try {
      const event = await Event.findByIdAndUpdate(eventId, { $set: { inviteCode: generateInviteCode() } }, { new: true, runValidators: true });
      if (!event) return null;
      return serializeEvent(event);
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  throw Object.assign(new Error("Could not generate a unique invite code. Try again."), { status: 503 });
}

export async function reconcileEventMemoryCounts() {
  const counts = await Memory.aggregate([
    { $group: { _id: "$eventId", count: { $sum: 1 } } },
  ]);
  const countByEvent = new Map(counts.map(({ _id, count }) => [String(_id), count]));
  const events = await Event.find({}).select("_id memoryCount");
  const updates = events
    .filter((event) => event.memoryCount !== (countByEvent.get(String(event._id)) ?? 0))
    .map((event) => ({
      updateOne: {
        filter: { _id: event._id },
        update: { $set: { memoryCount: countByEvent.get(String(event._id)) ?? 0 } },
      },
    }));
  if (updates.length) await Event.bulkWrite(updates);
  await Event.updateMany({ status: { $exists: false } }, { $set: { status: "open" } });
  await Event.updateMany({ timezone: { $exists: false } }, { $set: { timezone: "UTC" } });
  return updates.length;
}
