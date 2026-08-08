import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/get-user-id";
import { toErrorPayload } from "@/lib/orchestrator/errors";
import { resumeRun } from "@/lib/orchestrator/service";
import {
  assertLocalRequest,
  parseResumeAction,
  readJsonBody,
} from "@/lib/orchestrator/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertLocalRequest(request);
    const { id } = await params;
    const action = parseResumeAction(await readJsonBody(request));
    const run = await resumeRun(getUserIdFromRequest(request), id, action);
    return NextResponse.json(run);
  } catch (error) {
    const response = toErrorPayload(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

