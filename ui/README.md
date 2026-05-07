# Theseus Agent Oracle — UI

Next.js demo UI for the agent oracle PoC. Four panels:

1. **Live feed** — current ETH/USD with PRICED / REFUSED badge, last update, reason hash.
2. **Three venue cards** — what the agent saw last cycle from Coinbase, Binance, and Uniswap, each with a tamper button.
3. **Position panel** — wallet-connected Aave position (collateral, debt, health factor), with deposit / borrow / repay / withdraw actions. Borrow and withdraw show the on-chain revert reason when the feed is refused.
4. **Decision timeline** — recent agent decisions with deviation / refusal reason.

## Two modes

**Mock mode** (default): the API routes serve a cached scenario state. Click "Tamper" on a venue and the feed flips to refused + the timeline updates + the position panel disables borrow / withdraw. No chain required. Useful for screenshots, decks, and demos before the chain integration lands.

**Live mode**: when the deploy addresses are populated in `.env.local`, `/api/feed` reads from `AgentPriceFeed.sol` directly and `/api/tamper` submits an extrinsic to `pallet-tool-override`. The UI shows a "live chain" badge in the header.

## Run

```bash
cd ui/
cp .env.example .env.local
# (optional) fill in deployment addresses for live mode
pnpm install   # or npm install
pnpm dev       # or npm run dev
```

Open <http://localhost:3000>.

## Stack

- Next.js 15 App Router (matches theseus.network)
- Tailwind v4
- viem + wagmi + RainbowKit (EVM side, browser wallet)
- @polkadot/api (substrate side, server-only)
- React Query for refresh polling

## Files

| Path | Purpose |
|------|---------|
| `src/app/page.tsx` | Main demo page assembling the four panels. |
| `src/app/providers.tsx` | wagmi + RainbowKit + React Query providers. |
| `src/app/globals.css` | Theseus visual language: dark `#0a0b0d`, dot grid, coral `#ff5b3a`, mono + serif. |
| `src/components/FeedPanel.tsx` | Big price + decision badge. |
| `src/components/VenueCard.tsx` | One per venue, with tamper UI. |
| `src/components/PositionPanel.tsx` | Aave position + actions. Honors refusal state. |
| `src/components/DecisionTimeline.tsx` | Recent decisions feed. |
| `src/lib/chain.ts` | viem clients + ABIs + addresses. |
| `src/lib/feed-state.ts` | Live feed reads. |
| `src/lib/substrate.ts` | Server-only @polkadot/api client + admin signing. |
| `src/lib/mock-state.ts` | Cached scenario state for mock mode. |
| `src/app/api/*` | Edge-style API routes that fall through from live to mock. |

## What needs to land for full live mode

The same four runtime integration steps documented in [`STATUS.md`](../STATUS.md):

1. The `pallet-tool-override` registered in the runtime, so `/api/tamper` actually flips the agent's view.
2. The venue tools registered in the tool-executor, so the agent has something to read.
3. The `evm_call` precompile, so the agent can write to `AgentPriceFeed.sol`.
4. The tool-executor checking overrides before dispatching tools.

Until those land, mock mode demonstrates the *shape* of the demo: identical UX, same revert paths, same timeline. That's the screenshot you can show today.

## Deploying

Standard Next.js app. Vercel works out of the box.

### Vercel + custom subdomain

1. Import the repo in Vercel; set **Root Directory** to `ui`.
2. Set env vars from `.env.example`. `DEEPSEEK_API_KEY` should be marked **Sensitive**. Mock-mode runs with zero env vars.
3. Project → **Settings → Domains** → Add `agent-oracle.theseus.network`.
4. Vercel shows a CNAME target (e.g. `cname.vercel-dns.com`). Add this DNS record at your registrar:
   ```
   agent-oracle.theseus.network.  CNAME  cname.vercel-dns.com.
   ```
5. Wait for DNS propagation (typically <5 min). Vercel auto-provisions a Let's Encrypt cert.

The canonical URL once configured: <https://agent-oracle.theseus.network>.
