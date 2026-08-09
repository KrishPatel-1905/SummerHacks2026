export function readServerConfig(environment = process.env) {
  const mongoUri = environment.MONGODB_URI?.trim();
  if (!mongoUri) throw new Error("MONGODB_URI is required.");

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

  return { mongoUri, port, publicAppUrl };
}
