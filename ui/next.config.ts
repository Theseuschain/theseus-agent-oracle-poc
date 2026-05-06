import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The chain RPC endpoints are read at request time inside API routes,
  // so we keep them in the runtime env, not bundled.
  experimental: {
    // Polkadot's deeply-cjs bundle confuses turbopack's tree-shaking; keep
    // the substrate code on the server side only and don't import it from
    // client components.
  },
};

export default nextConfig;
