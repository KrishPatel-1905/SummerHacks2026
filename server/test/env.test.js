import assert from "node:assert/strict";
import test from "node:test";
import { readServerConfig } from "../config/env.js";

test("server configuration validates required and typed values", () => {
  assert.throws(() => readServerConfig({}), /MONGODB_URI/);
  assert.throws(() => readServerConfig({ MONGODB_URI: "https://example.com" }), /MongoDB connection string/);
  assert.throws(() => readServerConfig({ MONGODB_URI: "mongodb://example", PORT: "0" }), /PORT/);
  assert.throws(() => readServerConfig({ MONGODB_URI: "mongodb://example", PUBLIC_APP_URL: "not-a-url" }), /PUBLIC_APP_URL/);
  assert.throws(() => readServerConfig({ MONGODB_URI: "mongodb://example", NODE_ENV: "production" }), /PUBLIC_APP_URL/);
  assert.throws(() => readServerConfig({ MONGODB_URI: "mongodb://example", UPLOAD_STORAGE: "unknown" }), /UPLOAD_STORAGE/);

  assert.deepEqual(readServerConfig({
    MONGODB_URI: "mongodb://example",
    PORT: "3100",
    PUBLIC_APP_URL: "https://capsule.example/",
    NODE_ENV: "production",
    UPLOAD_STORAGE: "gridfs",
    TRUST_PROXY: "1",
  }), {
    mongoUri: "mongodb://example",
    port: 3100,
    publicAppUrl: "https://capsule.example",
    nodeEnv: "production",
    uploadStorage: "gridfs",
    trustProxy: 1,
  });
});
