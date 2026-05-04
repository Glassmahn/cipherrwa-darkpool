"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected } from "wagmi/connectors";
import { sepolia } from "wagmi/chains";

const fhevmTestnet = {
  id: 16602,
  name: "FHEVM Testnet",
  network: "fhevm-testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://ethereum-sepolia-rpc.publicnode.com"] },
    public: { http: ["https://ethereum-sepolia-rpc.publicnode.com"] },
  },
  blockExplorers: {
    default: { name: "Sepolia Etherscan", url: "https://sepolia.etherscan.io" },
  },
  testnet: true,
};

export const config = createConfig({
  chains: [sepolia, fhevmTestnet],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http("https://ethereum-sepolia-rpc.publicnode.com"),
    [fhevmTestnet.id]: http("https://ethereum-sepolia-rpc.publicnode.com"),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
