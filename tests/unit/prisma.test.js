import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Replace @prisma/client with a fake so the live-client tests don't reach the
// network for a real connection. All other tests in this file use the
// SKIP_DB_DURING_BUILD branch which never instantiates PrismaClient.
vi.mock("@prisma/client", () => {
  function makeFakePrismaPromise(value) {
    // Mimic PrismaPromise enough for `pending.then(...)` to work and to return
    // a fresh Promise wrapper on each `.then` call (multi-await safety).
    const thenable = {
      then(onFulfilled, onRejected) {
        return Promise.resolve(value).then(onFulfilled, onRejected);
      },
      catch(onRejected) {
        return Promise.resolve(value).catch(onRejected);
      },
      finally(onFinally) {
        return Promise.resolve(value).finally(onFinally);
      },
    };
    return thenable;
  }

  const agency = {
    findUnique: () => makeFakePrismaPromise({ id: 1, name: "fake-agency", email: "fake@example.test" }),
    findFirst: () => makeFakePrismaPromise({ id: 1, name: "fake-agency", email: "fake@example.test" }),
    findMany: () => makeFakePrismaPromise([]),
    count: () => makeFakePrismaPromise(0),
    aggregate: () => makeFakePrismaPromise({ _count: 0 }),
    groupBy: () => makeFakePrismaPromise([]),
  };

  class FakePrismaClient {
    constructor() {
      this.agency = agency;
    }

    async $transaction(input) {
      if (Array.isArray(input)) {
        // Mimic array $transaction: await each PrismaPromise in order.
        return Promise.all(input);
      }
      if (typeof input === "function") {
        return input(this);
      }
      throw new Error("FakePrismaClient: unsupported $transaction input");
    }

    // $extends must return an object whose `query.$allOperations` is invoked
    // on each PrismaPromise to emulate the production extension path.
    $extends(extension) {
      const wrap = (thenable) => {
        return {
          then(onFulfilled, onRejected) {
            return extension.query.$allOperations({
              operation: "fakeOp",
              args: {},
              query: (args) => Promise.resolve(thenable).then((v) => v),
            }).then(onFulfilled, onRejected);
          },
        };
      };
      return {
        agency: new Proxy(agency, {
          get(target, prop) {
            const original = target[prop];
            if (typeof original !== "function") return original;
            return (...args) => wrap(original(...args));
          },
        }),
        $transaction: (...args) => this.$transaction(...args),
      };
    }
  }

  return { PrismaClient: FakePrismaClient };
});

// Helper: dynamically import a freshly-evaluated `prisma.js` after env tweaks so
// we observe the side-effect of `SKIP_DB_DURING_BUILD` on module init.
async function loadPrismaModule() {
  vi.resetModules();
  return import("../../app/api/_lib/prisma");
}

