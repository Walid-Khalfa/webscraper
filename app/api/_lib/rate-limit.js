import { AppError, getClientIp } from "./http";
import { incrWithExpire } from "./redis";

// In-memory fallback only used when UPSTASH_REDIS_REST_URL is unset OR the
// Redis call fails. Process-local Map keyed by `rl:<scope>:<key>`.
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

function incrementMemoryBucket(scope, key, windowMs) {
  cleanupExpiredBuckets();
  const bucket = getBucket(scope, key, windowMs);
  bucket.count += 1;
  return bucket.count;
}

export async function assertRateLimit(request, scope, { max, windowMs, keySuffix = "" }) {
  const key = `${getClientIp(request)}:${keySuffix}`;

  // Atomic INCR + PEXPIRE-NX via /pipeline. Returns the post-increment count.
  // Falls back to in-memory on any failure or when env is unset.
  const redisCount = await incrWithExpire(`rl:${scope}:${key}`, windowMs);
  const count = redisCount ?? incrementMemoryBucket(scope, key, windowMs);

  if (count > max) {
    throw new AppError("Zu viele Anfragen. Bitte versuchen Sie es in wenigen Sekunden erneut.", 429, "RATE_LIMITED");
  }
}
