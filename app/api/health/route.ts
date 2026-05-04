import { NextResponse } from "next/server";
import { authModeFromEnv } from "@/lib/auth-paths";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "progression-tracker",
    environment: process.env.NODE_ENV ?? "unknown",
    authMode: authModeFromEnv(),
    timestamp: new Date().toISOString(),
  });
}
