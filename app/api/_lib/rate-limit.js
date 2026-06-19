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

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

async function upstashRequest(path, init = {}) {
  const config = getRedisConfig();
  if (!config) return null;

  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.warn("Upstash rate limit fallback triggered:", response.status, details.slice(0, 200));
    return null;
  }

  return response.json();
}

async function incrementRedisBucket(scope, key, windowMs) {
  const config = getRedisConfig();
  if (!config) return null;

  const bucketKey = `rl:${scope}:${key}`;
  try {
    const incrementResult = await upstashRequest(`/incr/${encodeURIComponent(bucketKey)}`, { method: "POST" });
    if (!incrementResult) return null;
    await upstashRequest(`/pexpire/${encodeURIComponent(bucketKey)}/${windowMs}/NX`, { method: "POST" });
    return Number(incrementResult?.result || 0);
  } catch (error) {
    console.warn("Upstash rate limit unavailable, using in-memory fallback.", error?.message || error);
    return null;
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
  const count = (await incrementRedisBucket(scope, key, windowMs)) ?? incrementMemoryBucket(scope, key, windowMs);

  if (count > max) {
    throw new AppError("Zu viele Anfragen. Bitte versuchen Sie es in wenigen Sekunden erneut.", 429, "RATE_LIMITED");
  }
}
