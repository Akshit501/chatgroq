import { NextResponse } from "next/server";

export async function GET() {
  const rawClientId =
    process.env.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_ID ||
    process.env.AUTH_GOOGLE_ID ||
    "";

  const rawSecret =
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_SECRET ||
    process.env.AUTH_GOOGLE_SECRET ||
    "";

  const nextAuthUrl = process.env.NEXTAUTH_URL || "";
  const vercelUrl = process.env.VERCEL_URL || "";

  return NextResponse.json({
    hasClientId: Boolean(rawClientId),
    clientIdPrefix: rawClientId.slice(0, 15),
    clientIdSuffix: rawClientId.slice(-25),
    hasSecret: Boolean(rawSecret),
    secretPrefix: rawSecret.slice(0, 7),
    secretLength: rawSecret.length,
    nextAuthUrl,
    vercelUrl,
  });
}
