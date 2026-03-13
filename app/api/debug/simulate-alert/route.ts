import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { simulateAlertFromEmail } = require("../../../../backend/src/services/alertSimulationService.js");

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const subject = typeof payload?.subject === "string" ? payload.subject : "";
    const body = typeof payload?.body === "string" ? payload.body : "";
    const receivedAt =
      payload?.received_at == null ? null : String(payload.received_at);

    if (!subject.trim() && !body.trim()) {
      return NextResponse.json(
        { error: "subject or body is required" },
        { status: 400 },
      );
    }

    const result = simulateAlertFromEmail({
      subject,
      body,
      receivedAt,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "error interno",
        message:
          process.env.NODE_ENV === "development" ? error?.message : undefined,
      },
      { status: 500 },
    );
  }
}
