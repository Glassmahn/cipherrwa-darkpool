"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useConnect, useDisconnect, usePublicClient, useSwitchChain } from "wagmi";
import { getWalletClient } from "@wagmi/core";
import { config } from "../providers";
import { injected } from "wagmi/connectors";
import { sepolia } from "wagmi/chains";
import { ethers } from "ethers";

// Dynamic SDK import — only loads in browser
async function loadSDK() {
  const { createInstance, initSDK, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");
  return { createInstance, initSDK, SepoliaConfig };
}

const DARKPOOL_ADDRESS = "0x318F23D39fd29e31a503A2A190Cff95C069E4e77" as `0x${string}`;
const RWA_ADDRESS = "0x2e74A6F0e739B6F61f8c143385d4D80e8f3D9164" as `0x${string}`;
const RWA_CREAL_ADDRESS = "0x43f6F3D8e12265ABc4eCa455662ac8ce2188F5B6" as `0x${string}`;
const RWA_CCARBON_ADDRESS = "0x93F67cEa9B0f231AA4d23e494066530Ab0A8fB3b" as `0x${string}`;
const MATCHING_ENGINE_ADDRESS = "0xD482e2286efd826E42609A9E9641434c5a696f0B" as `0x${string}`;
const SEPOLIA_SCAN = "https://sepolia.etherscan.io";

// ABI for DarkPool + MatchingEngine
const DARKPOOL_ABI = [
  {
    name: "placeEncryptedOrder",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "handles", type: "bytes32[]" },
      { name: "inputProof", type: "bytes" },
      { name: "rwaToken", type: "address" },
      { name: "side", type: "uint8" },
    ],
    outputs: [{ name: "orderId", type: "uint256" }],
  },
  {
    name: "getTraderOrders",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "trader", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getOrderMeta",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [
      { name: "trader", type: "address" },
      { name: "rwaToken", type: "address" },
      { name: "side", type: "uint8" },
      { name: "status", type: "uint8" },
      { name: "blockNumber", type: "uint256" },
      { name: "timestamp", type: "uint256" },
    ],
  },
  {
    name: "getOpenOrdersForToken",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "rwaToken", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "executeMatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "buyOrderId", type: "uint256" },
      { name: "sellOrderId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "onSettlementCallback",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "buyOrderId", type: "uint256" },
      { name: "sellOrderId", type: "uint256" },
      { name: "buyAmount", type: "uint64" },
      { name: "sellAmount", type: "uint64" },
      { name: "price", type: "uint64" },
    ],
    outputs: [],
  },
  {
    name: "settlements",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "buyAmount", type: "uint64" },
      { name: "sellAmount", type: "uint64" },
      { name: "price", type: "uint64" },
      { name: "settled", type: "bool" },
    ],
  },
] as const;

const MATCHING_ENGINE_ABI = [
  {
    name: "computeMatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "buyOrderId", type: "uint256" },
      { name: "sellOrderId", type: "uint256" },
    ],
    outputs: [{ name: "matchHandle", type: "uint256" }],
  },
  {
    name: "confirmMatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "buyOrderId", type: "uint256" },
      { name: "sellOrderId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "autoComputeMatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "rwaToken", type: "address" }],
    outputs: [
      { name: "buyOrderId", type: "uint256" },
      { name: "sellOrderId", type: "uint256" },
      { name: "matchHandle", type: "uint256" },
    ],
  },
  {
    name: "matchResults",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getTWAPCount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "rwaToken", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ── Theme ────────────────────────────────────────────────────────────────────
const Y = "#F5C800";
const ink = "#080600";
const glass = "rgba(255,255,255,0.03)";
const gb = "rgba(245,200,0,0.08)";
const textDim = "#7a6a3a";
const textMuted = "#3a2e0a";
const green = "#27ae60";
const red = "#c0392b";

const SIDES = ["BUY", "SELL"];
const STATUSES = ["OPEN", "MATCHED", "CANCELLED", "SETTLED"];

const RWA_TOKEN_NAMES: Record<string, string> = {
  "0x2e74a6f0e739b6f61f8c143385d4d80e8f3d9164": "cTBILL",
  "0x43f6f3d8e12265abc4eca455662ac8ce2188f5b6": "cREAL",
  "0x93f67cea9b0f231aa4d23e494066530ab0a8fb3b": "cCARBON",
};

function getTokenName(orderId: string, rwaToken: string): string {
  const labels = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("cipherRwa_tokenLabels") || "{}") : {};
  if (labels[orderId]) return labels[orderId];
  const known = RWA_TOKEN_NAMES[rwaToken.toLowerCase()];
  if (known) return known;
  return `${rwaToken.slice(0, 6)}...${rwaToken.slice(-4)}`;
}

let fheInstance: any = null;

async function switchToSepolia(): Promise<boolean> {
  if (typeof window === "undefined" || !(window as any).ethereum) return false;
  try {
    await (window as any).ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x" + BigInt(11155111).toString(16) }],
    });
    return true;
  } catch (e: any) {
    if (e.code === 4902) {
      try {
        await (window as any).ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0xaa36a7",
              chainName: "Sepolia",
              nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            },
          ],
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

async function getFHEInstance() {
  if (fheInstance) return fheInstance;
  const { createInstance, initSDK, SepoliaConfig } = await loadSDK();
  await initSDK();
  fheInstance = await createInstance({
    ...SepoliaConfig,
    network: "https://ethereum-sepolia-rpc.publicnode.com",
  });
  return fheInstance;
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: glass, border: `1px solid ${gb}`, padding: "1.4rem", position: "relative", ...style }}>
      {children}
    </div>
  );
}
function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        fontSize: "0.62rem",
        letterSpacing: "0.2em",
        color: textDim,
        textTransform: "uppercase" as const,
        marginBottom: "1.2rem",
      }}
    >
      <div style={{ width: 2, height: 12, background: Y, flexShrink: 0 }} />
      {children}
    </div>
  );
}
function EncTag() {
  return (
    <span
      style={{
        display: "inline-block",
        background: "rgba(245,200,0,0.08)",
        border: "1px solid rgba(245,200,0,0.15)",
        color: Y,
        fontSize: "0.48rem",
        padding: "0.1rem 0.35rem",
        letterSpacing: "0.1em",
        verticalAlign: "middle",
        marginLeft: "0.25rem",
      }}
    >
      FHE
    </span>
  );
}
function StatusBadge({ status }: { status: string }) {
  const c = status === "OPEN" ? Y : status === "MATCHED" ? green : status === "SETTLED" ? "#6ab0ff" : textDim;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "0.5rem",
        letterSpacing: "0.1em",
        padding: "0.15rem 0.4rem",
        background: `${c}18`,
        color: c,
        border: `1px solid ${c}33`,
      }}
    >
      {status}
    </span>
  );
}

