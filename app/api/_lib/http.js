import { NextResponse } from "next/server";

export function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

export class AppError extends Error {
  constructor(message, status = 500, code = "APP_ERROR") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export function errorResponse(error) {
  return NextResponse.json(
    {
      detail: error.message || "Unerwarteter Serverfehler",
      code: error.code || "UNEXPECTED_ERROR",
    },
    { status: error.status || 500 },
  );
}

export function agencyKey(request) {
  return request.headers.get("x-agency-key");
}

export function getClientIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("cf-connecting-ip") ||
    "anonymous"
  );
}