describe("prisma client", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset module cache *before* mutating env, so each test sees a fresh
    // evaluation of the `prisma.js` module's top-level code.
    vi.resetModules();
    delete process.env.SKIP_DB_DURING_BUILD;
    delete process.env.SKIP_DB;
    delete globalThis.__khalfaPrisma;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    delete globalThis.__khalfaPrisma;
  });

  it("returns safe defaults for read operations when SKIP_DB_DURING_BUILD=true", async () => {
    process.env.SKIP_DB_DURING_BUILD = "true";
    const { prisma } = await loadPrismaModule();

    expect(await prisma.agency.findUnique({ where: { id: 1 } })).toBeNull();
    expect(await prisma.agency.findFirst({ where: { id: 1 } })).toBeNull();
    expect(await prisma.agency.findMany({ where: { id: 1 } })).toEqual([]);
    expect(await prisma.agency.count({ where: { id: 1 } })).toBe(0);
    expect(await prisma.agency.aggregate({ where: { id: 1 }, _count: true })).toBe(0);
    expect(await prisma.agency.groupBy({ by: ["plan"] })).toBe(0);
  });

  it("throws on write operations when SKIP_DB_DURING_BUILD=true", async () => {
    process.env.SKIP_DB_DURING_BUILD = "true";
    const { prisma } = await loadPrismaModule();

    await expect(prisma.agency.create({ data: { name: "x", email: "x@y.z" } })).rejects.toThrow(/write blocked during build/);
    await expect(prisma.agency.update({ where: { id: 1 }, data: { name: "y" } })).rejects.toThrow(/write blocked during build/);
    await expect(prisma.agency.delete({ where: { id: 1 } })).rejects.toThrow(/write blocked during build/);
    await expect(prisma.agency.upsert({ where: { id: 1 }, update: {}, create: { name: "x", email: "x@y.z" } })).rejects.toThrow(/write blocked during build/);
    await expect(prisma.agency.findUniqueOrThrow({ where: { id: 1 } })).rejects.toThrow(/write blocked during build/);
    await expect(prisma.agency.findFirstOrThrow({ where: { id: 1 } })).rejects.toThrow(/write blocked during build/);
  });

  it("rejects $transaction during build with a clear client-level error", async () => {
    process.env.SKIP_DB_DURING_BUILD = "true";
    const { prisma } = await loadPrismaModule();

    await expect(
      prisma.$transaction([
        prisma.agency.count(),
        prisma.agency.findMany(),
      ]),
    ).rejects.toThrow(/client blocked during build/);

    await expect(
      prisma.$transaction(async () => undefined),
    ).rejects.toThrow(/client blocked during build/);
  });

  it("rejects other client-level methods during build", async () => {
    process.env.SKIP_DB_DURING_BUILD = "true";
    const { prisma } = await loadPrismaModule();

    // Spot-check the two most commonly-misused client-level methods. The full
    // rejection set is enforced at the production site by the
    // REJECTED_CLIENT_METHODS `Set` membership check inside the stub.
    await expect(prisma.$use(async () => undefined)).rejects.toThrow(/client blocked during build/);
    await expect(prisma.$extends({})).rejects.toThrow(/client blocked during build/);
  });

  it("no-ops $connect and $disconnect during build", async () => {
    process.env.SKIP_DB_DURING_BUILD = "true";
    const { prisma } = await loadPrismaModule();

    await expect(prisma.$connect()).resolves.toBeUndefined();
    await expect(prisma.$disconnect()).resolves.toBeUndefined();
  });

  it("throws when a model proxy is invoked directly as a function", async () => {
    process.env.SKIP_DB_DURING_BUILD = "true";
    const { prisma } = await loadPrismaModule();

    // The build stub's modelProxy `apply` trap throws synchronously, so the
    // raw `(prisma.agency)()` would short-circuit the whole expression before
    // `expect(...).rejects` ever sees a Promise. Wrap in an async IIFE so the
    // throw becomes a rejection that `.rejects` can introspect.
    const invocation = (async () => (prisma.agency)())();
    await expect(invocation).rejects.toMatchObject({
      name: "PrismaBuildStubError",
      code: "PRISMA_BUILD_STUB",
    });
    await expect(invocation).rejects.toThrow(/called as a function/);
  });

  it("exposes the live Prisma client when SKIP_DB_DURING_BUILD is unset", async () => {
    delete process.env.SKIP_DB_DURING_BUILD;
    delete process.env.SKIP_DB;
    const { prisma } = await loadPrismaModule();

    expect(prisma).toBeDefined();
    expect(typeof prisma.$transaction).toBe("function");
    expect(prisma.agency).toBeDefined();
  });

  it("supports PrismaPromise semantics on the extended client (thenable + multi-await)", async () => {
    delete process.env.SKIP_DB_DURING_BUILD;
    process.env.PRISMA_MAX_CONCURRENT = "1"; // force $extends path
    const { prisma } = await loadPrismaModule();

    const pending = prisma.agency.findUnique({ where: { id: 1 } });
    expect(pending).toBeDefined();
    expect(typeof pending.then).toBe("function");

    // PrismaPromise must be safely multi-awaited (this is the property the
    // buggy Proxy wrap destroyed). Use `(v) => v` so the resolved value is
    // forwardable; the assertion checks both branches produce the agency's
    // data without throwing.
    const a = pending.then((v) => v);
    const b = pending.then((v) => v);
    expect(a).not.toBe(b);

    const [valA, valB] = await Promise.all([a, b]);
    expect(valA).toEqual({ id: 1, name: "fake-agency", email: "fake@example.test" });
    expect(valB).toEqual({ id: 1, name: "fake-agency", email: "fake@example.test" });
  });

  it("supports array $transaction on the extended client (preserve PrismaPromise inputs)", async () => {
    delete process.env.SKIP_DB_DURING_BUILD;
    process.env.PRISMA_MAX_CONCURRENT = "1"; // force $extends path
    const { prisma } = await loadPrismaModule();

    // This is the exact shape used by `product-insights.js`.
    const result = await prisma.$transaction([
      prisma.agency.count(),
      prisma.agency.findMany(),
    ]);

    expect(result).toEqual([0, []]);
  });
});
