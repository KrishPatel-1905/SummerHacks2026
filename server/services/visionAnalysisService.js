import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

export const DEFAULT_VISION_MODEL = "gemini-3.6-flash";
export const VISION_ANALYSIS_VERSION = "gemini-vision-v2";
export const MIN_SIGNAL_CONFIDENCE = 0.6;

export const PHOTO_ACTIVITY_LABELS = Object.freeze([
  "working",
  "studying",
  "collaborating",
  "socializing",
  "celebrating",
  "creating",
  "performing",
  "exercising",
  "gaming",
  "eating and drinking",
  "traveling",
  "resting",
  "doomscrolling",
  "phone use",
  "screen use",
]);
export const DRAWING_MOTIF_LABELS = Object.freeze([
  "heart",
  "star",
  "smiley",
  "flower",
  "nature",
  "food",
  "celebration",
  "person",
  "animal",
  "word art",
  "abstract doodle",
]);
export const VISUAL_THEME_LABELS = Object.freeze([
  "achievement",
  "celebration",
  "connection",
  "creativity",
  "learning",
  "play",
  "productivity",
  "relaxation",
  "teamwork",
  "travel",
  "wellness",
]);

const MAX_PHOTO_SIGNALS = 2;
const MAX_DRAWING_SIGNALS = 2;
const MAX_THEMES = 3;
const PHOTO_CONFIDENCE = 0.7;
const DRAWING_CONFIDENCE = 0.65;
const THEME_CONFIDENCE = 0.65;
const DOOMSCROLLING_CONFIDENCE = 0.8;
const UNSAFE_LABEL = /(?:https?:\/\/|www\.|@|\b\d{3}[-. ]?\d{3}[-. ]?\d{4}\b|\b(?:email|phone number|address|full name)\b)/i;

const PHOTO_ALIASES = new Map([
  ["laptop", "screen use"],
  ["computer", "screen use"],
  ["smartphone", "phone use"],
  ["phone", "phone use"],
  ["computer use", "screen use"],
  ["laptop use", "screen use"],
  ["smartphone use", "phone use"],
  ["scrolling", "phone use"],
]);
const DRAWING_ALIASES = new Map([
  ["scribble", "abstract doodle"],
  ["doodle", "abstract doodle"],
  ["line art", "abstract doodle"],
  ["abstract art", "abstract doodle"],
  ["smiley face", "smiley"],
  ["text", "word art"],
  ["word", "word art"],
]);

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["photoSignals", "drawingSignals", "visualThemes"],
  properties: {
    photoSignals: {
      type: "array",
      maxItems: MAX_PHOTO_SIGNALS,
      items: signalSchema("The strongest observable activity in the event photo. Classify the whole scene, not individual objects.", PHOTO_ACTIVITY_LABELS),
    },
    drawingSignals: {
      type: "array",
      maxItems: MAX_DRAWING_SIGNALS,
      items: signalSchema("The strongest broad motif in the envelope drawing. Never return names or verbatim personal text.", DRAWING_MOTIF_LABELS),
    },
    visualThemes: {
      type: "array",
      maxItems: MAX_THEMES,
      items: signalSchema("A broad event theme directly supported by the photo or drawing.", VISUAL_THEME_LABELS),
    },
  },
};

function signalSchema(description, labels) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["label", "confidence"],
    properties: {
      label: { type: "string", enum: labels, description },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
  };
}

function singularize(label) {
  const irregular = new Map([["people", "person"], ["persons", "person"], ["children", "child"], ["men", "man"], ["women", "woman"]]);
  if (irregular.has(label)) return irregular.get(label);
  if (/[^s]ies$/.test(label)) return `${label.slice(0, -3)}y`;
  if (/(ches|shes|xes|zes)$/.test(label)) return label.slice(0, -2);
  if (label.length > 3 && /[^s]s$/.test(label)) return label.slice(0, -1);
  return label;
}

export function normalizeVisionLabel(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw.length > 60 || UNSAFE_LABEL.test(raw)) return null;
  const normalized = singularize(raw
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, " ")
    .replace(/\s+/g, " ")
    .trim());
  return normalized.length >= 2 && normalized.length <= 40 ? normalized : null;
}

function normalizeSignals(value, { limit, allowed, aliases = new Map(), minConfidence = MIN_SIGNAL_CONFIDENCE }) {
  if (!Array.isArray(value)) throw new Error("Invalid Gemini vision response.");
  const byLabel = new Map();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const rawLabel = normalizeVisionLabel(item.label);
    const label = aliases.get(rawLabel) || rawLabel;
    const confidence = Number(item.confidence);
    const requiredConfidence = label === "doomscrolling" ? DOOMSCROLLING_CONFIDENCE : minConfidence;
    if (!label || !allowed.has(label) || !Number.isFinite(confidence) || confidence < requiredConfidence || confidence > 1) continue;
    const existing = byLabel.get(label);
    if (!existing || confidence > existing.confidence) byLabel.set(label, { label, confidence: Math.round(confidence * 100) / 100 });
  }
  return [...byLabel.values()].sort((a, b) => b.confidence - a.confidence || a.label.localeCompare(b.label)).slice(0, limit);
}

