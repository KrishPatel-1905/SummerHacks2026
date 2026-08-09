const buckets = new Map();

export function createRateLimit({ windowMs, max, message }) {
  return function rateLimit(request, response, next) {
    const now = Date.now();
    const key = `${request.ip}:${request.baseUrl}:${request.route?.path || request.path}`;
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;
    bucket.count += 1;
    buckets.set(key, bucket);

    response.set("RateLimit-Limit", String(max));
    response.set("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    response.set("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > max) {
      response.set("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return response.status(429).json({ error: message || "Too many requests. Try again later." });
    }

    if (buckets.size > 10_000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    next();
  };
}
