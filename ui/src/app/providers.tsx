"use client";

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 1337);
const evmRpc = process.env.NEXT_PUBLIC_EVM_RPC ?? "http://127.0.0.1:9933";

const theseus = defineChain({
  id: chainId,
  name: "Theseus EVM",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [evmRpc] } },
});

const wagmiConfig = getDefaultConfig({
  appName: "Theseus Agent Oracle",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "theseus-agent-oracle",
  chains: [theseus],
  transports: { [theseus.id]: http(evmRpc) },
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#ff5b3a",
            accentColorForeground: "#0a0b0d",
            borderRadius: "medium",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
