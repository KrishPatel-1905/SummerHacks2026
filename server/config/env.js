export function readServerConfig(environment = process.env) {
  const mongoUri = environment.MONGODB_URI?.trim();
  if (!mongoUri) throw new Error("MONGODB_URI is required.");
  if (!/^mongodb(?:\+srv)?:\/\//.test(mongoUri)) throw new Error("MONGODB_URI must be a valid MongoDB connection string.");

  const port = Number(environment.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  let publicAppUrl = null;
  if (environment.PUBLIC_APP_URL) {
    try {
      publicAppUrl = new URL(environment.PUBLIC_APP_URL).toString().replace(/\/$/, "");
    } catch {
      throw new Error("PUBLIC_APP_URL must be a valid absolute URL.");
    }
  }

  const nodeEnv = environment.NODE_ENV || "development";
  if (!["development", "test", "production"].includes(nodeEnv)) throw new Error("NODE_ENV must be development, test, or production.");
  if (nodeEnv === "production" && !publicAppUrl) throw new Error("PUBLIC_APP_URL is required in production.");

  const uploadStorage = environment.UPLOAD_STORAGE || "gridfs";
  if (!["gridfs", "local"].includes(uploadStorage)) throw new Error("UPLOAD_STORAGE must be gridfs or local.");

  const trustProxy = environment.TRUST_PROXY === "true"
    ? true
    : /^\d+$/.test(environment.TRUST_PROXY || "")
      ? Number(environment.TRUST_PROXY)
      : false;

  const analysisIntervalMs = Number(environment.ANALYSIS_INTERVAL_MS || 15_000);
  if (!Number.isInteger(analysisIntervalMs) || analysisIntervalMs < 1_000 || analysisIntervalMs > 3_600_000) {
    throw new Error("ANALYSIS_INTERVAL_MS must be an integer between 1000 and 3600000.");
  }

  return { mongoUri, port, publicAppUrl, nodeEnv, uploadStorage, trustProxy, analysisIntervalMs };
}
