import "server-only";
import { NextResponse } from "next/server";
import type { NeoError } from "@/server/neo/errors";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

/** Same envelope shape as jsonError() in src/lib/api-utils.ts, but for NeoError instead of NormalizedError. */
export function jsonNeoError(error: NeoError) {
  return NextResponse.json(
    { error: { type: error.type, message: error.message } },
    { status: error.httpStatus >= 400 ? error.httpStatus : 502, headers: NO_STORE_HEADERS },
  );
}
