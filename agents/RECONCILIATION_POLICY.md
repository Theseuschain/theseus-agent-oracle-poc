# Reconciliation Policy

The exact rules you apply at the end of every scheduled run. These are not suggestions. The agent's value is that it follows these rules even when one of the venues looks "obviously right" to a human eye.

## Inputs

You read three venues:

| Tool | Symbol | What you get |
|------|--------|--------------|
| `coinbase_orderbook("ETH-USD")` | ETH-USD | Mid price + $ depth within 50bps of mid |
| `binance_ticker("ETHUSDT")` | ETHUSDT | Last trade price + 24h $ volume (proxy for depth) |
| `uniswap_twap(<pool>, 1800)` | ETH-USDC | 30-min TWAP + pool's $ TVL (proxy for depth) |

Each tool returns a `VenueReading { venue, price_usd, depth_usd, timestamp, ok, error? }`. A reading is **valid** when `ok == true` and `now - timestamp < 60s`.

## Decision rules

Apply these in order. The first rule that matches determines the decision.

### Rule 1 — Insufficient venues

```
if count(valid_readings) < 2:
    decision = "refused"
    reason = "insufficient_venues: <n>/3 valid"
```

You will not price off a single venue. A single point of read is exactly the failure mode you exist to prevent.

### Rule 2 — Stale data

```
for r in valid_readings:
    if now - r.timestamp > 60s:
        mark r invalid
```

Already filtered by the validity check above; restated for clarity.

### Rule 3 — Compute depth-weighted median

```
total_depth = sum(r.depth_usd for r in valid_readings)
weighted_prices = [(r.price_usd, r.depth_usd / total_depth) for r in valid_readings]
median_price = depth_weighted_median(weighted_prices)
```

Equal-weighted mean is wrong. A $50M-depth Coinbase reading should not get the same weight as a $200k-TVL Uniswap pool.

### Rule 4 — Divergence check

```
for r in valid_readings:
    deviation = abs(r.price_usd - median_price) / median_price
    if deviation > 0.005:   # 50 basis points
        decision = "refused"
        reason = f"venue_divergence: {r.venue} off by {deviation:.4f}"
        return
```

50bps is the threshold because:
- Real cross-venue spreads on liquid majors sit at 1–10bps.
- Flash-loan attacks on AMM pools commonly produce 100bps to 100× moves on a single venue.
- 50bps is well above noise and well below any historical attack signature.

### Rule 5 — Price

```
decision = "priced"
reconciled_price = median_price
```

## What you never do

- **Never average across an outlier.** If Uniswap reports $100,000 and the others report $3,500, you do not return $35,500. You refuse.
- **Never extrapolate from cached values.** Each cycle is independent.
- **Never apply heuristics not in this document.** "It looks like Uniswap is just lagging" is not a thought you have. Either the readings reconcile within 50bps, or they don't.
- **Never report partial confidence.** The contract has two states: PRICED or REFUSED. There is no `PRICED_WITH_LOW_CONFIDENCE`.

## Output schema

```
Reconciliation {
    decision: "priced" | "refused",
    reconciled_price: number,    // 0 when refused
    reason: string,              // reconciliation summary or refusal reason
    venue_readings: VenueReading[]  // all three, including invalid ones, for the auditor
}
```

The full reasoning blob and venue snapshots are committed via TensorCommit at the same block as the on-chain `reportPrice` / `reportRefusal` call. The contract stores only `keccak256(serialize(reconciliation))`, so any future auditor can prove what the agent saw.
