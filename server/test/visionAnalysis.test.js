import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  analyzeVision,
  normalizeVisionResult,
  preprocessVisionInputs,
} from "../services/visionAnalysisService.js";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const markedDrawing = await sharp({
  create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
}).composite([{ input: Buffer.from(`<svg width="4" height="4"><path d="M0 0L4 4" stroke="black"/></svg>`) }]).png().toBuffer();

test("vision results normalize labels, filter weak guesses, and preserve provenance", () => {
  const result = normalizeVisionResult({
    photoSignals: [
      { label: " Laptops ", confidence: 0.92 },
      { label: "People", confidence: 0.59 },
      { label: "laptop", confidence: 0.81 },
    ],
    drawingSignals: [
      { label: "Stars", confidence: 0.95 },
      { label: "alex@example.com", confidence: 0.99 },
    ],
    visualThemes: [
      { label: "Teamwork", confidence: 0.88 },
      { label: "Fun", confidence: 0.42 },
    ],
  });

  assert.deepEqual(result.photoSignals, [{ label: "laptop", confidence: 0.92 }]);
  assert.deepEqual(result.drawingSignals, [{ label: "star", confidence: 0.95 }]);
  assert.deepEqual(result.visualThemes, [{ label: "teamwork", confidence: 0.88 }]);
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
  assert.equal(result.analysis.photoSignals[0].label, "laptop");
  assert.equal(result.analysis.drawingSignals[0].label, "star");
});

test("Gemini refusal or empty output fails without exposing raw content", async () => {
  const client = { interactions: { create: async () => ({ output_text: "" }) } };
  await assert.rejects(
    analyzeVision({ image: { buffer: onePixelPng, mimetype: "image/png" }, client }),
    /no usable vision result/i,
  );
});
