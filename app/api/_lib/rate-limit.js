import { AppError, getClientIp } from "./http";

const buckets = globalThis.__khalfaRateLimitBuckets ?? new Map();
globalThis.__khalfaRateLimitBuckets = buckets;

function getBucket(scope, key, windowMs) {
  const bucketKey = `${scope}:${key}`;
  const now = Date.now();
  const current = buckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    const fresh = { count: 0, resetAt: now + windowMs };
    buckets.set(bucketKey, fresh);
    return fresh;
  }

  return current;
}

function cleanupExpiredBuckets(limit = 200) {
  const now = Date.now();
  let scanned = 0;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
    scanned += 1;
    if (scanned >= limit) break;
  }
}

export function assertRateLimit(request, scope, { max, windowMs, keySuffix = "" }) {
  cleanupExpiredBuckets();
  const key = `${getClientIp(request)}:${keySuffix}`;
  const bucket = getBucket(scope, key, windowMs);
  bucket.count += 1;

  if (bucket.count > max) {
    throw new AppError("Zu viele Anfragen. Bitte versuchen Sie es in wenigen Sekunden erneut.", 429, "RATE_LIMITED");
  }
}

