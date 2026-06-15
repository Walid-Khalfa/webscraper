import { NextResponse } from "next/server";

export function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(error) {
  return NextResponse.json(
    { detail: error.message || "Unexpected server error" },
    { status: error.status || 500 },
  );
}

export function agencyKey(request) {
  return request.headers.get("x-agency-key");
}
