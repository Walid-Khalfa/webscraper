import { PrismaClient } from "@prisma/client";

// Decide early if we should skip DB activity during builds/CI. This allows
// setting SKIP_DB_DURING_BUILD=true in environments (e.g., Vercel build) to
// avoid exhausting limited DB connections during parallel prerendering.
const skipFlag = String(process.env.SKIP_DB_DURING_BUILD || process.env.SKIP_DB || "").toLowerCase();
let prisma;
if (skipFlag === "1" || skipFlag === "true") {
  // Lightweight fake Prisma client that returns safe defaults for common
  // read operations. Keep implementation minimal to avoid surprising behavior.
  const fake = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "$connect" || prop === "$disconnect" || prop === "connect" || prop === "disconnect") {
          return async () => undefined;
        }

        return new Proxy(async () => null, {
          get(target, method) {
            return async (..._args) => {
              const name = String(method || "");
              if (/count|length/i.test(name)) return 0;
              if (/findMany|findAll/i.test(name)) return [];
              if (/findFirst|findUnique|findOne/i.test(name)) return null;
              return null;
            };
          },
          apply() {
            return Promise.resolve(null);
          },
        });
      },
    },
  );

  prisma = fake;
} else {
  const globalForPrisma = globalThis;

  // Create the raw Prisma client
  const rawPrisma =
    globalForPrisma.prismaRaw ??
    new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });

  if (process.env.NODE_ENV !== "production") globalForPrisma.prismaRaw = rawPrisma;

  // Concurrency guard: limit number of concurrent Prisma method calls to avoid
  // exhausting database connections during heavy parallel phases (e.g. Next.js
  // build prerendering many pages). Tune with PRISMA_MAX_CONCURRENT env var.
  const PRISMA_MAX_CONCURRENT = Math.max(Number(process.env.PRISMA_MAX_CONCURRENT) || 6, 1);

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
        active += 1;
      },
      release() {
        active = Math.max(0, active - 1);
        const next = queue.shift();
        if (next) next();
      },
    };
  }

  const semaphore = createSemaphore(PRISMA_MAX_CONCURRENT);

  // Proxy the Prisma client so every async method call first acquires the
  // semaphore and releases it after completion. This reduces parallel queries
  // and prevents hitting DB connection limits during builds or cron jobs.
  const proxied = new Proxy(rawPrisma, {
    get(target, prop, receiver) {
      const orig = Reflect.get(target, prop, receiver);
      if (typeof orig !== "function") return orig;

      return async function wrapped(...args) {
        await semaphore.acquire();
        try {
          return await orig.apply(target, args);
        } finally {
          semaphore.release();
        }
      };
    },
  });

  prisma = proxied;
}

export { prisma };
