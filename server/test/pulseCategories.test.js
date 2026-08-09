import assert from "node:assert/strict";
import test from "node:test";
import { canonicalizeVisualSignal } from "../services/pulseService.js";

test("legacy object detections collapse into broad activity categories", () => {
  assert.equal(canonicalizeVisualSignal("Laptop", "photo"), "screen use");
  assert.equal(canonicalizeVisualSignal("smartphone", "photo"), "screen use");
  assert.equal(canonicalizeVisualSignal("confetti", "photo"), "celebrating");
  assert.equal(canonicalizeVisualSignal("stage light", "photo"), "performing");
  assert.equal(canonicalizeVisualSignal("baseball cap", "photo"), null);
  assert.equal(canonicalizeVisualSignal("water bottle", "photo"), null);
  assert.equal(canonicalizeVisualSignal("window", "photo"), null);
});

test("drawing synonyms collapse while current behavior categories pass through", () => {
  assert.equal(canonicalizeVisualSignal("scribble", "drawing"), "abstract doodle");
  assert.equal(canonicalizeVisualSignal("doodle", "drawing"), "abstract doodle");
  assert.equal(canonicalizeVisualSignal("line art", "drawing"), "abstract doodle");
  assert.equal(canonicalizeVisualSignal("working", "photo"), "working");
  assert.equal(canonicalizeVisualSignal("doomscrolling", "photo"), "doomscrolling");
});
