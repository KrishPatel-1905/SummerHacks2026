import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  analyzeVision,
  DRAWING_MOTIF_LABELS,
  normalizeVisionResult,
  PHOTO_ACTIVITY_LABELS,
  preprocessVisionInputs,
  VISION_ANALYSIS_VERSION,
} from "../services/visionAnalysisService.js";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const markedDrawing = await sharp({
  create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
}).composite([{ input: Buffer.from(`<svg width="4" height="4"><path d="M0 0L4 4" stroke="black"/></svg>`) }]).png().toBuffer();

test("vision results consolidate aliases, reject raw objects, and preserve provenance", () => {
  const result = normalizeVisionResult({
    photoSignals: [
      { label: " Laptops ", confidence: 0.92 },
      { label: "People", confidence: 0.59 },
      { label: "baseball cap", confidence: 0.99 },
    ],
    drawingSignals: [
      { label: "Scribble", confidence: 0.95 },
      { label: "line art", confidence: 0.83 },
      { label: "alex@example.com", confidence: 0.99 },
    ],
    visualThemes: [
      { label: "Teamwork", confidence: 0.88 },
      { label: "Fun", confidence: 0.42 },
    ],
  });

  assert.deepEqual(result.photoSignals, [{ label: "screen use", confidence: 0.92 }]);
  assert.deepEqual(result.drawingSignals, [{ label: "abstract doodle", confidence: 0.95 }]);
  assert.deepEqual(result.visualThemes, [{ label: "teamwork", confidence: 0.88 }]);
});

test("photo behavior labels use stricter confidence and cap each source at two categories", () => {
  const result = normalizeVisionResult({
    photoSignals: [
      { label: "working", confidence: 0.91 },
      { label: "doomscrolling", confidence: 0.79 },
      { label: "doomscrolling", confidence: 0.82 },
      { label: "phone use", confidence: 0.76 },
      { label: "screen use", confidence: 0.69 },
    ],
    drawingSignals: [
      { label: "star", confidence: 0.88 },
      { label: "heart", confidence: 0.8 },
      { label: "flower", confidence: 0.75 },
    ],
    visualThemes: [{ label: "productivity", confidence: 0.86 }],
  });

  assert.deepEqual(result.photoSignals, [
    { label: "working", confidence: 0.91 },
    { label: "doomscrolling", confidence: 0.82 },
  ]);
  assert.deepEqual(result.drawingSignals, [
    { label: "star", confidence: 0.88 },
    { label: "heart", confidence: 0.8 },
  ]);
});

test("vision preprocessing bounds photos and makes transparent drawings visible", async () => {
  const prepared = await preprocessVisionInputs({
    image: { buffer: onePixelPng, mimetype: "image/png" },
    drawing: { buffer: markedDrawing, mimetype: "image/png" },
  });

  assert.equal(prepared.photo.mimeType, "image/jpeg");
  assert.equal(prepared.drawing.mimeType, "image/png");
  assert.ok(prepared.photo.buffer.length > 0);
  assert.ok(prepared.drawing.buffer.length > 0);
});

test("blank drawings are skipped and drawing-only memories remain analyzable", async () => {
  const blank = await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const preparedBlank = await preprocessVisionInputs({ drawing: { buffer: blank, mimetype: "image/png" } });
  assert.equal(preparedBlank.drawing, null);

  let imageCount = 0;
  const client = { interactions: { create: async (request) => {
    imageCount = request.input.filter(({ type }) => type === "image").length;
    return { output_text: JSON.stringify({ photoSignals: [], drawingSignals: [{ label: "Stars", confidence: 0.9 }], visualThemes: [] }) };
  } } };
  const result = await analyzeVision({ drawing: { buffer: markedDrawing, mimetype: "image/png" }, client });
  assert.equal(imageCount, 1);
  assert.equal(result.analysis.drawingSignals[0].label, "star");
});

test("vision normalization rejects malformed model output", () => {
  assert.throws(() => normalizeVisionResult({ photoSignals: "laptop" }), /invalid/i);
});

test("Gemini receives both visual sources and schema-constrained output", async () => {
  let request;
  const client = { interactions: { create: async (value) => {
    request = value;
    return { output_text: JSON.stringify({
      photoSignals: [{ label: "Laptop", confidence: 0.93 }],
      drawingSignals: [{ label: "Star", confidence: 0.9 }],
      visualThemes: [{ label: "Teamwork", confidence: 0.86 }],
    }) };
  } } };
  const result = await analyzeVision({
    image: { buffer: onePixelPng, mimetype: "image/png" },
    drawing: { buffer: markedDrawing, mimetype: "image/png" },
    client,
    model: "test-gemini",
  });
  assert.equal(request.store, false);
  assert.equal(request.response_format.mime_type, "application/json");
  assert.equal(request.input.filter(({ type }) => type === "image").length, 2);
  assert.equal(request.response_format.schema.properties.photoSignals.maxItems, 2);
  assert.deepEqual(request.response_format.schema.properties.photoSignals.items.properties.label.enum, PHOTO_ACTIVITY_LABELS);
  assert.deepEqual(request.response_format.schema.properties.drawingSignals.items.properties.label.enum, DRAWING_MOTIF_LABELS);
  const instructions = request.input.filter(({ type }) => type === "text").map(({ text }) => text).join("\n");
  assert.match(instructions, /laptop alone is not enough/i);
  assert.match(instructions, /doomscrolling.*passively absorbed/i);
  assert.match(instructions, /Event photo:/);
  assert.match(instructions, /Envelope drawing:/);
  assert.equal(VISION_ANALYSIS_VERSION, "gemini-vision-v2");
  assert.equal(result.analysis.photoSignals[0].label, "screen use");
  assert.equal(result.analysis.drawingSignals[0].label, "star");
});

test("Gemini refusal or empty output fails without exposing raw content", async () => {
  const client = { interactions: { create: async () => ({ output_text: "" }) } };
  await assert.rejects(
    analyzeVision({ image: { buffer: onePixelPng, mimetype: "image/png" }, client }),
    /no usable vision result/i,
  );
});
