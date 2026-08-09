import "dotenv/config";
import { createApp } from "../server/app.js";

const app = createApp();
const routedPathParameter = "__eventCapsulePath";

export function restoreRoutedPath(request) {
  const requestUrl = new URL(request.url || "/", "http://event-capsule.local");
  const routedPath = requestUrl.searchParams.get(routedPathParameter);
  if (!routedPath) return;

  requestUrl.searchParams.delete(routedPathParameter);
  const pathname = `/${routedPath.replace(/^\/+/, "")}`;
  const query = requestUrl.searchParams.toString();
  request.url = `${pathname}${query ? `?${query}` : ""}`;
}

export default function handler(request, response) {
  restoreRoutedPath(request);
  return app(request, response);
}
