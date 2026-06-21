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

export const numericIdSchema = z.coerce.number().int().positive();

export function parseWithSchema(schema, input) {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  throw new AppError(issue?.message || "Ungueltige Eingabedaten", 400, "VALIDATION_ERROR");
}
