import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectToDatabase } from "./config/db.js";
import { eventRouter } from "./routes/events.js";
import { uploadDirectory } from "./storage/index.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_request, response) => response.json({ status: "ok" }));
  app.get("/ready", async (_request, response) => {
    try {
      const connection = await connectToDatabase();
      response.json({ status: "ready", database: connection.connection.readyState === 1 ? "connected" : "connecting" });
    } catch {
      response.status(503).json({ status: "unavailable", database: "disconnected" });
    }
  });

  app.use("/api", async (_request, _response, next) => {
    try {
      await connectToDatabase();
      next();
    } catch (error) {
      next(error);
    }
  });
  app.use("/api/events", eventRouter);

  app.use("/assets", express.static(path.join(projectRoot, "assets"), { fallthrough: false, maxAge: "1d" }));
  app.use("/uploads", express.static(uploadDirectory, { dotfiles: "deny", fallthrough: false, maxAge: "1y" }));
  for (const filename of ["app.js", "mockData.js", "styles.css"]) {
    app.get(`/${filename}`, (_request, response) => response.sendFile(path.join(projectRoot, filename)));
  }

  app.get(["/", "/:inviteCode"], (request, response, next) => {
    if (request.params.inviteCode && !/^\d{6}$/.test(request.params.inviteCode)) return next();
    response.sendFile(path.join(projectRoot, "index.html"));
  });

  app.use((request, response) => {
    if (request.path.startsWith("/api/")) return response.status(404).json({ error: "Not found." });
    response.status(404).send("Not found.");
  });

  app.use((error, _request, response, _next) => {
    if (error?.name === "MulterError") {
      const message = error.code === "LIMIT_FILE_SIZE" ? "Image must be 8 MB or smaller." : "Image upload failed.";
      return response.status(413).json({ error: message });
    }
    if (error?.name === "ValidationError") {
      const message = Object.values(error.errors)[0]?.message || "The submitted data is invalid.";
      return response.status(400).json({ error: message });
    }
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error(error);
    response.status(status).json({ error: status >= 500 ? "Something went wrong. Try again." : error.message });
  });

  return app;
}
