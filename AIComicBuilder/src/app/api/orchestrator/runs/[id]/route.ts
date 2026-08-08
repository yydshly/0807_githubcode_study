import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/get-user-id";
import { toErrorPayload } from "@/lib/orchestrator/errors";
import { getRun } from "@/lib/orchestrator/service";
import { assertLocalRequest } from "@/lib/orchestrator/validation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertLocalRequest(request);
    const { id } = await params;
    const run = await getRun(getUserIdFromRequest(request), id);
    return NextResponse.json(run);
  } catch (error) {
    const response = toErrorPayload(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

