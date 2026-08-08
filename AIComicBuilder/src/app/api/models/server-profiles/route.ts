import { NextResponse } from "next/server";
import { listServerProfiles } from "@/lib/ai/server-profiles";

export async function GET() {
  try {
    return NextResponse.json({ profiles: listServerProfiles() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid server provider configuration";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
