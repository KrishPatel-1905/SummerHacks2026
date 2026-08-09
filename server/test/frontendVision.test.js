import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Event Pulse renders vision coverage, source provenance, and participant disclosure", async () => {
  const app = await readFile(new URL("../../app.js", import.meta.url), "utf8");
  assert.match(app, /anonymous, aggregate Event Pulse trends/);
  assert.match(app, /pulse\.visualSignals/);
  assert.match(app, /pulse-vision-coverage/);
  assert.match(app, /slice\(0, 4\)/);
  assert.match(app, /staleVisionCount.*refreshing/);
  assert.match(app, /BOTH/);
  assert.match(app, /if \(appState\.screen === "pulse"\) await showPulse\(\)/);
  assert.doesNotMatch(app, /GEMINI_API_KEY|AQ\.Ab8RN6/);
});