export function normalizeVisionResult(value) {
  if (!value || typeof value !== "object") throw new Error("Invalid Gemini vision response.");
  return {
    photoSignals: normalizeSignals(value.photoSignals, {
      limit: MAX_PHOTO_SIGNALS,
      allowed: new Set(PHOTO_ACTIVITY_LABELS),
      aliases: PHOTO_ALIASES,
      minConfidence: PHOTO_CONFIDENCE,
    }),
    drawingSignals: normalizeSignals(value.drawingSignals, {
      limit: MAX_DRAWING_SIGNALS,
      allowed: new Set(DRAWING_MOTIF_LABELS),
      aliases: DRAWING_ALIASES,
      minConfidence: DRAWING_CONFIDENCE,
    }),
    visualThemes: normalizeSignals(value.visualThemes, {
      limit: MAX_THEMES,
      allowed: new Set(VISUAL_THEME_LABELS),
      minConfidence: THEME_CONFIDENCE,
    }),
  };
}

export async function preprocessVisionInputs({ image = null, drawing = null }) {
  const result = { photo: null, drawing: null };
  if (image?.buffer?.length) {
    result.photo = {
      buffer: await sharp(image.buffer, { animated: false }).rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer(),
      mimeType: "image/jpeg",
    };
  }
  if (drawing?.buffer?.length) {
    const resizedDrawing = await sharp(drawing.buffer, { animated: false }).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    const stats = await sharp(resizedDrawing).stats();
    const blank = stats.channels.every((channel) => channel.max - channel.min <= 4);
    if (!blank) {
      result.drawing = {
        buffer: await sharp(resizedDrawing).flatten({ background: "#fff5d8" }).png().toBuffer(),
        mimeType: "image/png",
      };
    }
  }
  return result;
}

export async function analyzeVision({ image = null, drawing = null, model = process.env.GEMINI_MODEL || DEFAULT_VISION_MODEL, client = null } = {}) {
  const prepared = await preprocessVisionInputs({ image, drawing });
  if (!prepared.photo && !prepared.drawing) return { status: "skipped", analysis: null, model };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!client && !apiKey) throw Object.assign(new Error("Gemini vision analysis is not configured."), { code: "VISION_DISABLED", permanent: true });

  const input = [{
    type: "text",
    text: `Analyze these event-memory visuals for anonymous aggregate trends.

For the event photo, classify the visible activity and level of engagement from the whole scene. Prioritize what people are observably doing over objects that happen to be present. Use posture, gaze, hand activity, and surrounding context together. A laptop alone is not enough for "working"; focused typing, reading, notes, or task context can support it. Use "studying" only with visible learning context. Use "doomscrolling" only when a phone is the main activity and the person appears passively absorbed or distracted; otherwise use "phone use". Use "screen use" when the activity cannot be determined. Return at most one primary and one clearly supported secondary photo label.

For the envelope drawing, combine synonymous marks into broad motifs. Scribbles, doodles, and line art are all "abstract doodle". Return at most two clearly supported drawing motifs.

Return an empty array rather than inventing a category. Do not identify people, infer identity, demographics, health, emotion, or other sensitive traits, and do not return names, contact details, addresses, or verbatim personal text.`,
  }];
  if (prepared.photo) {
    input.push({ type: "text", text: "Event photo:" });
    input.push({ type: "image", data: prepared.photo.buffer.toString("base64"), mime_type: prepared.photo.mimeType });
  }
  if (prepared.drawing) {
    input.push({ type: "text", text: "Envelope drawing:" });
    input.push({ type: "image", data: prepared.drawing.buffer.toString("base64"), mime_type: prepared.drawing.mimeType });
  }

  const ai = client || new GoogleGenAI({ apiKey });
  const response = await ai.interactions.create({
    model,
    store: false,
    input,
    response_format: { type: "text", mime_type: "application/json", schema: responseSchema },
  }, { timeout: 30_000 });
  if (!response?.output_text) throw Object.assign(new Error("Gemini returned no usable vision result."), { code: "VISION_EMPTY_RESPONSE", permanent: true });
  let parsed;
  try { parsed = JSON.parse(response.output_text); }
  catch { throw Object.assign(new Error("Gemini returned malformed vision data."), { code: "VISION_INVALID_RESPONSE", permanent: true }); }
  return { status: "complete", analysis: normalizeVisionResult(parsed), model };
}
