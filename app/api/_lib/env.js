const STARTUP_REQUIRED_VARS = [
  {
    name: "DATABASE_URL",
    reason: "wird fuer Prisma und persistente SaaS-Daten benoetigt.",
    when: (env) => isStrictStartupMode(env) && !isBuildDatabaseSkip(env),
  },
  {
    name: "CRON_SECRET",
    reason: "schuetzt den Cron-Endpunkt fuer automatische Job-Alarme.",
    when: (env) => isStrictStartupMode(env),
  },
  {
    name: "EMAIL_LINK_SECRET",
    reason: "signiert Verifizierungs- und Abmelde-Links fuer E-Mails.",
    when: (env) => isStrictStartupMode(env),
  },
];

const STARTUP_RECOMMENDED_VARS = [
  {
    name: "NEXT_PUBLIC_APP_URL",
    reason: "setzt kanonische URLs sowie Links in SEO-Metadaten und E-Mails.",
  },
  {
    name: "RESEND_API_KEY",
    reason: "aktiviert echten E-Mail-Versand statt Dry-Run-Modus.",
  },
  {
    name: "EMAIL_FROM",
    reason: "definiert einen verifizierten Absender fuer Recruiting-E-Mails.",
  },
  {
    name: "UPSTASH_REDIS_REST_URL",
    reason: "aktiviert verteiltes Rate-Limiting fuer SaaS-Instanzen.",
  },
  {
    name: "UPSTASH_REDIS_REST_TOKEN",
    reason: "authentifiziert den Zugriff auf Upstash Redis.",
  },
  {
    name: "ADMIN_SECRET",
    reason: "schuetzt administrative Wartungsrouten.",
  },
];

let cachedDefaultReport = null;
let warnedForDefaultEnv = false;

function hasValue(env, name) {
  return Boolean(String(env?.[name] || "").trim());
}

function isBuildDatabaseSkip(env) {
  const skipFlag = String(env?.SKIP_DB_DURING_BUILD || env?.SKIP_DB || "").toLowerCase();
  return skipFlag === "1" || skipFlag === "true" || env?.NEXT_PHASE === "phase-production-build";
}

function isStrictStartupMode(env) {
  return env?.NODE_ENV === "production" && String(env?.CI || "").toLowerCase() !== "true";
}

function summarize(items) {
  return items.map((item) => `${item.name} (${item.reason})`);
}

export function getEnvironmentReport(env = process.env) {
  if (env === process.env && cachedDefaultReport) return cachedDefaultReport;

  const missingRequired = STARTUP_REQUIRED_VARS
    .filter((item) => item.when(env))
    .filter((item) => !hasValue(env, item.name));

  const warnings = STARTUP_RECOMMENDED_VARS.filter((item) => !hasValue(env, item.name));

  if ((hasValue(env, "BA_CLIENT_ID") && !hasValue(env, "BA_CLIENT_SECRET")) || (!hasValue(env, "BA_CLIENT_ID") && hasValue(env, "BA_CLIENT_SECRET"))) {
    warnings.push({
      name: "BA_CLIENT_ID / BA_CLIENT_SECRET",
      reason: "sollten nur gemeinsam gesetzt werden, wenn OAuth gegen die BA-API aktiviert wird.",
    });
  }

  const report = {
    ok: missingRequired.length === 0,
    mode: env.NODE_ENV || "development",
    missingRequired,
    warnings,
    summary: {
      missingRequired: summarize(missingRequired),
      warnings: summarize(warnings),
    },
  };

  if (env === process.env) cachedDefaultReport = report;
  return report;
}

export function validateStartupEnvironment(options = {}) {
  const { env = process.env, log = true } = options;
  const report = getEnvironmentReport(env);

  if (log && env === process.env && !warnedForDefaultEnv) {
    if (report.missingRequired.length) {
      console.error(`[env] Fehlende Pflichtvariablen erkannt: ${report.summary.missingRequired.join(", ")}`);
    }
    if (report.warnings.length) {
      console.warn(`[env] Empfohlene Variablen fehlen: ${report.summary.warnings.join(", ")}`);
    }
    warnedForDefaultEnv = true;
  }

  return report;
}

export function resetEnvironmentValidationCache() {
  cachedDefaultReport = null;
  warnedForDefaultEnv = false;
}
