import express from "express";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { connectToDatabase } from "./config/db.js";
import { eventRouter } from "./routes/events.js";
import { imageStorage } from "./storage/index.js";
import { Event } from "./models/Event.js";
import { Memory } from "./models/Memory.js";
import { normalizeInviteCode } from "./services/eventService.js";
import { openApiDocument } from "./openapi.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "true") app.set("trust proxy", true);
  else if (/^\d+$/.test(process.env.TRUST_PROXY || "")) app.set("trust proxy", Number(process.env.TRUST_PROXY));
  app.use((request, response, next) => {
    const startedAt = Date.now();
    request.id = request.get("x-request-id")?.slice(0, 100) || randomUUID();
    response.set({
      "X-Request-ID": request.id,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    });
    if (request.secure) response.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    response.once("finish", () => {
      if (process.env.NODE_ENV === "production") {
        console.info(JSON.stringify({ requestId: request.id, method: request.method, path: request.path, status: response.statusCode, durationMs: Date.now() - startedAt }));
      }
    });
    next();
  });
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_request, response) => response.json({ status: "ok" }));
  app.get("/api/openapi.json", (_request, response) => response.json(openApiDocument));
  app.get("/ready", async (_request, response) => {
    try {
      const connection = await connectToDatabase();
      response.json({ status: "ready", database: connection.connection.readyState === 1 ? "connected" : "connecting" });
    } catch {
      response.status(503).json({ status: "unavailable", database: "disconnected" });
    }
  });

  app.use("/api", async (request, response, next) => {
    const sendJson = response.json.bind(response);
    response.json = (payload) => {
      if (response.statusCode >= 400 && payload?.error) {
        const defaultCodes = { 400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "CONFLICT", 413: "PAYLOAD_TOO_LARGE", 415: "UNSUPPORTED_MEDIA", 423: "CAPSULE_CLOSED", 429: "RATE_LIMITED", 503: "SERVICE_UNAVAILABLE" };
        return sendJson({ ...payload, code: payload.code || defaultCodes[response.statusCode] || "REQUEST_FAILED", requestId: payload.requestId || request.id });
      }
      return sendJson(payload);
    };
    try {
      await connectToDatabase();
      next();
    } catch (error) {
      next(error);
    }
  });
  app.use("/api/v1/events", eventRouter);
  app.use("/api/events", eventRouter);

  app.use("/assets", express.static(path.join(projectRoot, "assets"), { fallthrough: false, maxAge: "1d" }));
  app.get("/uploads/:filename", async (request, response, next) => {
    try {
      await connectToDatabase();
      const url = `/uploads/${path.basename(request.params.filename)}`;
      const memory = await Memory.findOne({ $or: [{ imageUrl: url }, { envelopeDrawing: url }] }).select("eventId");
      if (!memory) return response.status(404).send("Not found.");
      const event = await Event.findById(memory.eventId).select("inviteCode");
      if (!event || normalizeInviteCode(request.query.code) !== event.inviteCode) return response.status(403).send("Forbidden.");
      return imageStorage.send(request.params.filename, response, next);
    } catch (error) {
      next(error);
    }
  });
  for (const filename of ["app.js", "mockData.js", "styles.css"]) {
    app.get(`/${filename}`, (_request, response) => response.sendFile(path.join(projectRoot, filename)));
  }

  app.get(["/", "/create", "/capsules", "/event/:mockCapsuleId", "/:inviteCode"], (request, response, next) => {
    if (request.params.inviteCode && !/^\d{6}$/.test(request.params.inviteCode)) return next();
    response.sendFile(path.join(projectRoot, "index.html"));
  });

  app.use((request, response) => {
    if (request.path.startsWith("/api/")) return response.status(404).json({ error: "Not found.", code: "NOT_FOUND", requestId: request.id });
    response.status(404).send("Not found.");
  });

  app.use((error, request, response, _next) => {
    if (error?.name === "MulterError") {
      const message = error.code === "LIMIT_FILE_SIZE" ? "Image must be 8 MB or smaller." : "Image upload failed.";
      return response.status(413).json({ error: message, code: "UPLOAD_REJECTED", requestId: request.id });
    }
    if (error?.name === "ValidationError") {
      const message = Object.values(error.errors)[0]?.message || "The submitted data is invalid.";
      return response.status(400).json({ error: message, code: "VALIDATION_ERROR", requestId: request.id });
    }
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error({ requestId: request.id, error });
    const code = error?.code && typeof error.code === "string" ? error.code : status >= 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED";
    response.status(status).json({ error: status >= 500 ? "Something went wrong. Try again." : error.message, code, requestId: request.id });
  });

  return app;
}
