import { Memory } from "../models/Memory.js";

const MOODS = new Map([
  ["🙂", "happy"],
  ["🥹", "emotional"],
  ["😭", "tearful"],
  ["🤯", "overwhelmed"],
  ["😴", "tired"],
  ["❤️", "loved"],
  ["❤", "loved"],
  ["😤", "determined"],
  ["🥳", "excited"],
]);

const THEME_KEYWORDS = new Map([
  ["achievement", ["finish", "finished", "ship", "shipped", "built", "won", "win", "demo", "proud", "success"]],
  ["coding", ["code", "coding", "debug", "bug", "hack", "app", "website", "project"]],
  ["friendship", ["friend", "friends", "team", "together", "crew", "everyone"]],
  ["food", ["food", "pizza", "coffee", "snack", "dinner", "lunch"]],
  ["celebration", ["party", "celebrate", "celebration", "music", "dance", "fireworks"]],
  ["learning", ["learn", "learned", "lesson", "mentor", "workshop"]],
  ["challenge", ["hard", "tough", "challenge", "stuck", "exhausted", "chaotic"]],
]);

export function analyzeMemory({ message = "", emoji = "", imageUrl = null, envelopeDrawing = null }) {
  const words = String(message).toLowerCase().match(/[a-z0-9']+/g) ?? [];
  const wordSet = new Set(words);
  const themes = [...THEME_KEYWORDS]
    .filter(([, keywords]) => keywords.some((keyword) => wordSet.has(keyword)))
    .map(([theme]) => theme)
    .slice(0, 4);
  if (!themes.length && words.length) themes.push("shared moments");

  const visualTags = [];
  if (imageUrl) visualTags.push("photo");
  if (envelopeDrawing) visualTags.push("drawing");

  return {
    mood: MOODS.get(String(emoji)) || "other",
    themes,
    visualTags,
    confidence: MOODS.has(String(emoji)) ? 1 : 0.5,
  };
}

export async function analyzeAndSaveMemory(memory) {
  const analysis = analyzeMemory(memory);
  memory.analysis = analysis;
  memory.analysisStatus = "complete";
  memory.analysisVersion = "deterministic-v1";
  memory.analyzedAt = new Date();
  memory.analysisError = null;
  await memory.save();
  return memory;
}

export async function analyzePendingMemories(eventId, { limit = 100 } = {}) {
  const pending = await Memory.find({ eventId, analysisStatus: "pending" })
    .sort({ createdAt: 1 })
    .limit(limit);
  let completed = 0;
  let failed = 0;
  for (const memory of pending) {
    try {
      await analyzeAndSaveMemory(memory);
      completed += 1;
    } catch (error) {
      await Memory.updateOne({ _id: memory._id }, { $set: { analysisStatus: "failed", analysisError: error.message || "Analysis failed." } });
      failed += 1;
    }
  }
  return { completed, failed, remaining: Math.max(0, pending.length - completed - failed) };
}
