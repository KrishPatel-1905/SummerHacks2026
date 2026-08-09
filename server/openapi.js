const eventIdParameter = { name: "eventId", in: "path", required: true, schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" } };
const memoryIdParameter = { name: "memoryId", in: "path", required: true, schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" } };
const capsuleSecurity = [{ capsuleCode: [] }];
const ownerSecurity = [{ ownerToken: [] }];

export const openApiDocument = {
  openapi: "3.1.0",
  info: { title: "Event Capsule API", version: "1.0.0" },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      capsuleCode: { type: "apiKey", in: "header", name: "x-capsule-code" },
      ownerToken: { type: "apiKey", in: "header", name: "x-owner-token" },
    },
  },
  paths: {
    "/events": {
      post: { summary: "Create a capsule", responses: { 201: { description: "Capsule created" }, 400: { description: "Validation failed" }, 429: { description: "Rate limited" } } },
    },
    "/events/join/{inviteCode}": {
      get: { summary: "Join a capsule by its six-digit code", parameters: [{ name: "inviteCode", in: "path", required: true, schema: { type: "string", pattern: "^[0-9]{6}$" } }], responses: { 200: { description: "Capsule found" }, 404: { description: "Code not found" }, 429: { description: "Rate limited" } } },
    },
    "/events/{eventId}": {
      parameters: [eventIdParameter],
      get: { summary: "Read capsule metadata", security: capsuleSecurity, responses: { 200: { description: "Capsule metadata" } } },
      patch: { summary: "Update capsule settings and schedule", security: ownerSecurity, responses: { 200: { description: "Capsule updated" } } },
      delete: { summary: "Delete capsule, memories, and uploads", security: ownerSecurity, responses: { 204: { description: "Capsule deleted" } } },
    },
    "/events/{eventId}/code": {
      parameters: [eventIdParameter],
      post: { summary: "Rotate the capsule invite code", security: ownerSecurity, responses: { 200: { description: "Code rotated" } } },
    },
    "/events/{eventId}/memories": {
      parameters: [eventIdParameter],
      get: { summary: "List a cursor-paginated memory page", security: capsuleSecurity, responses: { 200: { description: "Memory page" } } },
      post: { summary: "Add and analyze a memory; supports Idempotency-Key", security: capsuleSecurity, parameters: [{ name: "Idempotency-Key", in: "header", required: false, schema: { type: "string", minLength: 16, maxLength: 100 } }], responses: { 200: { description: "Existing memory replayed" }, 201: { description: "Memory created" }, 409: { description: "Capsule full" } } },
    },
    "/events/{eventId}/memories/random": {
      parameters: [eventIdParameter],
      get: { summary: "Read one random memory", security: capsuleSecurity, responses: { 200: { description: "Random memory" }, 404: { description: "No memories" } } },
    },
    "/events/{eventId}/memories/{memoryId}": {
      parameters: [eventIdParameter, memoryIdParameter],
      delete: { summary: "Delete one memory and its uploads", security: ownerSecurity, responses: { 204: { description: "Memory deleted" } } },
    },
    "/events/{eventId}/pulse": {
      parameters: [eventIdParameter],
      get: { summary: "Read database-backed Event Pulse analytics", security: capsuleSecurity, responses: { 200: { description: "Analytics" } } },
    },
    "/events/{eventId}/stream": {
      parameters: [eventIdParameter, { name: "code", in: "query", required: true, schema: { type: "string", pattern: "^[0-9]{6}$" } }],
      get: { summary: "Subscribe to realtime Server-Sent Events", responses: { 200: { description: "SSE stream" } } },
    },
    "/events/{eventId}/qr": {
      parameters: [eventIdParameter, { name: "code", in: "query", required: true, schema: { type: "string", pattern: "^[0-9]{6}$" } }],
      get: { summary: "Render a capsule QR code", responses: { 200: { description: "SVG QR code" } } },
    },
  },
};
