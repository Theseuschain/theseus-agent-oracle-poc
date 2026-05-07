import { VenueReading } from "../types";

export function ok(
  venue: VenueReading["venue"],
  priceUsd: number,
  depthUsd: number,
  timestamp?: number,
): VenueReading {
  return {
    venue,
    priceUsd,
    depthUsd,
    ok: true,
    ageSeconds: timestamp
      ? Math.max(0, Math.floor(Date.now() / 1000) - timestamp)
      : 0,
  };
}

export function failed(
  venue: VenueReading["venue"],
  error: string,
): VenueReading {
  return { venue, priceUsd: 0, depthUsd: 0, ok: false, ageSeconds: 0, error };
}