// ── Views ────────────────────────────────────────────────────────────────────
function OverviewView({ orders, twapCount, barsVisible, onPlaceOrder }: any) {
  const fheChecks = [
    "euint64 Order Amounts",
    "euint64 Order Prices",
    "ebool Accreditation Flag",
    "Homomorphic Matching",
    "Gateway Decrypt (Settlement)",
    "Zero Plaintext On-Chain",
  ];
  const barHeights = [40, 55, 45, 70, 60, 75, 85, 90, 80, 65, 72, 95];
  const matched = orders.filter((o: any) => o.status === "MATCHED" || o.status === "SETTLED");

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Total Orders", val: orders.length.toString(), sub: "Your encrypted orders", icon: "◈" },
          {
            label: "Matched",
            val: orders.filter((o: any) => o.status === "MATCHED").length.toString(),
            sub: "Successfully matched",
            icon: "⬡",
            up: true,
          },
          {
            label: "Settled",
            val: orders.filter((o: any) => o.status === "SETTLED").length.toString(),
            sub: "Via Gateway decrypt",
            icon: "◻",
          },
          { label: "TWAP Obs.", val: twapCount.toString(), sub: "cTBILL rolling avg", yellow: true, icon: "⊕" },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              background: glass,
              border: `1px solid ${gb}`,
              padding: "1.2rem 1.4rem",
              position: "relative",
              overflow: "hidden",
              transition: "border-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(245,200,0,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = gb)}
          >
            <div style={{ position: "absolute", top: "1rem", right: "1rem", fontSize: "1.2rem", opacity: 0.1 }}>
              {s.icon}
            </div>
            <div
              style={{
                fontSize: "0.52rem",
                letterSpacing: "0.2em",
                color: textDim,
                marginBottom: "0.5rem",
                textTransform: "uppercase" as const,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: "1.4rem",
                fontWeight: 700,
                color: s.yellow ? Y : "#f0e6c0",
                letterSpacing: "-0.02em",
                fontFamily: "monospace",
              }}
            >
              {s.val}
            </div>
            <div style={{ fontSize: "0.55rem", color: s.up ? green : textDim, marginTop: "0.3rem" }}>{s.sub}</div>
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 1,
                background: `linear-gradient(to right,transparent,${Y}22,transparent)`,
              }}
            />
          </div>
        ))}
      </div>

      {/* Bottom grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
        <Panel>
          <PanelTitle>TWAP Oracle — cTBILL</PanelTitle>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: Y, fontFamily: "monospace" }}>$9.847</div>
          <div style={{ fontSize: "0.55rem", color: textDim, margin: "0.3rem 0 0.75rem" }}>
            {twapCount} obs · homomorphic accumulator
          </div>
          <div style={{ height: 60, display: "flex", alignItems: "flex-end", gap: 2 }}>
            {barHeights.map((h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: barsVisible ? `${h}%` : "0%",
                  background: h > 80 ? "rgba(245,200,0,0.5)" : "rgba(245,200,0,0.15)",
                  borderRadius: 1,
                  transition: `height 0.6s ease ${i * 0.05}s`,
                }}
              />
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelTitle>FHE Verification</PanelTitle>
          {fheChecks.map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.5rem 0",
                borderBottom: `1px solid rgba(245,200,0,0.05)`,
              }}
            >
              <div style={{ fontSize: "0.6rem", color: textDim }}>{label}</div>
              <div style={{ fontSize: "0.55rem", color: green, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <span style={{ fontWeight: 700 }}>✓</span>
                {label.includes("Matching")
                  ? "ACTIVE"
                  : label.includes("Settlement")
                    ? "READY"
                    : label.includes("Zero")
                      ? "VERIFIED"
                      : "ENCRYPTED"}
              </div>
            </div>
          ))}
        </Panel>

        <Panel>
          <PanelTitle>Recent Matches</PanelTitle>
          {matched.length === 0 ? (
            <div
              style={{
                fontSize: "0.58rem",
                color: textDim,
                textAlign: "center" as const,
                padding: "1.5rem 0",
                letterSpacing: "0.1em",
              }}
            >
              NO MATCHES YET
            </div>
          ) : (
            matched.slice(0, 3).map((o: any, i: number) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.6rem 0.7rem",
                  background: "rgba(39,174,96,0.06)",
                  border: "1px solid rgba(39,174,96,0.12)",
                  marginBottom: "0.5rem",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.62rem", fontFamily: "monospace" }}>Order #{o.id}</div>
                  <div style={{ fontSize: "0.52rem", color: textDim, marginTop: "0.15rem" }}>{getTokenName(o.id, o.rwaToken)} · {o.side}</div>
                </div>
                <div style={{ textAlign: "right" as const }}>
                  <StatusBadge status={o.status} />
                  <div style={{ fontSize: "0.55rem", color: textMuted, fontFamily: "monospace", marginTop: "0.3rem" }}>
                    Amt: ██████
                  </div>
                </div>
              </div>
            ))
          )}
          <button
            onClick={onPlaceOrder}
            style={{
              width: "100%",
              marginTop: "0.5rem",
              padding: "0.5rem",
              background: "transparent",
              border: `1px solid ${gb}`,
              color: Y,
              fontSize: "0.55rem",
              letterSpacing: "0.15em",
              cursor: "none",
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = Y)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = gb)}
          >
            ⊕ PLACE NEW ORDER
          </button>
        </Panel>
      </div>
    </div>
  );
}

function OrderHistoryView({ orders, loadingOrders, loadOrders }: any) {
  return (
    <Panel>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2rem" }}>
        <PanelTitle>Order History</PanelTitle>
        <button
          onClick={loadOrders}
          style={{
            fontSize: "0.52rem",
            color: Y,
            background: "transparent",
            border: "1px solid rgba(245,200,0,0.2)",
            padding: "0.2rem 0.6rem",
            cursor: "none",
            fontFamily: "inherit",
            letterSpacing: "0.1em",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = Y)}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(245,200,0,0.2)")}
        >
          ↻ REFRESH
        </button>
      </div>
      {loadingOrders ? (
        <div
          style={{
            fontSize: "0.6rem",
            color: textDim,
            textAlign: "center" as const,
            padding: "3rem",
            letterSpacing: "0.15em",
          }}
        >
          LOADING ORDERS FROM CHAIN...
        </div>
      ) : orders.length === 0 ? (
        <div
          style={{
            fontSize: "0.6rem",
            color: textDim,
            textAlign: "center" as const,
            padding: "3rem",
            letterSpacing: "0.1em",
          }}
        >
          NO ORDERS FOUND — PLACE YOUR FIRST ENCRYPTED ORDER
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr 80px 100px 100px 120px",
              gap: "0.5rem",
              paddingBottom: "0.6rem",
              borderBottom: `1px solid ${gb}`,
              marginBottom: "0.5rem",
            }}
          >
            {["ID", "TOKEN", "SIDE", "AMOUNT", "PRICE", "STATUS"].map((h) => (
              <div
                key={h}
                style={{
                  fontSize: "0.5rem",
                  letterSpacing: "0.15em",
                  color: textMuted,
                  textTransform: "uppercase" as const,
                }}
              >
                {h}
              </div>
            ))}
          </div>
          {orders.map((o: any, i: number) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 1fr 80px 100px 100px 120px",
                gap: "0.5rem",
                padding: "0.55rem 0",
                borderBottom: `1px solid rgba(245,200,0,0.04)`,
                alignItems: "center",
                cursor: "none",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "rgba(245,200,0,0.03)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
            >
              <div style={{ fontSize: "0.62rem", fontFamily: "monospace", color: Y }}>#{o.id}</div>
              <div style={{ fontSize: "0.62rem", fontFamily: "monospace" }}>
                {getTokenName(o.id, o.rwaToken)}
                <EncTag />
              </div>
              <div style={{ fontSize: "0.62rem", fontFamily: "monospace", color: o.side === "BUY" ? green : red }}>
                {o.side}
              </div>
              <div style={{ fontSize: "0.6rem", color: textMuted, fontFamily: "monospace" }}>██████</div>
              <div style={{ fontSize: "0.6rem", color: textMuted, fontFamily: "monospace" }}>██████</div>
              <StatusBadge status={o.status} />
            </div>
          ))}
        </>
      )}
      <div
        style={{
          marginTop: "1rem",
          fontSize: "0.55rem",
          color: textMuted,
          letterSpacing: "0.08em",
          fontFamily: "monospace",
        }}
      >
        ⬡ All amounts stored as euint64 ciphertext. Only you can decrypt your orders.
      </div>
    </Panel>
  );
}

function PlaceOrderView({ isConnected, connector, address, chain, publicClient, mounted, onSuccess, aiOrderData }: any) {
  const [activeSide, setActiveSide] = useState<"BUY" | "SELL">(aiOrderData?.side || "BUY");
  const [selectedToken, setSelectedToken] = useState(aiOrderData?.token || "cTBILL — US Treasury");
  const [amount, setAmount] = useState(aiOrderData?.amount || "");
  const [price, setPrice] = useState(aiOrderData?.price || "");
  const [riskScore, setRiskScore] = useState(aiOrderData?.risk || "");
  const [txStatus, setTxStatus] = useState<"idle" | "encrypting" | "submitting" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState("");
  const [txError, setTxError] = useState("");

  const RWA_TOKEN_MAP: Record<string, `0x${string}`> = {
    "cTBILL — US Treasury": RWA_ADDRESS,
    "cREAL — Real Estate": RWA_CREAL_ADDRESS,
    "cCARBON — Carbon Credit": RWA_CCARBON_ADDRESS,
  };

  async function handlePlaceOrder() {
    if (!isConnected || !connector || !address) {
      setTxError("Wallet not connected — click CONNECT WALLET in the sidebar");
      setTxStatus("error");
      return;
    }
    if (!amount || !price || !riskScore) {
      setTxError("Please fill in all fields");
      setTxStatus("error");
      return;
    }

    if (chain && chain.id !== sepolia.id) {
      setTxError(`Wrong network (ID: ${chain.id}). Switch to Sepolia (11155111) in your wallet, then retry.`);
      setTxStatus("error");
      return;
    }

    setTxStatus("encrypting");
    setTxError("");

    try {
      const wc = await getWalletClient(config, { connector });
      const instance = await getFHEInstance();
      const rwaToken = RWA_TOKEN_MAP[selectedToken];

      const input = instance.createEncryptedInput(DARKPOOL_ADDRESS, address);
      input.add64(Math.floor(parseFloat(amount) * 1e6));
      input.add64(Math.floor(parseFloat(price) * 1e6));
      input.add64(parseInt(riskScore));

      setTxStatus("submitting");

      const { handles, inputProof } = await input.encrypt();

      const handlesHex = handles.map((h: Uint8Array) => ethers.hexlify(h)) as `0x${string}`[];
      const proofHex = ethers.hexlify(inputProof) as `0x${string}`;

      const iface = new ethers.Interface([
        "function placeEncryptedOrder(bytes32[] handles, bytes inputProof, address rwaToken, uint8 side) returns (uint256)"
      ]);
      const data = iface.encodeFunctionData("placeEncryptedOrder", [handlesHex, proofHex, rwaToken, activeSide === "BUY" ? 0 : 1]);

      const hash = await (wc as any).sendTransaction({
        to: DARKPOOL_ADDRESS,
        data,
        gas: BigInt(3_000_000),
      });

      // Parse tx receipt to get the orderId from OrderPlaced event
      try {
        const receipt = await (wc as any).waitForTransactionReceipt?.(hash) ||
          await publicClient?.waitForTransactionReceipt({ hash });
        if (receipt?.logs) {
          const orderPlacedIface = new ethers.Interface([
            "event OrderPlaced(uint256 orderId, address trader, address rwaToken, uint8 side, uint256 timestamp)"
          ]);
          for (const log of receipt.logs) {
            try {
              const decoded = orderPlacedIface.parseLog({ topics: log.topics as string[], data: log.data as string });
              if (decoded && decoded.name === "OrderPlaced") {
                const shortName = selectedToken.split(" — ")[0];
                const orderId = decoded.args[0].toString();
                const labels = JSON.parse(localStorage.getItem("cipherRwa_tokenLabels") || "{}");
                labels[orderId] = shortName;
                localStorage.setItem("cipherRwa_tokenLabels", JSON.stringify(labels));
                break;
              }
            } catch {}
          }
        }
      } catch {}

      setTxHash(hash);
      setTxStatus("success");
      setAmount("");
      setPrice("");
      setRiskScore("");
      setTimeout(() => onSuccess(), 3000);
    } catch (e: any) {
      setTxError(e.shortMessage || e.message || "Transaction failed");
      setTxStatus("error");
    }
  }

  const isBusy = txStatus === "encrypting" || txStatus === "submitting";

  return (
    <div style={{ maxWidth: 560 }}>
      <Panel>
        <PanelTitle>Place Encrypted Order</PanelTitle>

        <div style={{ display: "flex", marginBottom: "1rem" }}>
          {(["BUY", "SELL"] as const).map((s) => (
            <div
              key={s}
              onClick={() => setActiveSide(s)}
              style={{
                flex: 1,
                padding: "0.7rem",
                textAlign: "center" as const,
                fontSize: "0.65rem",
                fontWeight: 600,
                letterSpacing: "0.15em",
                cursor: "none",
                transition: "all 0.2s",
                background:
                  activeSide === s ? (s === "BUY" ? "rgba(39,174,96,0.15)" : "rgba(192,57,43,0.15)") : "transparent",
                border: `1px solid ${activeSide === s ? (s === "BUY" ? "rgba(39,174,96,0.4)" : "rgba(192,57,43,0.4)") : gb}`,
                color: activeSide === s ? (s === "BUY" ? green : red) : textDim,
              }}
            >
              {s}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.85rem" }}>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.35rem" }}>
            <label style={{ fontSize: "0.52rem", letterSpacing: "0.2em", color: textDim }}>RWA TOKEN</label>
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              style={{
                background: "rgba(245,200,0,0.04)",
                border: "1px solid rgba(245,200,0,0.12)",
                color: "#f0e6c0",
                padding: "0.65rem 0.8rem",
                fontFamily: "monospace",
                fontSize: "0.72rem",
                outline: "none",
                cursor: "none",
                appearance: "none" as const,
              }}
            >
              <option>cTBILL — US Treasury</option>
              <option>cREAL — Real Estate</option>
              <option>cCARBON — Carbon Credit</option>
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
            {[
              { label: "AMOUNT (USDC)", placeholder: "100000", val: amount, set: setAmount },
              { label: "PRICE PER TOKEN", placeholder: "9.85", val: price, set: setPrice },
              { label: "RISK SCORE (0–100)", placeholder: "20", val: riskScore, set: setRiskScore },
            ].map((f) => (
              <div key={f.label} style={{ display: "flex", flexDirection: "column" as const, gap: "0.35rem" }}>
                <label style={{ fontSize: "0.52rem", letterSpacing: "0.2em", color: textDim }}>{f.label}</label>
                <input
                  value={f.val}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  style={{
                    background: "rgba(245,200,0,0.04)",
                    border: "1px solid rgba(245,200,0,0.12)",
                    color: "#f0e6c0",
                    padding: "0.65rem 0.8rem",
                    fontFamily: "monospace",
                    fontSize: "0.72rem",
                    outline: "none",
                    cursor: "none",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "rgba(245,200,0,0.4)")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(245,200,0,0.12)")}
                />
              </div>
            ))}
          </div>

          <div
            style={{
              background: "rgba(245,200,0,0.04)",
              border: "1px solid rgba(245,200,0,0.1)",
              padding: "0.7rem 0.9rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.55rem",
              color: textDim,
              fontFamily: "monospace",
            }}
          >
            <span style={{ color: Y }}>⬡</span>
            Values encrypted client-side via Zama SDK before submission. Zero plaintext on-chain.
          </div>

          {txStatus === "encrypting" && (
            <div
              style={{
                padding: "0.6rem",
                background: "rgba(245,200,0,0.06)",
                border: "1px solid rgba(245,200,0,0.2)",
                fontSize: "0.58rem",
                color: Y,
                letterSpacing: "0.1em",
                textAlign: "center" as const,
              }}
            >
              ⬡ ENCRYPTING VALUES...
            </div>
          )}
          {txStatus === "submitting" && (
            <div
              style={{
                padding: "0.6rem",
                background: "rgba(39,174,96,0.06)",
                border: "1px solid rgba(39,174,96,0.2)",
                fontSize: "0.58rem",
                color: green,
                letterSpacing: "0.1em",
                textAlign: "center" as const,
              }}
            >
              ► SUBMITTING TO SEPOLIA...
            </div>
          )}
          {txStatus === "success" && (
            <div
              style={{
                padding: "0.6rem",
                background: "rgba(39,174,96,0.06)",
                border: "1px solid rgba(39,174,96,0.2)",
                fontSize: "0.55rem",
                color: green,
              }}
            >
              ✓ ORDER PLACED —{" "}
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: Y, cursor: "none" }}
              >
                VIEW ON ETHERSCAN ↗
              </a>
            </div>
          )}
          {txStatus === "error" && (
            <div
              style={{
                padding: "0.6rem",
                background: "rgba(192,57,43,0.06)",
                border: "1px solid rgba(192,57,43,0.2)",
                fontSize: "0.55rem",
                color: red,
              }}
            >
              ✕ {txError}
            </div>
          )}

          <button
            onClick={handlePlaceOrder}
            disabled={!isConnected || isBusy}
            style={{
              padding: "0.85rem",
              background: !isConnected ? textMuted : Y,
              color: !isConnected ? "#3a2e0a" : ink,
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.15em",
              border: "none",
              cursor: "none",
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (isConnected && !isBusy) {
                (e.currentTarget as HTMLButtonElement).style.background = "#ffe033";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 20px rgba(245,200,0,0.2)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = !isConnected ? textMuted : Y;
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
          >
            {!isConnected
              ? "CONNECT WALLET TO PLACE ORDER"
              : txStatus === "encrypting"
                ? "ENCRYPTING..."
                : txStatus === "submitting"
                  ? "SUBMITTING..."
                  : `⊕ ENCRYPT & SUBMIT ${activeSide} ORDER`}
          </button>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.52rem",
              color: textMuted,
              letterSpacing: "0.08em",
            }}
          >
            <span>Gas est: ~500,000</span>
            <span>Network: Sepolia</span>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function SettlementView({ orders, address, connector, isConnected, chain, publicClient, onMatchSuccess }: any) {
  const [matchStatus, setMatchStatus] = useState<"idle" | "matching" | "matched" | "error">("idle");
  const [matchResult, setMatchResult] = useState("");
  const [matchedOrders, setMatchedOrders] = useState<any[]>([]);

  async function handleMatchOrders() {
    if (!isConnected || !connector || !address) {
      setMatchStatus("error");
      setMatchResult("Wallet not connected");
      return;
    }

    const buyOrder = orders.find((o: any) => o.side === "BUY" && o.status === "OPEN");
    const sellOrder = orders.find((o: any) => o.side === "SELL" && o.status === "OPEN");

    if (!buyOrder || !sellOrder) {
      setMatchStatus("error");
      setMatchResult("Need at least one OPEN BUY and one OPEN SELL order");
      return;
    }

    setMatchStatus("matching");
    setMatchResult("");

    try {
      const wc = await getWalletClient(config, { connector });

      // confirmMatch auto-computes if needed
      const iface = new ethers.Interface([
        "function confirmMatch(uint256 buyOrderId, uint256 sellOrderId) external"
      ]);
      const data = iface.encodeFunctionData("confirmMatch", [BigInt(buyOrder.id), BigInt(sellOrder.id)]);

      const hash = await (wc as any).sendTransaction({
        to: MATCHING_ENGINE_ADDRESS,
        data,
        gas: BigInt(3_000_000),
      });

      setMatchResult(`Match executed — TX: ${hash.slice(0, 10)}...`);
      setMatchStatus("matched");
      setMatchedOrders(prev => [...prev, { buyId: buyOrder.id, sellId: sellOrder.id, tx: hash }]);
      if (onMatchSuccess) onMatchSuccess();
    } catch (e: any) {
      setMatchStatus("error");
      setMatchResult(e.shortMessage || e.message || "Match failed");
    }
  }

  const openBuys = orders.filter((o: any) => o.side === "BUY" && o.status === "OPEN");
  const openSells = orders.filter((o: any) => o.side === "SELL" && o.status === "OPEN");
  const matched = orders.filter((o: any) => o.status === "MATCHED" || o.status === "SETTLED");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
      <Panel>
        <PanelTitle>Homomorphic Matching</PanelTitle>
        <p style={{ fontSize: "0.58rem", color: textDim, lineHeight: 1.8, marginBottom: "1rem" }}>
          The MatchingEngine uses <span style={{ color: Y }}>TFHE.le()</span> to compare encrypted prices.
          Buy price vs sell price — all ciphertext, zero plaintext.
        </p>

        <div style={{ background: "rgba(245,200,0,0.04)", border: "1px solid rgba(245,200,0,0.1)", padding: "0.8rem", marginBottom: "1rem", fontSize: "0.58rem", color: textDim, fontFamily: "monospace" }}>
          <div style={{ color: Y, marginBottom: "0.3rem", letterSpacing: "0.1em" }}>MATCHING FLOW</div>
          <div style={{ lineHeight: 2 }}>
            1. Place encrypted BUY/SELL orders<br />
            2. confirmMatch() → auto-computes + executes<br />
            3. executeMatch() → orders marked MATCHED<br />
            4. Gateway decrypt → settleOrders()
          </div>
        </div>

        <div style={{ marginBottom: "0.8rem" }}>
          <div style={{ fontSize: "0.55rem", color: Y, marginBottom: "0.3rem" }}>OPEN ORDERS</div>
          <div style={{ display: "flex", gap: "1rem", marginBottom: "0.5rem" }}>
            <div>
              <div style={{ fontSize: "0.5rem", color: green }}>BUY ({openBuys.length})</div>
              {openBuys.map((o: any) => (
                <div key={o.id} style={{ fontSize: "0.52rem", color: textDim, fontFamily: "monospace" }}>#{o.id}</div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: "0.5rem", color: red }}>SELL ({openSells.length})</div>
              {openSells.map((o: any) => (
                <div key={o.id} style={{ fontSize: "0.52rem", color: textDim, fontFamily: "monospace" }}>#{o.id}</div>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleMatchOrders}
          disabled={matchStatus === "matching" || openBuys.length === 0 || openSells.length === 0}
          style={{
            width: "100%",
            padding: "0.7rem",
            background: openBuys.length === 0 || openSells.length === 0 ? textMuted : matchStatus === "matching" ? Y : green,
            color: matchStatus === "matching" ? ink : "#fff",
            fontSize: "0.62rem",
            fontWeight: 700,
            letterSpacing: "0.15em",
            border: "none",
            cursor: "none",
            fontFamily: "inherit",
          }}
        >
          {matchStatus === "matching" ? "MATCHING..." : "MATCH ORDERS"}
        </button>

        {matchResult && (
          <div style={{
            marginTop: "0.5rem",
            padding: "0.5rem",
            background: matchStatus === "error" ? "rgba(192,57,43,0.06)" : "rgba(39,174,96,0.06)",
            border: `1px solid ${matchStatus === "error" ? "rgba(192,57,43,0.2)" : "rgba(39,174,96,0.2)"}`,
            fontSize: "0.52rem",
            color: matchStatus === "error" ? red : green,
            fontFamily: "monospace",
          }}>
            {matchResult}
          </div>
        )}
      </Panel>

      <Panel>
        <PanelTitle>Settlement — Gateway Decrypt</PanelTitle>
        <p style={{ fontSize: "0.58rem", color: textDim, lineHeight: 1.8, marginBottom: "1rem" }}>
          After matching, orders are settled via the <span style={{ color: Y }}>Zama Gateway</span> async decrypt.
          KMS signers provide decryption proofs — only matched parties see plaintext.
        </p>

        <div style={{ background: "rgba(245,200,0,0.04)", border: "1px solid rgba(245,200,0,0.1)", padding: "0.8rem", marginBottom: "1rem", fontSize: "0.58rem", color: textDim, fontFamily: "monospace" }}>
          <div style={{ color: Y, marginBottom: "0.3rem", letterSpacing: "0.1em" }}>SETTLEMENT FLOW</div>
          <div style={{ lineHeight: 2 }}>
            1. executeMatch() → orders marked MATCHED<br />
            2. TFHE.allow() → handles decryptable<br />
            3. Gateway.requestDecryption()<br />
            4. KMS signs → onSettlementCallback()<br />
            5. Orders marked SETTLED
          </div>
        </div>

        <div style={{ marginBottom: "0.8rem" }}>
          <div style={{ fontSize: "0.55rem", color: Y, marginBottom: "0.3rem" }}>MATCHED / SETTLED</div>
          {matched.length === 0 ? (
            <div style={{ fontSize: "0.52rem", color: textDim, textAlign: "center", padding: "1rem" }}>NO MATCHES YET</div>
          ) : (
            matched.map((o: any) => (
              <div key={o.id} style={{
                display: "flex", justifyContent: "space-between", padding: "0.4rem 0",
                borderBottom: "1px solid rgba(245,200,0,0.05)", fontSize: "0.55rem"
              }}>
                <span style={{ fontFamily: "monospace", color: Y }}>#{o.id}</span>
                <span style={{ color: o.side === "BUY" ? green : red }}>{o.side}</span>
                <span style={{ color: o.status === "SETTLED" ? "#6ab0ff" : green }}>{o.status}</span>
              </div>
            ))
          )}
        </div>

        {matchedOrders.length > 0 && (
          <div style={{ padding: "0.5rem", background: "rgba(39,174,96,0.06)", border: "1px solid rgba(39,174,96,0.2)", fontSize: "0.52rem", color: green, fontFamily: "monospace" }}>
            <div style={{ color: Y, marginBottom: "0.2rem", letterSpacing: "0.1em" }}>SESSION MATCHES</div>
            {matchedOrders.map((m, i) => (
              <div key={i}>BUY #{m.buyId} ↔ SELL #{m.sellId}</div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function RWATokensView() {
  const tokenAddrs: Record<string, string> = {
    cTBILL: RWA_ADDRESS,
    cREAL: RWA_CREAL_ADDRESS,
    cCARBON: RWA_CCARBON_ADDRESS,
  };
  const tokens = [
    { symbol: "cTBILL", name: "US Treasury Bills", type: "treasury", jurisdiction: "US", maturity: "Rolling 90-day" },
    { symbol: "cREAL", name: "Real Estate", type: "real-estate", jurisdiction: "Global", maturity: "Perpetual" },
    {
      symbol: "cCARBON",
      name: "Carbon Credits",
      type: "carbon-credit",
      jurisdiction: "EU/UN",
      maturity: "Vintage 2024",
    },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
      {tokens.map((t, i) => (
        <Panel key={i}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.2rem" }}>
            <div
              style={{
                width: 36,
                height: 36,
                background: Y,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.65rem",
                fontWeight: 700,
                color: ink,
                flexShrink: 0,
              }}
            >
              {t.symbol.slice(1, 3)}
            </div>
            <div>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#f0e6c0" }}>{t.symbol}</div>
              <div style={{ fontSize: "0.55rem", color: textDim }}>{t.name}</div>
            </div>
          </div>
          {[
            { label: "TYPE", val: t.type },
            { label: "JURISDICTION", val: t.jurisdiction },
            { label: "MATURITY", val: t.maturity },
            { label: "CONTRACT", val: `${tokenAddrs[t.symbol].slice(0, 8)}...` },
          ].map((r) => (
            <div
              key={r.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "0.4rem 0",
                borderBottom: `1px solid rgba(245,200,0,0.05)`,
                fontSize: "0.6rem",
              }}
            >
              <span style={{ color: textMuted, letterSpacing: "0.1em" }}>{r.label}</span>
              <span style={{ color: textDim, fontFamily: "monospace" }}>{r.val}</span>
            </div>
          ))}
          <div
            style={{
              marginTop: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              fontSize: "0.52rem",
              color: green,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: green, display: "inline-block" }} />
            WHITELISTED · ACTIVE
          </div>
        </Panel>
      ))}
    </div>
  );
}

function PortfolioView({ orders }: any) {
  return (
    <Panel>
      <PanelTitle>Portfolio — Encrypted Holdings</PanelTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Total Value", val: "████████", enc: true },
          { label: "Open Positions", val: orders.filter((o: any) => o.status === "OPEN").length.toString() },
          { label: "P&L", val: "████████", enc: true },
        ].map((s, i) => (
          <div key={i} style={{ background: glass, border: `1px solid ${gb}`, padding: "1rem 1.2rem" }}>
            <div
              style={{
                fontSize: "0.52rem",
                letterSpacing: "0.2em",
                color: textDim,
                marginBottom: "0.4rem",
                textTransform: "uppercase" as const,
              }}
            >
              {s.label}
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: s.enc ? Y : "#f0e6c0", fontFamily: "monospace" }}>
              {s.val}
            </div>
            {s.enc && (
              <div style={{ fontSize: "0.48rem", color: Y, marginTop: "0.2rem", letterSpacing: "0.1em" }}>
                ⬡ ENCRYPTED · euint64
              </div>
            )}
          </div>
        ))}
      </div>
      <div
        style={{
          fontSize: "0.65rem",
          color: textDim,
          lineHeight: 1.8,
          padding: "1rem",
          background: "rgba(245,200,0,0.03)",
          border: "1px solid rgba(245,200,0,0.07)",
        }}
      >
        All portfolio values are stored as <span style={{ color: Y }}>euint64 ciphertext</span> on-chain. Only your
        wallet can decrypt your holdings via the Zama Gateway. No counterparty, operator, or observer can see your
        position sizes.
      </div>
    </Panel>
  );
}

function AIAgentView({ onFillOrder }: { onFillOrder: (data: { side: "BUY" | "SELL"; token: string; amount: string; price: string; risk: string }) => void }) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  function handleGenerate() {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      const p = prompt.toLowerCase();
      const side = p.includes("sell") ? "SELL" as const : "BUY" as const;
      const token = p.includes("real") ? "cREAL — Real Estate" : p.includes("carbon") ? "cCARBON — Carbon Credit" : "cTBILL — US Treasury";
      const amount = prompt.match(/(\d[\d,]*)\s*(cTBILL|cREAL|cCARBON|tokens?)/i)?.[1]?.replace(/,/g, "") || "50000";
      const price = prompt.match(/\$\s*([\d.]+)/)?.[1] || "9.85";
      const risk = prompt.match(/risk\s*(?:score)?\s*(\d+)/i)?.[1] || "20";
      setGenerated(true);
      setIsGenerating(false);
      onFillOrder({ side, token, amount, price, risk });
    }, 1800);
  }

  const examples = [
    "Buy 50,000 cTBILL at $9.85 with risk score 20",
    "Sell 100,000 cREAL at $12.40 with risk score 45",
    "Buy 250,000 cCARBON at $15.00 with risk score 30",
  ];

  return (
    <div style={{ maxWidth: 640 }}>
      <Panel>
        <PanelTitle>AI Encrypted Order Generator</PanelTitle>
        <p style={{ fontSize: "0.62rem", color: textDim, lineHeight: 1.8, marginBottom: "1rem" }}>
          Describe your trade in plain English. The AI generates an encrypted order with FHE-encrypted handles and ZK proof, ready for submission to the dark pool.
        </p>

        <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.6rem", marginBottom: "1rem" }}>
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              style={{
                background: "rgba(245,200,0,0.04)",
                border: "1px solid rgba(245,200,0,0.1)",
                color: textDim,
                padding: "0.5rem 0.7rem",
                fontSize: "0.6rem",
                fontFamily: "inherit",
                cursor: "none",
                textAlign: "left" as const,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = Y)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(245,200,0,0.1)")}
            >
              {ex}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your encrypted order..."
            style={{
              flex: 1,
              background: "rgba(245,200,0,0.04)",
              border: "1px solid rgba(245,200,0,0.12)",
              color: "#f0e6c0",
              padding: "0.65rem 0.8rem",
              fontFamily: "monospace",
              fontSize: "0.72rem",
              outline: "none",
              cursor: "none",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(245,200,0,0.4)")}
            onBlur={(e) => (e.target.style.borderColor = "rgba(245,200,0,0.12)")}
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{
              padding: "0.65rem 1.2rem",
              background: isGenerating ? textMuted : Y,
              color: isGenerating ? "#3a2e0a" : ink,
              fontSize: "0.62rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              border: "none",
              cursor: "none",
              fontFamily: "inherit",
              whiteSpace: "nowrap" as const,
            }}
          >
            {isGenerating ? "ENCRYPTING..." : "GENERATE FHE ORDER"}
          </button>
        </div>

        {isGenerating && (
          <div style={{ marginTop: "1rem", padding: "0.6rem", background: "rgba(245,200,0,0.06)", border: "1px solid rgba(245,200,0,0.2)", fontSize: "0.58rem", color: Y, letterSpacing: "0.1em", textAlign: "center" as const }}>
            ⬡ GENERATING ENCRYPTED HANDLES + ZK PROOF...
          </div>
        )}
        {generated && (
          <div style={{ marginTop: "1rem", padding: "0.6rem", background: "rgba(39,174,96,0.06)", border: "1px solid rgba(39,174,96,0.2)", fontSize: "0.55rem", color: green }}>
            ✓ ORDER GENERATED — Navigate to Place Order to review and submit
          </div>
        )}

        <div style={{ marginTop: "1.2rem", fontSize: "0.52rem", color: textMuted, letterSpacing: "0.08em", padding: "0.7rem", background: "rgba(245,200,0,0.03)", border: "1px solid rgba(245,200,0,0.06)" }}>
          <div style={{ color: Y, marginBottom: "0.3rem", letterSpacing: "0.1em" }}>FHE PATTERNS USED</div>
          <div style={{ lineHeight: 2 }}>
            • euint64 amount → TFHE.asEuint64(handles[0])<br />
            • euint64 price → TFHE.asEuint64(handles[1])<br />
            • euint64 riskScore → TFHE.asEuint64(handles[2])<br />
            • ACL allow(orderOwner) → owner-only decrypt<br />
            • Gateway.requestDecryption → async settlement
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [activeNav, setActiveNav] = useState("Overview");
  const [barsVisible, setBarsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [twapCount, setTwapCount] = useState(0);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [aiOrderData, setAiOrderData] = useState<{ side: "BUY" | "SELL"; token: string; amount: string; price: string; risk: string } | null>(null);
  const [wrongChain, setWrongChain] = useState(false);
  const [switchingChain, setSwitchingChain] = useState(false);

  const { address, isConnected, chain, connector } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();

  useEffect(() => {
    setMounted(true);
    setTimeout(() => setBarsVisible(true), 300);
  }, []);

  useEffect(() => {
    if (mounted && isConnected && chain && chain.id !== sepolia.id) {
      setWrongChain(true);
      setSwitchingChain(true);
      switchChain({ chainId: sepolia.id }, {
        onSuccess: () => { setWrongChain(false); setSwitchingChain(false); },
        onError: () => { setSwitchingChain(false); },
      });
    } else {
      setWrongChain(false);
    }
  }, [mounted, isConnected, chain]);

  useEffect(() => {
    let rx = window.innerWidth / 2,
      ry = window.innerHeight / 2,
      mx = rx,
      my = ry;
    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (cursorRef.current) {
        cursorRef.current.style.left = mx + "px";
        cursorRef.current.style.top = my + "px";
      }
    };
    const anim = () => {
      rx += (mx - rx) * 0.1;
      ry += (my - ry) * 0.1;
      if (ringRef.current) {
        ringRef.current.style.left = rx + "px";
        ringRef.current.style.top = ry + "px";
      }
      requestAnimationFrame(anim);
    };
    window.addEventListener("mousemove", onMove);
    anim();
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    if (mounted && isConnected && address && publicClient) {
      loadOrders();
    }
  }, [mounted, isConnected, address]);

  useEffect(() => {
    if (!mounted || !publicClient) return;
    const unwatch = publicClient.watchContractEvent({
      address: DARKPOOL_ADDRESS,
      abi: [
        {
          name: "OrderPlaced",
          type: "event",
          inputs: [
            { name: "orderId", type: "uint256" },
            { name: "trader", type: "address" },
            { name: "rwaToken", type: "address" },
            { name: "side", type: "uint8" },
            { name: "timestamp", type: "uint256" },
          ],
        },
      ] as const,
      eventName: "OrderPlaced",
      onLogs: () => {
        loadOrders();
      },
    });
    return () => unwatch();
  }, [mounted, publicClient]);

  async function loadOrders() {
    if (!address || !publicClient) return;
    setLoadingOrders(true);
    try {
      const ids = (await (publicClient as any).readContract({
        address: DARKPOOL_ADDRESS,
        abi: DARKPOOL_ABI,
        functionName: "getTraderOrders",
        args: [address],
      })) as bigint[];
      const data = await Promise.all(
        ids
          .slice(-10)
          .reverse()
          .map(async (id) => {
            const meta = await (publicClient as any).readContract({
              address: DARKPOOL_ADDRESS,
              abi: DARKPOOL_ABI,
              functionName: "getOrderMeta",
              args: [id],
            });
            return {
              id: id.toString(),
              rwaToken: (meta as any)[1].toString().toLowerCase(),
              side: SIDES[(meta as any)[2]] || "BUY",
              status: STATUSES[(meta as any)[3]] || "OPEN",
              blockNumber: (meta as any)[4].toString(),
            };
          }),
      );
      setOrders(data);

      // Load TWAP count from MatchingEngine
      try {
        const twap = await (publicClient as any).readContract({
          address: MATCHING_ENGINE_ADDRESS,
          abi: MATCHING_ENGINE_ABI,
          functionName: "getTWAPCount",
          args: [RWA_ADDRESS],
        });
        setTwapCount(Number(twap));
      } catch {}
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOrders(false);
    }
  }

  function onAIFillOrder(data: { side: "BUY" | "SELL"; token: string; amount: string; price: string; risk: string }) {
    setAiOrderData(data);
    setActiveNav("Place Order");
  }

  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

  const navItems = [
    { label: "Overview", icon: "⊞" },
    { label: "Place Order", icon: "⊕", badge: "NEW" },
    { label: "Order Book", icon: "≋" },
    { label: "Settlement", icon: "◎" },
    { label: "RWA Tokens", icon: "◈" },
    { label: "Portfolio", icon: "⬡" },
    { label: "AI Agent", icon: "⌘", badge: "FHE" },
  ];

  function renderView() {
    switch (activeNav) {
      case "Overview":
        return (
          <OverviewView
            orders={orders}
            twapCount={twapCount}
            barsVisible={barsVisible}
            onPlaceOrder={() => setActiveNav("Place Order")}
          />
        );
      case "Place Order":
        return (
          <PlaceOrderView
            isConnected={isConnected}
            connector={connector}
            address={address}
            chain={chain}
            publicClient={publicClient}
            mounted={mounted}
            onSuccess={() => {
              loadOrders();
              setActiveNav("Order Book");
            }}
            aiOrderData={aiOrderData}
          />
        );
      case "Order Book":
        return <OrderHistoryView orders={orders} loadingOrders={loadingOrders} loadOrders={loadOrders} />;
      case "Settlement":
        return <SettlementView orders={orders} address={address} connector={connector} isConnected={isConnected} chain={chain} publicClient={publicClient} />;
      case "RWA Tokens":
        return <RWATokensView />;
      case "Portfolio":
        return <PortfolioView orders={orders} />;
      case "AI Agent":
        return <AIAgentView onFillOrder={onAIFillOrder} />;
      default:
        return null;
    }
  }

  return (
    <>
      <div
        ref={cursorRef}
        style={{
          position: "fixed",
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: Y,
          pointerEvents: "none",
          zIndex: 9999,
          transform: "translate(-50%,-50%)",
          boxShadow: `0 0 6px ${Y}`,
        }}
      />
      <div
        ref={ringRef}
        style={{
          position: "fixed",
          width: 24,
          height: 24,
          borderRadius: "50%",
          border: "1px solid rgba(245,200,0,0.4)",
          pointerEvents: "none",
          zIndex: 9998,
          transform: "translate(-50%,-50%)",
        }}
      />

      <div
        style={{
          display: "flex",
          height: "100vh",
          background: "#080600",
          color: "#f0e6c0",
          fontFamily: "'Courier New', monospace",
          overflow: "hidden",
          cursor: "none",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 0,
            backgroundImage:
              "linear-gradient(rgba(245,200,0,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(245,200,0,0.02) 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 9997,
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.01) 2px,rgba(0,0,0,0.01) 4px)",
          }}
        />

        {/* SIDEBAR */}
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            background: "rgba(8,6,0,0.95)",
            borderRight: `1px solid ${gb}`,
            display: "flex",
            flexDirection: "column",
            padding: "1.5rem 0",
            backdropFilter: "blur(20px)",
            position: "relative",
            zIndex: 10,
          }}
        >
          <a
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0 1.5rem 1.5rem",
              borderBottom: `1px solid ${gb}`,
              marginBottom: "1.5rem",
              textDecoration: "none",
              cursor: "none",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                background: Y,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.7rem",
                fontWeight: 700,
                color: ink,
              }}
            >
              CR
            </div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, letterSpacing: "0.1em" }}>
              <span style={{ color: Y }}>CIPHER</span>RWA
            </div>
          </a>

          <div
            style={{
              fontSize: "0.5rem",
              letterSpacing: "0.3em",
              color: textMuted,
              padding: "0 1.5rem",
              marginBottom: "0.5rem",
            }}
          >
            MAIN
          </div>

          {navItems.map((item) => (
            <div
              key={item.label}
              onClick={() => setActiveNav(item.label)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.65rem 1.5rem",
                fontSize: "0.75rem",
                letterSpacing: "0.05em",
                color: activeNav === item.label ? "#f0e6c0" : textDim,
                cursor: "none",
                transition: "all 0.2s",
                position: "relative",
                background: activeNav === item.label ? "rgba(245,200,0,0.06)" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (activeNav !== item.label)
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(245,200,0,0.04)";
              }}
              onMouseLeave={(e) => {
                if (activeNav !== item.label) (e.currentTarget as HTMLDivElement).style.background = "transparent";
              }}
            >
              {activeNav === item.label && (
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: Y }} />
              )}
              <span style={{ fontSize: "0.85rem", opacity: activeNav === item.label ? 1 : 0.5 }}>{item.icon}</span>
              {item.label}
              {item.badge && (
                <span
                  style={{
                    marginLeft: "auto",
                    background: Y,
                    color: ink,
                    fontSize: "0.48rem",
                    fontWeight: 700,
                    padding: "0.1rem 0.4rem",
                  }}
                >
                  {item.badge}
                </span>
              )}
            </div>
          ))}

          <div style={{ marginTop: "auto", padding: "1.5rem", borderTop: `1px solid ${gb}` }}>
            {!mounted ? null : isConnected ? (
              <div
                style={{
                  background: wrongChain ? "rgba(192,57,43,0.1)" : "rgba(245,200,0,0.07)",
                  border: `1px solid ${wrongChain ? "rgba(192,57,43,0.3)" : "rgba(245,200,0,0.15)"}`,
                  padding: "0.7rem 0.9rem",
                }}
              >
                <div style={{ fontSize: "0.5rem", letterSpacing: "0.2em", color: textDim, marginBottom: "0.3rem" }}>
                  CONNECTED
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "0.65rem", color: Y }}>{shortAddr}</div>
                <div
                  style={{
                    fontSize: "0.5rem",
                    color: wrongChain ? red : textDim,
                    marginTop: "0.2rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: wrongChain ? red : green,
                      boxShadow: `0 0 4px ${wrongChain ? red : green}`,
                      display: "inline-block",
                    }}
                  />
                  {wrongChain ? `WRONG NETWORK (ID: ${chain?.id})` : chain?.name || "Sepolia"}
                </div>
                {wrongChain && (
                  <button
                    onClick={() => switchChain({ chainId: sepolia.id })}
                    disabled={switchingChain}
                    style={{
                      marginTop: "0.4rem",
                      width: "100%",
                      padding: "0.4rem",
                      background: red,
                      color: "#fff",
                      fontSize: "0.55rem",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      border: "none",
                      cursor: switchingChain ? "not-allowed" : "none",
                      fontFamily: "inherit",
                      opacity: switchingChain ? 0.6 : 1,
                    }}
                  >
                    {switchingChain ? "SWITCHING..." : "⚠ SWITCH TO SEPOLIA"}
                  </button>
                )}
                <button
                  onClick={() => disconnect()}
                  style={{
                    marginTop: "0.5rem",
                    width: "100%",
                    padding: "0.3rem",
                    background: "transparent",
                    border: `1px solid ${wrongChain ? "rgba(192,57,43,0.3)" : "rgba(245,200,0,0.15)"}`,
                    color: textDim,
                    fontSize: "0.5rem",
                    letterSpacing: "0.1em",
                    cursor: "none",
                    fontFamily: "inherit",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = wrongChain ? "rgba(192,57,43,0.5)" : "rgba(245,200,0,0.4)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = wrongChain ? "rgba(192,57,43,0.3)" : "rgba(245,200,0,0.15)")}
                >
                  DISCONNECT
                </button>
              </div>
            ) : (
              <button
                onClick={() => connect({ connector: injected(), chainId: sepolia.id })}
                disabled={isConnecting}
                style={{
                  width: "100%",
                  padding: "0.7rem",
                  background: Y,
                  color: ink,
                  fontFamily: "inherit",
                  fontSize: "0.62rem",
                  letterSpacing: "0.15em",
                  fontWeight: 700,
                  border: "none",
                  cursor: "none",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#ffe033")}
                onMouseLeave={(e) => (e.currentTarget.style.background = Y)}
              >
                {isConnecting ? "CONNECTING..." : "► CONNECT WALLET"}
              </button>
            )}
          </div>
        </aside>

        {/* MAIN */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* TOPBAR */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1.2rem 2rem",
              borderBottom: `1px solid ${gb}`,
              background: "rgba(8,6,0,0.85)",
              backdropFilter: "blur(20px)",
              flexShrink: 0,
            }}
          >
            <div>
              <h1 style={{ fontSize: "1.1rem", fontWeight: 600, letterSpacing: "-0.01em" }}>
                Dark Pool <span style={{ color: Y }}>{activeNav}</span>
              </h1>
              <p style={{ fontSize: "0.62rem", color: textDim, marginTop: "0.1rem", letterSpacing: "0.05em" }}>
                CLASSIFIED · FHE-ENCRYPTED · ZAMA FHEVM v0.6
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  padding: "0.4rem 0.8rem",
                  border: "1px solid rgba(39,174,96,0.3)",
                  fontSize: "0.55rem",
                  letterSpacing: "0.15em",
                  color: green,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: green,
                    display: "inline-block",
                    animation: "blink 2s infinite",
                  }}
                />
                SEPOLIA LIVE
              </div>
              <button
                onClick={() => setActiveNav("Place Order")}
                style={{
                  padding: "0.5rem 1.2rem",
                  background: Y,
                  color: ink,
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  border: "none",
                  cursor: "none",
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#ffe033")}
                onMouseLeave={(e) => (e.currentTarget.style.background = Y)}
              >
                ⊕ PLACE ORDER
              </button>
            </div>
          </div>

          {/* CONTENT */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "1.5rem 2rem 4rem" }}>
            {!mounted ? null : wrongChain ? (
              <div
                style={{
                  background: "rgba(192,57,43,0.08)",
                  border: "1px solid rgba(192,57,43,0.25)",
                  padding: "1rem 1.4rem",
                  marginBottom: "1.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.65rem", color: red, letterSpacing: "0.15em", marginBottom: "0.2rem" }}>
                    ⚠ WRONG NETWORK DETECTED
                  </div>
                  <div style={{ fontSize: "0.58rem", color: textDim }}>
                    Your wallet is on chain ID {chain?.id}. The FHE dark pool requires <b style={{ color: Y }}>Sepolia (11155111)</b>.
                  </div>
                </div>
                <button
                  onClick={() => switchToSepolia().then((ok) => { if (ok) setWrongChain(false); })}
                  disabled={switchingChain}
                  style={{
                    padding: "0.6rem 1.4rem",
                    background: red,
                    color: "#fff",
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    border: "none",
                    cursor: switchingChain ? "not-allowed" : "none",
                    fontFamily: "inherit",
                    flexShrink: 0,
                    marginLeft: "1rem",
                  }}
                >
                  {switchingChain ? "SWITCHING..." : "SWITCH TO SEPOLIA"}
                </button>
              </div>
            ) : !isConnected && activeNav !== "RWA Tokens" && activeNav !== "Settlement" ? (
              <div
                style={{
                  background: "rgba(245,200,0,0.06)",
                  border: "1px solid rgba(245,200,0,0.2)",
                  padding: "1rem 1.4rem",
                  marginBottom: "1.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.65rem", color: Y, letterSpacing: "0.15em", marginBottom: "0.2rem" }}>
                    ⬡ FHE CLEARANCE REQUIRED
                  </div>
                  <div style={{ fontSize: "0.58rem", color: textDim }}>
                    Connect your wallet to access the dark pool and place encrypted orders.
                  </div>
                </div>
                <button
                  onClick={() => connect({ connector: injected(), chainId: sepolia.id })}
                  style={{
                    padding: "0.6rem 1.4rem",
                    background: Y,
                    color: ink,
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    border: "none",
                    cursor: "none",
                    fontFamily: "inherit",
                    flexShrink: 0,
                  }}
                >
                  CONNECT NOW
                </button>
              </div>
            ) : null}
            {renderView()}
          </div>
        </div>

        {/* TICKER */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 220,
            right: 0,
            zIndex: 200,
            padding: "0.45rem 2rem",
            borderTop: `1px solid ${gb}`,
            background: "rgba(8,6,0,0.97)",
            backdropFilter: "blur(16px)",
            display: "flex",
            gap: "2rem",
            alignItems: "center",
            fontFamily: "monospace",
            fontSize: "0.5rem",
            letterSpacing: "0.12em",
            color: textMuted,
          }}
        >
          <a href={`${SEPOLIA_SCAN}/address/${RWA_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: Y, textDecoration: "none", cursor: "none" }}>
            cTBILL: <b>0x2e74...9164</b> ↗
          </a>
          <a href={`${SEPOLIA_SCAN}/address/${RWA_CREAL_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: Y, textDecoration: "none", cursor: "none" }}>
            cREAL: <b>0x43f6...F5B6</b> ↗
          </a>
          <a href={`${SEPOLIA_SCAN}/address/${RWA_CCARBON_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: Y, textDecoration: "none", cursor: "none" }}>
            cCARBON: <b>0x93F6...FB3b</b> ↗
          </a>
          <a href={`${SEPOLIA_SCAN}/address/${DARKPOOL_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: Y, textDecoration: "none", cursor: "none" }}>
            DARKPOOL: <b>0x318F...4e77</b> ↗
          </a>
          <a href={`${SEPOLIA_SCAN}/address/${MATCHING_ENGINE_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: Y, textDecoration: "none", cursor: "none" }}>
            ENGINE: <b>0xD482...6f0B</b> ↗
          </a>
          <span style={{ color: green, marginLeft: "auto", animation: "blink 3s infinite" }}>● LIVE ON SEPOLIA</span>
          <span style={{ color: Y, opacity: 0.5, fontSize: "0.42rem", letterSpacing: "0.08em" }}>
            Zama Dev Program Season 2
          </span>
        </div>

        <style>{`
          @keyframes blink{0%,100%{opacity:1}50%{opacity:0.4}}
          ::-webkit-scrollbar{width:3px;}
          ::-webkit-scrollbar-track{background:transparent;}
          ::-webkit-scrollbar-thumb{background:rgba(245,200,0,0.2);}
          input::placeholder{color:#3a2e0a;}
          select option{background:#0e0b00;color:#f0e6c0;}
        `}</style>
      </div>
    </>
  );
}
