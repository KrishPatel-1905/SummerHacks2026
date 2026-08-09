# Event Capsule

Event Capsule is a vanilla JavaScript single-page app backed by Express, MongoDB, and Mongoose. Event capsules, invite codes, memories, envelope drawings, and Event Pulse metadata persist across refreshes.

## Run locally

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI` to a MongoDB deployment you control.
3. Run `npm install` and `npm run dev`.
4. Open `http://localhost:3000`.

Required environment variable:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/event-capsule
```

Optional variables:

```dotenv
PORT=3000
PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
TRUST_PROXY=false
ANALYSIS_INTERVAL_MS=15000
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
UPLOAD_STORAGE=gridfs
UPLOAD_DIR=./uploads
```

`PUBLIC_APP_URL` is used to build the destination encoded in event QR codes. Set it to the deployed app origin in production.

## Image storage

Selected photos and transparent PNG envelope drawings are uploaded as multipart files. The default GridFS adapter persists them in MongoDB Atlas and keeps stable `/uploads/...` URLs. Set `UPLOAD_STORAGE=local` to use `UPLOAD_DIR` during local development. `server/storage/index.js` remains the storage boundary for a future S3, Cloudinary, or Vercel Blob adapter.

Accepted memory photos are JPEG, PNG, WebP, or GIF up to 8 MB. Envelope drawings are transparent PNGs up to 2 MB. Neither is stored as base64 in MongoDB.

## Event Pulse analysis

New memories are analyzed automatically from the participant-selected mood, message keywords, and attached-media metadata. Results are persisted with each memory and aggregated by the read-only pulse endpoint into mood, theme, visual-tag, hourly activity, coverage, and story data. A background worker backfills older pending memories. The deterministic analyzer is the extension point for a future vision or language-model worker.

When `GEMINI_API_KEY` is configured, photos and envelope drawings are analyzed asynchronously with Gemini. Submissions still complete immediately using deterministic mood and keyword analysis. Event Pulse adds ranked visual signals with photo/drawing provenance, vision coverage, combined themes, and repeated visual motifs in the event story. Missing or failed Gemini analysis never deletes or blocks a memory.

Preview a production backfill without changing data:

```bash
npm run backfill:vision
```

After reviewing the counts, process all eligible stored uploads with concurrency two:

```bash
npm run backfill:vision -- --apply
```

## Health checks

- `GET /health` confirms that the HTTP process is running.
- `GET /ready` confirms that MongoDB is connected.

Production startup validates configuration and connects to MongoDB before the server begins listening.

## Deploy on Vercel

The repository includes a Vercel Function entry point and rewrites for the API, health checks, protected uploads, and client-side routes. Configure these project environment variables before deploying:

```dotenv
MONGODB_URI=mongodb+srv://...
PUBLIC_APP_URL=https://your-project.vercel.app
NODE_ENV=production
UPLOAD_STORAGE=gridfs
TRUST_PROXY=true
```

Do not set `PORT` or `UPLOAD_DIR` on Vercel. Redeploy after adding or changing an environment variable.

API v1 is served under `/api/v1`, with the machine-readable contract at `GET /api/openapi.json`. Legacy `/api/events` routes remain available for backward compatibility.

Memory creation accepts an `Idempotency-Key` header (or `clientRequestId` multipart field), so retrying the same submission does not create duplicate memories or consume capacity twice. Uploaded image signatures and dimensions are validated before durable storage.

## Access and ownership

Creating a capsule returns a one-time owner token. The browser stores it locally and uses it for owner-only controls such as scheduling, closing, reopening, moderating, or deleting a capsule and rotating its invite code. A private owner link can transfer or recover those controls in another browser. Owner tokens are stored in MongoDB only as SHA-256 hashes. Capsule data APIs require the current capsule code, and code-entry attempts are rate limited.

## Realtime updates

Participants receive memory, analytics, lifecycle, moderation, and invite-code changes over an authenticated Server-Sent Events stream. The current implementation uses an in-process event bus; multi-instance deployments should replace that bus with Redis Pub/Sub or another shared broker.

## Tests

Run `npm test`. The integration test uses an ephemeral MongoDB instance and covers event creation, invite-code lookup, reconnect persistence, multipart photo/drawing storage and validation, retry idempotency, scheduling, owner controls, pagination, realtime streams, QR generation, and Event Pulse aggregation.

With the application running against Atlas, run `npm run smoke` to create, verify, and automatically remove a real capsule and GridFS upload.
