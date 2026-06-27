import { spawn } from "node:child_process";
import { once } from "node:events";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const port = process.env.PORT || "3000";
const host = "127.0.0.1";
const baseUrl = `http://${host}:${port}`;
const isWindows = process.platform === "win32";
const npmCmd = "npm";
const sharedEnv = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || baseUrl,
  CRON_SECRET: process.env.CRON_SECRET || "a11y-cron-secret",
  EMAIL_LINK_SECRET: process.env.EMAIL_LINK_SECRET || "a11y-email-secret",
};

function prefix(stream, label) {
  stream.on("data", (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
  });
}

async function runCommand(command, args, env = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: isWindows,
    env: { ...process.env, ...sharedEnv, ...env },
  });

  const [code] = await once(child, "exit");
  if (code !== 0) {
    throw new Error(`${command} ${args.join(" ")} fehlgeschlagen (${code}).`);
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {}
    await delay(1000);
  }

  throw new Error("Der lokale Server wurde nicht rechtzeitig bereit.");
}

async function stopServer(child) {
  if (!child || child.killed) return;

  if (isWindows) {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
      });
      killer.on("exit", () => resolve());
      killer.on("error", () => resolve());
    });
    return;
  }

  child.kill("SIGTERM");
}

let serverProcess;

try {
  await runCommand(npmCmd, ["run", "build"], {
    SKIP_DB_DURING_BUILD: process.env.SKIP_DB_DURING_BUILD || "true",
  });

  serverProcess = spawn(
    npmCmd,
    ["run", "start", "--", "--hostname", host, "--port", port],
    {
      stdio: ["ignore", "pipe", "pipe"],
      shell: isWindows,
      env: {
        ...process.env,
        ...sharedEnv,
        SKIP_DB: process.env.SKIP_DB || "true",
      },
    },
  );

  prefix(serverProcess.stdout, "server");
  prefix(serverProcess.stderr, "server");

  await waitForServer();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  await browser.close();

  const blockingViolations = results.violations.filter((violation) =>
    ["critical", "serious"].includes(String(violation.impact || "")),
  );

  if (blockingViolations.length) {
    console.error(
      JSON.stringify(
        blockingViolations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          targets: violation.nodes.map((node) => node.target),
        })),
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } else {
    console.log("A11Y_OK");
  }
} finally {
  await stopServer(serverProcess);
}

process.exit(process.exitCode || 0);
