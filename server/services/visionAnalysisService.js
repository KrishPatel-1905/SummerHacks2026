import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

export const DEFAULT_VISION_MODEL = "gemini-3.6-flash";
export const VISION_ANALYSIS_VERSION = "gemini-vision-v1";
export const MIN_SIGNAL_CONFIDENCE = 0.6;

const MAX_SIGNALS = 8;
const MAX_THEMES = 4;
const UNSAFE_LABEL = /(?:https?:\/\/|www\.|@|\b\d{3}[-. ]?\d{3}[-. ]?\d{4}\b|\b(?:email|phone number|address|full name)\b)/i;

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["photoSignals", "drawingSignals", "visualThemes"],
  properties: {
    photoSignals: { type: "array", maxItems: MAX_SIGNALS, items: signalSchema("A visible, non-sensitive object or scene in the event photo.") },
    drawingSignals: { type: "array", maxItems: MAX_SIGNALS, items: signalSchema("A literal motif, symbol, or generic text type in the envelope drawing. Never return names or verbatim personal text.") },
    visualThemes: { type: "array", maxItems: MAX_THEMES, items: signalSchema("A broad event theme supported by the photo or drawing.") },
  },
};

function signalSchema(description) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["label", "confidence"],
    properties: {
      label: { type: "string", description },
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

function normalizeSignals(value, limit) {
  if (!Array.isArray(value)) throw new Error("Invalid Gemini vision response.");
  const byLabel = new Map();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const label = normalizeVisionLabel(item.label);
    const confidence = Number(item.confidence);
    if (!label || !Number.isFinite(confidence) || confidence < MIN_SIGNAL_CONFIDENCE || confidence > 1) continue;
    const existing = byLabel.get(label);
    if (!existing || confidence > existing.confidence) byLabel.set(label, { label, confidence: Math.round(confidence * 100) / 100 });
  }
  return [...byLabel.values()].sort((a, b) => b.confidence - a.confidence || a.label.localeCompare(b.label)).slice(0, limit);
}

export function normalizeVisionResult(value) {
  if (!value || typeof value !== "object") throw new Error("Invalid Gemini vision response.");
  return {
    photoSignals: normalizeSignals(value.photoSignals, MAX_SIGNALS),
    drawingSignals: normalizeSignals(value.drawingSignals, MAX_SIGNALS),
    visualThemes: normalizeSignals(value.visualThemes, MAX_THEMES),
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
    text: "Analyze these event-memory visuals for anonymous aggregate trends. Return common, reusable singular labels. Do not identify people, infer sensitive traits, or return names, contact details, addresses, or verbatim personal text. Treat the first image as the event photo and the second as the envelope drawing when present.",
  }];
  if (prepared.photo) input.push({ type: "image", data: prepared.photo.buffer.toString("base64"), mime_type: prepared.photo.mimeType });
  if (prepared.drawing) input.push({ type: "image", data: prepared.drawing.buffer.toString("base64"), mime_type: prepared.drawing.mimeType });

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
