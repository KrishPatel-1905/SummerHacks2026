# Event Capsule

Event Capsule is a collaborative digital keepsake for events, celebrations, hackathons, trips, graduations, and shared milestones. Hosts create a customized capsule, invite participants with a six-digit code or QR code, and collect messages, moods, photos, and hand-drawn envelopes. Event Pulse turns those memories into an anonymous aggregate story of the day.

## Live Application

[Open Event Capsule on Vercel](https://summer-hacks2026-nine.vercel.app/)

## Core Features

### Capsule creation and sharing

- Create an event with a name, description, date range, timezone, and capacity.
- Choose from five accent colors and eight event sticker themes.
- Support capsule sizes of 10, 25, 100, or 250 memories.
- Generate a unique six-digit invite code, shareable link, and QR code.
- Join directly with an invite code and retain joined or created capsules in the browser archive.
- Filter the capsule archive by active, ended, created, or joined events.

### Memory collection

- Submit a short message, optional author name, and mood emoji.
- Upload JPEG, PNG, WebP, or GIF photos up to 8 MB.
- Draw directly on the back of an envelope with pointer-based canvas controls, undo, clear, and skip options.
- Choose an envelope color and preview the finished memory before sending it.
- Prevent accidental duplicate submissions with idempotency keys.
- Enforce event capacity and scheduled submission windows atomically.

### Memory experience

- Watch new envelopes animate into the capsule.
- Pick a random memory without immediately repeating the previous selection.
- Rip open an animated envelope to reveal its message, photo, drawing, author, mood, and date.
- Browse backward and forward through stored memories.
- Receive new memories and moderation changes without refreshing the page.

### Event Pulse analytics

- Aggregate participant-selected moods into event-level percentages.
- Extract deterministic themes from memory text immediately after submission.
- Plot memories over time and identify the busiest event hour.
- Generate a concise story of the day from repeated moods, themes, and visual signals.
- Track deterministic and visual-analysis coverage independently.
- Refresh Event Pulse automatically when memories or analyses change.

### Gemini multimodal analysis

- Analyze each photo and envelope drawing together with Gemini 3.6 Flash.
- Classify photos into a bounded activity taxonomy such as working, studying, collaborating, celebrating, phone use, or doomscrolling.
- Use posture, gaze, hand activity, and scene context instead of reporting every incidental object.
- Apply a higher confidence threshold to contextual interpretations such as doomscrolling.
- Consolidate drawing synonyms such as scribble, doodle, and line art into broad motifs.
- Display at most four ranked visual categories with PHOTO, DRAWING, or BOTH provenance.
- Process vision asynchronously so memory submission remains fast.
- Retry transient failures with backoff and preserve deterministic analytics as a fallback.
- Refresh older vision-analysis versions automatically and support a resumable backfill command.
- Avoid identity, demographic, health, and other sensitive-trait inference.

### Owner controls

- Recover owner access through a private owner link.
- Close or reopen submissions.
- Schedule submission opening and closing times.
- Rotate the invite code and invalidate the previous code.
- Delete individual memories or permanently delete the entire capsule and its media.

## Technology Stack

| Layer | Technologies | Purpose |
| --- | --- | --- |
| Frontend | HTML5, CSS3, vanilla JavaScript, ES modules | Framework-free single-page application and hand-drawn responsive interface |
| Browser APIs | Canvas API, Pointer Events, Web Animations API, Fetch, FormData, Blob URLs, Local Storage | Envelope drawing, animations, uploads, API communication, previews, and capsule history |
| Realtime | Server-Sent Events and `EventSource` | Live memory, analytics, lifecycle, and moderation updates |
| Backend | Node.js 20+, Express 5 | HTTP server, API routes, validation, uploads, and static application delivery |
| Database | MongoDB and Mongoose | Persistent event, memory, analytics, status, and ownership metadata |
| Media storage | MongoDB GridFS with a local-file adapter | Durable protected photo and drawing storage behind a shared interface |
| Upload processing | Multer, Sharp | Multipart uploads, binary validation, resizing, orientation, format conversion, and drawing compositing |
| AI | Google GenAI SDK, Gemini Interactions API, Gemini 3.6 Flash | Schema-constrained multimodal photo and drawing classification |
| Deployment | Vercel Functions, Vercel rewrites, `@vercel/functions` `waitUntil` | Serverless Express hosting, SPA routing, and post-response analysis work |
| Sharing | QRCode | SVG invite QR-code generation |
| Configuration | dotenv | Server-only environment configuration |
| API contract | OpenAPI 3.1 | Machine-readable API documentation |
| Testing | Node test runner, Node assert, MongoDB Memory Server, Sharp fixtures | Unit, integration, persistence, upload, security, and Vercel-routing coverage |
| Demo videos | Remotion, React 19, Playwright | Reproducible desktop and mobile product videos using automated browser footage |
| Media output | H.264 video and AAC audio | Finished widescreen and vertical hackathon demo exports |

The primary application deliberately avoids a frontend framework and bundler. Its UI is generated by `app.js`, styled by `styles.css`, and served with the project artwork and locally bundled fonts in `assets/`.

## Architecture

```text
Browser SPA
  |-- capsule creation, joining, memories, drawings, owner controls
  |-- authenticated Server-Sent Events
  v
Vercel rewrites and Function entry point
  v
Express API
  |-- event and memory services
  |-- validation, rate limiting, security headers, request IDs
  |-- deterministic mood and keyword analysis
  |-- asynchronous Gemini vision processing
  v
MongoDB
  |-- Event and Memory collections
  `-- GridFS photo and drawing storage
```

### Memory-analysis flow

1. The participant submits a message, mood, optional photo, and optional envelope drawing.
2. The server validates the request, reserves capsule capacity, and stores the uploads and memory.
3. Deterministic mood and keyword analytics are saved immediately.
4. The successful submission returns without waiting for Gemini.
5. Vercel `waitUntil` schedules multimodal analysis after the response.
6. Gemini returns schema-constrained activity, drawing-motif, and visual-theme signals.
7. Signals are normalized, confidence-filtered, versioned, and stored with the memory.
8. Event Pulse aggregates each label once per memory and broadcasts updates over Server-Sent Events.

## Security and Reliability

- Owner tokens use 32 cryptographically random bytes and are stored only as SHA-256 hashes.
- Owner-token verification uses timing-safe comparison.
- Capsule data and uploaded media require the current invite code.
- Rotating an invite code immediately invalidates the previous code.
- Create, join, memory, and realtime-stream endpoints are rate limited.
- Uploaded files are checked by binary signature and image dimensions instead of trusting MIME metadata.
- Content Security Policy, frame denial, MIME sniffing protection, referrer policy, permissions policy, and HSTS are configured by the server.
- API errors include stable codes and request IDs without exposing server internals.
- Memory creation is idempotent and guarded by a unique database index.
- Capacity updates are atomic under concurrent submissions.
- Vision jobs use atomic claiming, stale-job recovery, three-attempt limits, and exponential backoff.
- Deleting a memory or capsule also deletes its stored media.

## API Overview

The versioned API is available under `/api/v1/events`. Compatibility routes remain under `/api/events`.

| Method and path | Purpose |
| --- | --- |
| `POST /api/v1/events` | Create a capsule and return its one-time owner token |
| `GET /api/v1/events/join/:inviteCode` | Join a capsule with its six-digit code |
| `GET /api/v1/events/:eventId` | Retrieve a capsule with invite-code access |
| `PATCH /api/v1/events/:eventId` | Update owner-controlled settings |
| `DELETE /api/v1/events/:eventId` | Delete a capsule and all associated data |
| `POST /api/v1/events/:eventId/code` | Rotate the invite code |
| `GET /api/v1/events/:eventId/memories` | List memories with cursor pagination |
| `POST /api/v1/events/:eventId/memories` | Submit a multipart memory |
| `GET /api/v1/events/:eventId/memories/random` | Retrieve a random memory |
| `DELETE /api/v1/events/:eventId/memories/:memoryId` | Delete one memory as the owner |
| `GET /api/v1/events/:eventId/pulse` | Retrieve aggregate Event Pulse analytics |
| `GET /api/v1/events/:eventId/stream` | Subscribe to authenticated realtime updates |
| `GET /api/v1/events/:eventId/qr` | Generate an SVG invite QR code |
| `GET /api/openapi.json` | Retrieve the OpenAPI 3.1 document |
| `GET /health` | Confirm that the HTTP process is running |
| `GET /ready` | Confirm that MongoDB is connected |

## Environment Configuration

Production uses server-only environment variables. Secret values must never be committed or exposed to client code.

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `PUBLIC_APP_URL` | Yes | `https://summer-hacks2026-nine.vercel.app` |
| `NODE_ENV` | Yes | Use `production` for the deployed application |
| `UPLOAD_STORAGE` | Recommended | Use `gridfs` for durable production uploads |
| `TRUST_PROXY` | Recommended | Use `true` behind Vercel's proxy |
| `GEMINI_API_KEY` | Optional | Server-only key enabling multimodal analysis |
| `GEMINI_MODEL` | Optional | Defaults to `gemini-3.6-flash` |
| `ANALYSIS_INTERVAL_MS` | Optional | Background-worker polling interval outside Vercel |
| `UPLOAD_DIR` | Optional | Directory used only by the local-file storage adapter |

## Commands

```bash
npm install
npm run dev
npm start
npm test
npm run smoke
npm run backfill:vision
npm run backfill:vision -- --apply
```

- `npm run dev` starts the Node development server in watch mode.
- `npm start` starts the production Node process.
- `npm test` runs the complete unit and integration suite.
- `npm run smoke` exercises a real configured deployment and removes its disposable capsule afterward.
- `npm run backfill:vision` reports memories requiring vision analysis without changing data.
- `npm run backfill:vision -- --apply` processes eligible and outdated memories with concurrency two.

## Project Structure

```text
api/                         Vercel Function entry point
assets/                      Artwork, local fonts, textures, and sample photos
event-capsule-demo-video/    Remotion and Playwright video project plus rendered deliverables
scripts/                     Production smoke test and vision backfill
server/
  config/                    Environment and MongoDB connection
  middleware/                Rate limiting
  models/                    Event and Memory Mongoose schemas
  routes/                    Versioned and compatibility event APIs
  services/                  Analytics, realtime, ownership, pulse, and vision processing
  storage/                   GridFS and local-file storage adapters
  test/                      Unit and integration tests
app.js                       SPA state, rendering, interactions, and API client
index.html                   Application shell
styles.css                   Responsive hand-drawn visual system
server.js                    Long-running Node entry point
vercel.json                  Vercel Function and SPA rewrite configuration
```

## Testing Coverage

The automated suite covers:

- deterministic mood, keyword, and media-tag analysis;
- bounded Gemini schemas, normalization, confidence filtering, and safety refusal;
- blank drawings, missing photos, malformed AI responses, and fallback behavior;
- event creation, joining, owner controls, invite rotation, scheduling, and deletion;
- multipart uploads, signature validation, GridFS reads, and protected media access;
- idempotent retries, concurrent capacity enforcement, and cursor pagination;
- asynchronous vision claiming, retry behavior, legacy refresh, and backfill resumability;
- Pulse deduplication, source provenance, coverage, combined themes, and story generation;
- realtime event streams, Vercel routing, security headers, health checks, and OpenAPI output;
- frontend disclosure, visual coverage, source badges, realtime refresh hooks, and category limits.

## Demo Video Project

`event-capsule-demo-video/` contains a self-contained Remotion project that captures a real browser-driven product flow with Playwright and renders:

- desktop voiceover and captions;
- desktop music and captions;
- vertical mobile voiceover and captions;
- vertical mobile music and captions.

The video pipeline includes original generated music, narration clips, product artwork, automated browser recordings, preview frames, and final H.264/AAC deliverables.
