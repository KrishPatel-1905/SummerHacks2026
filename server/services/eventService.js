import mongoose from "mongoose";
import { Event } from "../models/Event.js";
import { Memory } from "../models/Memory.js";

const MAX_INVITE_ATTEMPTS = 20;

export function normalizeInviteCode(value = "") {
  return String(value).replace(/\s/g, "");
}

function generateInviteCode() {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

export function serializeEvent(event, memoryCount = 0) {
  return {
    id: String(event._id),
    name: event.name,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    capacity: event.capacity,
    accentColor: event.accentColor,
    sticker: event.sticker,
    inviteCode: event.inviteCode,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    memoryCount,
  };
}

export function serializeMemory(memory) {
  return {
    id: String(memory._id),
    eventId: String(memory.eventId),
    imageUrl: memory.imageUrl,
    message: memory.message,
    author: memory.author,
    emoji: memory.emoji,
    envelopeColor: memory.envelopeColor,
    envelopeDrawing: memory.envelopeDrawing,
    analysisStatus: memory.analysisStatus,
    analysis: memory.analysis,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
  };
}

export async function createEvent({
  name,
  description = "",
  startDate = null,
  endDate = null,
  capacity = 100,
  accentColor = "blue",
  sticker = "star",
}) {
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedDescription = typeof description === "string" ? description.trim() : "";

  for (let attempt = 0; attempt < MAX_INVITE_ATTEMPTS; attempt += 1) {
    try {
      const event = await Event.create({
        name: normalizedName,
        description: normalizedDescription,
        startDate,
        endDate,
        capacity,
        accentColor,
        sticker,
        inviteCode: generateInviteCode(),
      });
      return serializeEvent(event, 0);
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
  const memoryCount = await Memory.countDocuments({ eventId: event._id });
  return serializeEvent(event, memoryCount);
}

export async function getEventByInviteCode(value) {
  const inviteCode = normalizeInviteCode(value);
  if (!/^\d{6}$/.test(inviteCode)) return null;
  const event = await Event.findOne({ inviteCode });
  if (!event) return null;
  const memoryCount = await Memory.countDocuments({ eventId: event._id });
  return serializeEvent(event, memoryCount);
}
