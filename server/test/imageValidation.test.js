import assert from "node:assert/strict";
import test from "node:test";
import { validateImageFile } from "../services/imageValidation.js";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

test("image validation checks binary signatures instead of trusting MIME metadata", () => {
  assert.doesNotThrow(() => validateImageFile({ mimetype: "image/png", buffer: png }));
  assert.throws(
    () => validateImageFile({ mimetype: "image/png", buffer: Buffer.from("fake") }),
    (error) => error.status === 415,
  );
  assert.throws(
    () => validateImageFile({ mimetype: "image/jpeg", buffer: png }, { pngOnly: true }),
    (error) => error.status === 415,
  );
});
