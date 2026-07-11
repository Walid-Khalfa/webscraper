import { z } from "zod";
import { AppError } from "./http";

const trimmedString = (label, { min = 0, max = 120 } = {}) =>
  z
    .string()
    .trim()
    .min(min, `${label} ist erforderlich`)
    .max(max, `${label} ist zu lang`);

export const searchQuerySchema = z.object({
  keyword: z.string().trim().max(120).optional().default(""),
  location: z.string().trim().max(120).optional().default(""),
  page: z.coerce.number().int().min(1).max(50).optional().default(1),
  size: z.coerce.number().int().min(1).max(100).optional().default(25),
  exactLocation: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((value) => value === true || value === "true"),
});

export const locationAutocompleteSchema = z.object({
  query: z.string().trim().max(120).optional().default(""),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10),
});

export const agencyCreateSchema = z.object({
  name: trimmedString("Agenturname", { min: 2, max: 80 }),
  email: z.string().trim().email("Bitte geben Sie eine gueltige E-Mail-Adresse ein.").max(160),
  plan: z.enum(["starter", "agentur"]).optional().default("starter"),
});

export const subscriptionCreateSchema = z.object({
  keyword: trimmedString("Suchbegriff", { min: 2, max: 120 }),
  location: trimmedString("Ort", { min: 2, max: 120 }),
  frequency: z.enum(["daily"]).optional().default("daily"),
  max_results: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export const agencyWorkspaceQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional().default(6),
});

export const candidateDossierSchema = z.object({
  reference: trimmedString("Referenz", { min: 2, max: 120 }),
  title: trimmedString("Stellentitel", { min: 2, max: 160 }),
  employer: trimmedString("Arbeitgeber", { min: 2, max: 160 }),
  location: trimmedString("Standort", { min: 2, max: 120 }),
  status: z.enum(["interested", "applied", "interview", "closed"]).optional().default("interested"),
  notes: z.string().trim().max(4000).optional().default(""),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional().default([]),
});

export const analyticsPayloadSchema = z.object({
  event: trimmedString("Event", { min: 2, max: 80 }),
  distinctId: z.string().trim().max(160).optional(),
  path: z.string().trim().max(200).optional(),
  url: z.string().trim().url("Bitte geben Sie eine gueltige URL ein.").max(500).optional(),
  properties: z.record(z.string(), z.unknown()).optional().default({}),
});

export const crmConnectSchema = z.object({
  provider: z.enum(["personio", "hubspot", "greenhouse"]),
  apiKey: trimmedString("API-Schluessel", { min: 2, max: 500 }),
  config: z.record(z.string(), z.unknown()).optional().default({}),
});

export const crmPushSchema = z.object({
  provider: z.enum(["personio", "hubspot", "greenhouse"]),
  reference: trimmedString("Referenz", { min: 2, max: 120 }),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().email("Bitte geben Sie eine gueltige E-Mail-Adresse ein.").max(160),
  fullName: trimmedString("Name des Mitglieds", { min: 2, max: 80 }),
  role: z.enum(["ADMIN", "RECRUITER", "VIEWER"]),
});

export const numericIdSchema = z.coerce.number().int().positive();

// Client-side log relay (`/api/logs`) payload schema. Strictly limits the
// shape so the server can re-emit into the unified Vercel drain without
// accepting arbitrarily nested JSON that would bloat log lines or lock
// serialization on a circle-ref.
//
// IMPORTANT: `ts` uses `.refine()` rather than `.max(Date.now() + ...)` so
// the time threshold is evaluated per-request — `.max(...)` would capture
// Date.now() at module-load and the schema would (silently) start rejecting
// every payload within ~60s of server boot.
export const clientLogEventSchema = z.object({
  level: z.enum(["info", "warn", "error"]),
  prefix: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^browser-[a-z0-9][a-z0-9-]*$/i, "prefix muss mit 'browser-' beginnen"),
  message: z.string().trim().max(500).optional(),
  // Flat primitives only — nested objects/arrays would JSON.stringify to
  // multi-line blobs that defeat logfmt's single-line invariant. Strings
  // capped at 200 chars to prevent one field from dominating.
  fields: z
    .record(
      z.string().max(80),
      z.union([
        z.string().max(200),
        z.number().finite(),
        z.boolean(),
        z.null(),
      ]),
    )
    .optional()
    .default({}),
  ts: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .refine((val) => val === undefined || val <= Date.now() + 60_000, "ts darf nicht in der Zukunft liegen"),
});

export const clientLogsBatchSchema = z.object({
  events: z.array(clientLogEventSchema).min(1).max(50),
});

export const adminImportRunSchema = z.object({
  mode: z.enum(["test", "full"]).optional().default("test"),
  queries: z
    .array(
      z.object({
        keyword: z.string().trim().max(120).optional().default(""),
        location: z.string().trim().max(120).optional().default(""),
      }),
    )
    .max(200)
    .optional()
    .default([]),
});

export function parseWithSchema(schema, input) {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  throw new AppError(issue?.message || "Ungueltige Eingabedaten", 400, "VALIDATION_ERROR");
}
