import { NextResponse } from "next/server";
import { readFeed } from "@/lib/feed-state";
import { getMockFeed, getMockVenues } from "@/lib/mock-state";
import { ADDRESSES } from "@/lib/chain";

export const dynamic = "force-dynamic";

export async function GET() {
  // Live mode when the feed address is configured AND the on-chain read succeeds.
  // Otherwise fall back to the mock state, so the UI is always demo-able.
  if (ADDRESSES.feed) {
    try {
      const live = await readFeed();
      if (live) {
        return NextResponse.json({
          mode: "live",
          feed: live,
          venues: getMockVenues(), // venue-level readings are not on-chain; agent emits them only as TensorCommit blob.
        });
      }
    } catch (e: unknown) {
      // Swallow and fall back to mock. The UI still works pre-deploy.
      console.warn("[api/feed] live read failed, using mock", e);
    }
  }

  return NextResponse.json({
    mode: "mock",
    feed: getMockFeed(),
    venues: getMockVenues(),
  });
}
