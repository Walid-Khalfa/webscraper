import { PrismaClient } from "@prisma/client";

// `SKIP_DB_DURING_BUILD=true` (or `NEXT_PHASE === "phase-production-build"`) lets us
// prerender pages on Vercel / in CI without opening DB connections. Reads return safe
// defaults; writes throw a loud error so a misconfigured build can never silently
// corrupt data.
//
// In every other environment we use Prisma's official `$extends` API to throttle
// concurrent DB calls (gated by PRISMA_MAX_CONCURRENT). Using $extends (instead of
// a hand-rolled Promise-wrapping Proxy) preserves the PrismaPromise semantics that
// downstream code relies on:
//   - Fluent API (`prisma.x.findUnique({ include }).posts()`)
//   - Array `$transaction([...])` calls (e.g. `product-insights.js`)
//   - Interactive `$transaction(async (tx) => ...)` calls
//   - Multi-await safety of PrismaPromise
//
// IMPORTANT: the *extended* client (not just the raw client) is cached on
// globalThis. If we re-extended on every HMR reload, the extension stack would
// grow without bound.

const skipFlag = String(process.env.SKIP_DB_DURING_BUILD || process.env.SKIP_DB || "").toLowerCase();
const isNextProductionBuild = process.env.NEXT_PHASE === "phase-production-build";
const skipDuringBuild = skipFlag === "1" || skipFlag === "true" || isNextProductionBuild;

// Free-pass semaphore: rather than `decrement then increment`, pass the baton
// directly. The previous implementation had a tiny window where a synchronous
// awaiter could grab `active` while the queue's microtask was still waking up,
// briefly exceeding the limit. The fix: when releasing and a waiter is queued,
// hand the slot to the waiter without touching the counter.
function createSemaphore(limit) {
  let active = 0;
  const queue = [];
  return {
    async acquire() {
      if (active < limit) {
        active += 1;
        return;
      }
      await new Promise((resolve) => queue.push(resolve));
      // Slot ownership has already been transferred by release(); no-op here.
    },
    release() {
      const next = queue.shift();
      if (next) {
        next();
      } else {
        active = Math.max(0, active - 1);
      }
    },
  };
}

// --- Build-time stub -------------------------------------------------------

// List of client-level Prisma methods that are reads/connect helpers and may run
// safely even without a database (they are no-ops).
const CLIENT_CONNECT_METHODS = new Set(["$connect", "$disconnect"]);

// List of client-level Prisma methods that absolutely must not run during a build
// because they require a real PG connection/middleware setup.
const REJECTED_CLIENT_METHODS = new Set([
  "$transaction",
  "$use",
  "$extends",
  "$on",
  "$metrics",
  "$revisions",
  "$parent",
]);

// Methods that perform writes (must throw during build). Tested case-sensitive
// against PrismaClient method names; "OrThrow" variants inherit this behavior
// (returning null would violate the type contract).
function isPrismaMutation(method) {
  return /^(create|update|delete|upsert|createMany|updateMany|deleteMany|executeRaw|executeRawUnsafe|queryRaw|queryRawUnsafe|connectOrCreate|findUniqueOrThrow|findFirstOrThrow)/i.test(String(method || ""));
}

function isPrismaReading(method) {
  return /^(findFirst|findUnique|findMany|count|aggregate|groupBy|fields)$/i.test(String(method || ""));
}

function makeBuildStubError(model, method, kind) {
  const error = new Error(
    `Prisma ${kind} blocked during build: prisma.${String(model)}.${String(method)}(). ` +
      "SKIP_DB_DURING_BUILD is set or this is a Next.js production-build phase. " +
      "Reads are stubbed to safe defaults; writes and transactions must never happen here.",
  );
  error.name = "PrismaBuildStubError";
  error.code = "PRISMA_BUILD_STUB";
  return error;
}

