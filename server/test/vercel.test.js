import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { restoreRoutedPath } from "../../api/index.js";

test("Vercel API rewrites restore the original Express request path", () => {
  const request = {
    url: "/api/index?__eventCapsulePath=%2Fapi%2Fv1%2Fevents%2F123%2Fmemories&after=456&code=583219",
  };

  restoreRoutedPath(request);

  assert.equal(request.url, "/api/v1/events/123/memories?after=456&code=583219");
});

test("Vercel deployment routes API and SPA requests", async () => {
  const configuration = JSON.parse(await readFile(new URL("../../vercel.json", import.meta.url), "utf8"));
  const routes = new Map(configuration.rewrites.map(({ source, destination }) => [source, destination]));

  assert.equal(routes.get("/api/:path*"), "/api/index?__eventCapsulePath=/api/:path*");
  assert.equal(routes.get("/health"), "/api/index?__eventCapsulePath=/health");
  assert.equal(routes.get("/create"), "/index.html");
  assert.equal(routes.get("/capsules"), "/index.html");
});
