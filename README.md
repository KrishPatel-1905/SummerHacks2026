# Event Capsule

Event Capsule is a shared digital keepsake where people can create event capsules, invite others, and collect memories, photos, moods, and messages in one place.

## Getting Started

### Requirements

- Node.js 20 or newer
- MongoDB

### Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Set `MONGODB_URI` in `.env`, then open [http://localhost:3000](http://localhost:3000).

## Event Pulse Analysis

With `GEMINI_API_KEY` configured, photos and envelope drawings are analyzed asynchronously. Photos use a bounded activity taxonomy such as working, studying, celebrating, phone use, or doomscrolling instead of listing incidental objects. Drawing synonyms collapse into broad motifs, and Event Pulse shows at most four ranked visual signals. Older vision results refresh automatically when Event Pulse opens.

## Available Commands

- `npm run dev` — start the development server
- `npm start` — start the application
- `npm test` — run the test suite
- `npm run smoke` — run the smoke test

## Built With

JavaScript, Express, MongoDB, Mongoose, and optional Gemini-powered image analysis.
