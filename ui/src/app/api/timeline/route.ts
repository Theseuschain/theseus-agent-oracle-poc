import { NextResponse } from "next/server";
import { ADDRESSES } from "@/lib/chain";
import { readTimelineFromEvents } from "@/lib/feed-events";

export const dynamic = "force-dynamic";

export async function GET() {
  if (ADDRESSES.feed) {
    try {
      const entries = await readTimelineFromEvents();
      return NextResponse.json({ mode: "live", entries });
    } catch (e: unknown) {
      console.warn("[api/timeline] live read failed, returning empty timeline", e);
      return NextResponse.json({ mode: "live", entries: [] });
    }
  }

  // Mock mode: the client owns the timeline state. Return an empty array
  // so the client falls through to its derived timeline.
  return NextResponse.json({ mode: "mock", entries: [] });
}
