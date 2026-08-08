import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/get-user-id";
import { toErrorPayload } from "@/lib/orchestrator/errors";
import { createRun, listRuns } from "@/lib/orchestrator/service";
import {
  assertLocalRequest,
  parseCreateRunInput,
  parseListRunsInput,
  readJsonBody,
} from "@/lib/orchestrator/validation";

export async function GET(request: Request) {
  try {
    assertLocalRequest(request);
    const input = parseListRunsInput(new URL(request.url));
    const runs = await listRuns(getUserIdFromRequest(request), input);
    return NextResponse.json({ runs });
  } catch (error) {
    const response = toErrorPayload(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    assertLocalRequest(request);
    const input = parseCreateRunInput(await readJsonBody(request));
    const created = await createRun(getUserIdFromRequest(request), input);
    return NextResponse.json(created, {
      status: created.idempotentReplay ? 200 : 201,
    });
  } catch (error) {
    const response = toErrorPayload(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

