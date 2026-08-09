import assert from "node:assert/strict";

const origin = (process.env.SMOKE_ORIGIN || "http://localhost:3000").replace(/\/$/, "");
let event;
let ownerToken;

async function json(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${payload.error || "request failed"}`);
  return payload;
}

try {
  const health = await json(await fetch(`${origin}/ready`));
  assert.equal(health.database, "connected");

  ({ event, ownerToken } = await json(await fetch(`${origin}/api/v1/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `Smoke Test ${new Date().toISOString()}`, capacity: 10, timezone: "UTC" }),
  })));
  assert.match(event.inviteCode, /^\d{6}$/);
  assert.ok(ownerToken);

  const joined = await json(await fetch(`${origin}/api/v1/events/join/${event.inviteCode}`));
  assert.equal(joined.event.id, event.id);

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const form = new FormData();
  form.set("message", "We shipped this smoke test together");
  form.set("author", "Smoke");
  form.set("emoji", "🥳");
  form.set("image", new Blob([png], { type: "image/png" }), "smoke.png");
  const memory = await json(await fetch(`${origin}/api/v1/events/${event.id}/memories`, {
    method: "POST",
    headers: { "x-capsule-code": event.inviteCode },
    body: form,
  }));
  assert.equal(memory.memory.analysisStatus, "complete");

  const protectedImage = await fetch(`${origin}${memory.memory.imageUrl}`);
  assert.equal(protectedImage.status, 200);
  assert.equal((await protectedImage.arrayBuffer()).byteLength, png.length);

  const pulse = await json(await fetch(`${origin}/api/v1/events/${event.id}/pulse`, {
    headers: { "x-capsule-code": event.inviteCode },
  }));
  assert.equal(pulse.pulse.analysisCoverage, 100);
  assert.equal(pulse.pulse.memoryCount, 1);

  const closed = await json(await fetch(`${origin}/api/v1/events/${event.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-owner-token": ownerToken },
    body: JSON.stringify({ status: "closed" }),
  }));
  assert.equal(closed.event.status, "closed");

  console.log(`Smoke test passed for capsule ${event.inviteCode}.`);
} finally {
  if (event && ownerToken) {
    const cleanup = await fetch(`${origin}/api/v1/events/${event.id}`, {
      method: "DELETE",
      headers: { "x-owner-token": ownerToken },
    });
    if (!cleanup.ok && cleanup.status !== 404) console.error(`Smoke cleanup failed with ${cleanup.status}.`);
  }
}
