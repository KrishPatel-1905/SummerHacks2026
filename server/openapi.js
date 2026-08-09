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
      post: { summary: "Create a capsule", responses: { 201: { description: "Capsule created" }, 400: { description: "Validation failed" } } },
    },
    "/events/join/{inviteCode}": {
      get: { summary: "Join a capsule by its six-digit code", parameters: [{ name: "inviteCode", in: "path", required: true, schema: { type: "string", pattern: "^[0-9]{6}$" } }], responses: { 200: { description: "Capsule found" }, 404: { description: "Code not found" } } },
    },
    "/events/{eventId}": {
      get: { summary: "Read capsule metadata", security: [{ capsuleCode: [] }], responses: { 200: { description: "Capsule metadata" } } },
      patch: { summary: "Update capsule settings", security: [{ ownerToken: [] }], responses: { 200: { description: "Capsule updated" } } },
      delete: { summary: "Delete capsule and memories", security: [{ ownerToken: [] }], responses: { 204: { description: "Capsule deleted" } } },
    },
    "/events/{eventId}/memories": {
      get: { summary: "List a cursor-paginated memory page", security: [{ capsuleCode: [] }], responses: { 200: { description: "Memory page" } } },
      post: { summary: "Add and analyze a memory", security: [{ capsuleCode: [] }], responses: { 201: { description: "Memory created" } } },
    },
    "/events/{eventId}/pulse": {
      get: { summary: "Read database-backed Event Pulse analytics", security: [{ capsuleCode: [] }], responses: { 200: { description: "Analytics" } } },
    },
    "/events/{eventId}/stream": {
      get: { summary: "Subscribe to realtime Server-Sent Events", responses: { 200: { description: "SSE stream" } } },
    },
  },
};
