import assert from "node:assert/strict";
import test from "node:test";
import { analyzeMemory } from "../services/analysisService.js";

test("memory analysis derives mood, themes, and media tags", () => {
  const analysis = analyzeMemory({
    message: "Our friends finished the coding project with pizza",
    emoji: "🥳",
    imageUrl: "/uploads/photo.png",
    envelopeDrawing: "/uploads/drawing.png",
  });

  assert.equal(analysis.mood, "excited");
  assert.deepEqual(analysis.themes, ["achievement", "coding", "friendship", "food"]);
  assert.deepEqual(analysis.visualTags, ["photo", "drawing"]);
  assert.equal(analysis.confidence, 1);
});

test("memory analysis returns safe fallbacks for unknown input", () => {
  const analysis = analyzeMemory({ message: "A singular unforgettable moment", emoji: "?" });
  assert.equal(analysis.mood, "other");
  assert.deepEqual(analysis.themes, ["shared moments"]);
  assert.deepEqual(analysis.visualTags, []);
  assert.equal(analysis.confidence, 0.5);
});
