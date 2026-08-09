import assert from "node:assert/strict";
import test from "node:test";
import { readServerConfig } from "../config/env.js";

test("server configuration validates required and typed values", () => {
  assert.throws(() => readServerConfig({}), /MONGODB_URI/);
  assert.throws(() => readServerConfig({ MONGODB_URI: "mongodb://example", PORT: "0" }), /PORT/);
  assert.throws(() => readServerConfig({ MONGODB_URI: "mongodb://example", PUBLIC_APP_URL: "not-a-url" }), /PUBLIC_APP_URL/);

  assert.deepEqual(readServerConfig({
    MONGODB_URI: "mongodb://example",
    PORT: "3100",
    PUBLIC_APP_URL: "https://capsule.example/",
  }), {
    mongoUri: "mongodb://example",
    port: 3100,
    publicAppUrl: "https://capsule.example",
  });
});
