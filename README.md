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
UPLOAD_DIR=./uploads
```

`PUBLIC_APP_URL` is used to build the destination encoded in event QR codes. Set it to the deployed app origin in production.

## Image storage

Selected photos and transparent PNG envelope drawings are uploaded as multipart files. The default adapter writes them to `UPLOAD_DIR` and MongoDB stores only their `/uploads/...` URLs. `server/storage/index.js` is the storage boundary to replace with Cloudinary, S3, Vercel Blob, or another durable object store for production deployment.

Accepted memory photos are JPEG, PNG, WebP, or GIF up to 8 MB. Envelope drawings are transparent PNGs up to 2 MB. Neither is stored as base64 in MongoDB.

## Event Pulse analysis

New memories are saved with `analysisStatus: "pending"` and `analysis: null`. The pulse endpoint already aggregates completed mood, theme, visual-tag, and hourly activity data from MongoDB. A future TECHNATION worker needs to analyze the photo, message, and emoji, then update the memory to `analysisStatus: "complete"` with the structured `analysis` object (or `"failed"` on failure).

## Tests

Run `npm test`. The integration test uses an ephemeral MongoDB instance and covers event creation, invite-code lookup, reconnect persistence, multipart photo/drawing storage, memory retrieval/random selection, QR generation, and Event Pulse aggregation.