function makeBuildStubApplyError(model, kind) {
  const error = new Error(
    `Prisma ${kind} blocked during build: prisma.${String(model)}() called as a function. ` +
      "This is not a valid PrismaClient API; reads return safe defaults, writes and " +
      "transactions must never happen during a Next.js production-build phase.",
  );
  error.name = "PrismaBuildStubError";
  error.code = "PRISMA_BUILD_STUB";
  return error;
}

function buildWriteGuardedStubClient() {
  // Each model (e.g. `prisma.agency`, `prisma.$transaction`) returns this proxy.
  function buildModelProxy(modelName) {
    return new Proxy(function () {}, {
      get(_target, method) {
        if (typeof method !== "string") return undefined;
        if (method === "constructor" || method.startsWith("_")) return undefined;

        return async (..._args) => {
          if (isPrismaMutation(method)) throw makeBuildStubError(modelName, method, "write");
          if (/OrThrow$/i.test(method)) throw makeBuildStubError(modelName, method, "write");
          if (isPrismaReading(method)) {
            if (/count|aggregate|groupBy|fields/i.test(method)) return 0;
            if (/findMany/i.test(method)) return [];
            return null;
          }
          // Any unknown method is treated conservatively as a write so a future
          // Prisma version cannot smuggle writes through this stub.
          throw makeBuildStubError(modelName, method, "write");
        };
      },
      // Defense in depth: if someone does `prisma.agency(...)` directly
      // (which is nonsensical anyway), throw loudly instead of returning
      // undefined because the proxy target is a function.
      apply() {
        throw makeBuildStubApplyError(modelName, "write");
      },
    });
  }

  return new Proxy(function () {}, {
    get(_target, prop) {
      if (typeof prop === "symbol") return undefined;
      if (prop === "constructor") return undefined;
      // Don't make the stub itself look like a Promise.
      if (prop === "then" || prop === "catch" || prop === "finally") return undefined;

      if (CLIENT_CONNECT_METHODS.has(prop)) {
        return async () => undefined;
      }

      if (REJECTED_CLIENT_METHODS.has(prop)) {
        return async () => {
          throw makeBuildStubApplyError(prop, "client");
        };
      }

      return buildModelProxy(prop);
    },
    apply() {
      throw makeBuildStubApplyError("(client)", "client");
    },
  });
}

// --- Live client with $extends --------------------------------------------

function createBaseClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error", "warn"],
  });
}

function applyExtensions(baseClient) {
  // Concurrency guard: limit JS-side concurrent Prisma calls to prevent
  // exhausting the DB connection pool during heavy parallel phases
  // (e.g. Next.js build prerendering many pages simultaneously).
  // Tune with PRISMA_MAX_CONCURRENT env var.
  const defaultConcurrency = process.env.NODE_ENV === "production" ? 1 : 4;
  const PRISMA_MAX_CONCURRENT = Math.max(Number(process.env.PRISMA_MAX_CONCURRENT) || defaultConcurrency, 1);
  const semaphore = createSemaphore(PRISMA_MAX_CONCURRENT);

  // Always apply the extension (regardless of limit value) to preserve the
  // throttle semantics users expect from the `PRISMA_MAX_CONCURRENT` knob.
  // The cost is one async tick per query, which is negligible.
  return baseClient.$extends({
    name: "khalfajobs-concurrency-throttle",
    query: {
      async $allOperations({ args, query }) {
        await semaphore.acquire();
        try {
          return await query(args);
        } finally {
          semaphore.release();
        }
      },
    },
  });
}

const globalForPrisma = globalThis;

function createPrisma() {
  if (skipDuringBuild) {
    return buildWriteGuardedStubClient();
  }
  return applyExtensions(createBaseClient());
}

// Cache the *extended* client in dev to avoid stacking extensions on every HMR.
export const prisma =
  globalForPrisma.__khalfaPrisma ??
  (globalForPrisma.__khalfaPrisma = createPrisma());
