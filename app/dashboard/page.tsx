"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useConnect, useDisconnect, usePublicClient, useWalletClient } from "wagmi";
import { injected } from "wagmi/connectors";
import { ethers } from "ethers";

// Dynamic SDK import — only loads in browser
async function loadSDK() {
  const { createInstance, initSDK, SepoliaConfigV2 } = await import("@zama-fhe/relayer-sdk/web");
  return { createInstance, initSDK, SepoliaConfigV2 };
}

// ── Contract Config ──────────────────────────────────────────────────────────
const DARKPOOL_ADDRESS = "0x855dA715F3182f9A105343c91F80ba1B435BfD31" as `0x${string}`;
const RWA_ADDRESS = "0xd38489433B393F80281f5F59Abd9B82CCacE6194" as `0x${string}`;
const MATCHING_ENGINE_ADDRESS = "0xEE66574d63535a344A0b044734fC2Ec0Be2a933d" as `0x${string}`;
const SEPOLIA_SCAN = "https://sepolia.etherscan.io";

// ABI matches SDK output: handles[] + inputProof + remaining args
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

let fheInstance: any = null;

async function getFHEInstance() {
  if (fheInstance) return fheInstance;
  const { createInstance, initSDK, SepoliaConfigV2 } = await loadSDK();
  await initSDK();
  fheInstance = await createInstance({
    ...SepoliaConfigV2,
    network: "sepolia",
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
                  <div style={{ fontSize: "0.52rem", color: textDim, marginTop: "0.15rem" }}>cTBILL · {o.side}</div>
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
                cTBILL
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

function PlaceOrderView({ isConnected, walletClient, address, publicClient, mounted, onSuccess, aiOrderData }: any) {
  const [activeSide, setActiveSide] = useState<"BUY" | "SELL">(aiOrderData?.side || "BUY");
  const [selectedToken, setSelectedToken] = useState(aiOrderData?.token || "cTBILL — US Treasury");
  const [amount, setAmount] = useState(aiOrderData?.amount || "");
  const [price, setPrice] = useState(aiOrderData?.price || "");
  const [riskScore, setRiskScore] = useState(aiOrderData?.risk || "");
  const [txStatus, setTxStatus] = useState<"idle" | "encrypting" | "submitting" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState("");
  const [txError, setTxError] = useState("");

  const RWA_TOKENS: Record<string, `0x${string}`> = {
    "cTBILL — US Treasury": RWA_ADDRESS,
    "cREAL — Real Estate": "0x0000000000000000000000000000000000000000",
    "cCARBON — Carbon Credit": "0x0000000000000000000000000000000000000000",
  };

  async function handlePlaceOrder() {
    if (!mounted || !walletClient || !address || !publicClient) {
      setTxError("Wallet not ready — try again in a moment");
      setTxStatus("error");
      return;
    }
    if (!amount || !price || !riskScore) {
      setTxError("Please fill in all fields");
      setTxStatus("error");
      return;
    }

    setTxStatus("encrypting");
    setTxError("");

    try {
      const instance = await getFHEInstance();
      const rwaToken = RWA_TOKENS[selectedToken];

      const input = instance.createEncryptedInput(DARKPOOL_ADDRESS, address);
      input.add64(Math.floor(parseFloat(amount) * 1e6));
      input.add64(Math.floor(parseFloat(price) * 1e6));
      input.add64(parseInt(riskScore));

      setTxStatus("submitting");

      const { handles, inputProof } = await input.encrypt();

      const handlesHex = handles.map((h: Uint8Array) => ethers.hexlify(h)) as `0x${string}`[];
      const proofHex = ethers.hexlify(inputProof) as `0x${string}`;

      const hash = await walletClient.writeContract({
        address: DARKPOOL_ADDRESS,
        abi: DARKPOOL_ABI,
        functionName: "placeEncryptedOrder",
        args: [handlesHex, proofHex, rwaToken, activeSide === "BUY" ? 0 : 1],
      });

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

function SettlementView({ orders, address }: any) {
  const [decryptStatus, setDecryptStatus] = useState<"idle" | "decrypting" | "done" | "error">("idle");
  const [decryptResult, setDecryptResult] = useState("");

  async function handleDecrypt() {
    if (!address) return;
    setDecryptStatus("decrypting");
    setDecryptResult("");
    try {
      const instance = await getFHEInstance();
      const decrypted = await instance.decrypt(DARKPOOL_ADDRESS, address);
      setDecryptResult(JSON.stringify(decrypted, null, 2));
      setDecryptStatus("done");
    } catch (e: any) {
      setDecryptStatus("error");
    }
  }

  return (
    <Panel>
      <PanelTitle>Settlement — Gateway Async Decrypt</PanelTitle>
      <div style={{ fontSize: "0.75rem", color: textDim, lineHeight: 2, maxWidth: 560 }}>
        <p style={{ marginBottom: "1rem" }}>
          Settlement occurs via the <span style={{ color: Y }}>Zama Gateway</span> async decrypt flow. Only matched
          orders trigger decryption. Counterparty identities remain encrypted using{" "}
          <span style={{ color: Y }}>eaddress</span> type until settlement.
        </p>
        <div
          style={{
            background: "rgba(245,200,0,0.04)",
            border: "1px solid rgba(245,200,0,0.1)",
            padding: "1rem",
            fontFamily: "monospace",
            fontSize: "0.65rem",
            marginBottom: "1.2rem",
          }}
        >
          <div style={{ color: Y, marginBottom: "0.5rem", letterSpacing: "0.1em" }}>SETTLEMENT FLOW</div>
          <div style={{ color: textDim, lineHeight: 2 }}>
            1. Match found via homomorphic TFHE.ge()
            <br />
            2. requestSettlement() called by trader
            <br />
            3. Gateway.requestDecryption() triggered
            <br />
            4. settlementCallback() receives plaintext
            <br />
            5. Amounts revealed only to matched parties
          </div>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.6rem", color: Y, letterSpacing: "0.15em", marginBottom: "0.5rem" }}>
            DECRYPT YOUR ENCRYPTED DATA
          </div>
          <p style={{ fontSize: "0.58rem", color: textDim, marginBottom: "0.8rem" }}>
            Use the FHEVM SDK to reencrypt and decrypt your own order data. Only your wallet can decrypt values where ACL permissions have been granted.
          </p>
          <button
            onClick={handleDecrypt}
            disabled={decryptStatus === "decrypting"}
            style={{
              padding: "0.65rem 1.4rem",
              background: decryptStatus === "decrypting" ? textMuted : Y,
              color: decryptStatus === "decrypting" ? "#3a2e0a" : ink,
              fontSize: "0.62rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              border: "none",
              cursor: "none",
              fontFamily: "inherit",
            }}
          >
            {decryptStatus === "decrypting" ? "DECRYPTING..." : "DECRYPT MY ORDERS"}
          </button>
        </div>

        {decryptStatus === "done" && (
          <div style={{ marginTop: "0.8rem", padding: "0.6rem", background: "rgba(39,174,96,0.06)", border: "1px solid rgba(39,174,96,0.2)", fontSize: "0.55rem", color: green }}>
            ✓ DECRYPT SUCCESSFUL — Your encrypted values have been revealed
            {decryptResult && (
              <pre style={{ marginTop: "0.5rem", fontSize: "0.52rem", fontFamily: "monospace", overflow: "auto", maxHeight: 120 }}>
                {decryptResult}
              </pre>
            )}
          </div>
        )}
        {decryptStatus === "error" && (
          <div style={{ marginTop: "0.8rem", padding: "0.6rem", background: "rgba(192,57,43,0.06)", border: "1px solid rgba(192,57,43,0.2)", fontSize: "0.55rem", color: red }}>
            DECRYPT FAILED — No ACL permission or no encrypted data for this address
          </div>
        )}
      </div>
    </Panel>
  );
}

function RWATokensView() {
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
            { label: "CONTRACT", val: `${RWA_ADDRESS.slice(0, 8)}...` },
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

  const { address, isConnected, chain } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    setMounted(true);
    setTimeout(() => setBarsVisible(true), 300);
  }, []);

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
      loadTWAP();
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
        setTwapCount((prev) => prev + 1);
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
              side: SIDES[(meta as any)[2]] || "BUY",
              status: STATUSES[(meta as any)[3]] || "OPEN",
              blockNumber: (meta as any)[4].toString(),
            };
          }),
      );
      setOrders(data);
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

  async function loadTWAP() {
    if (!publicClient) return;
    try {
      const c = await (publicClient as any).readContract({
        address: DARKPOOL_ADDRESS,
        abi: DARKPOOL_ABI,
        functionName: "getTWAPCount",
        args: [RWA_ADDRESS],
      });
      setTwapCount(Number(c));
    } catch (e) {
      console.error(e);
    }
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
            walletClient={walletClient}
            address={address}
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
        return <SettlementView orders={orders} address={address} />;
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0 1.5rem 1.5rem",
              borderBottom: `1px solid ${gb}`,
              marginBottom: "1.5rem",
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
          </div>

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
                  background: "rgba(245,200,0,0.07)",
                  border: "1px solid rgba(245,200,0,0.15)",
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
                    color: textDim,
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
                      background: green,
                      boxShadow: `0 0 4px ${green}`,
                      display: "inline-block",
                    }}
                  />
                  {chain?.name || "Sepolia"}
                </div>
                <button
                  onClick={() => disconnect()}
                  style={{
                    marginTop: "0.5rem",
                    width: "100%",
                    padding: "0.3rem",
                    background: "transparent",
                    border: "1px solid rgba(245,200,0,0.15)",
                    color: textDim,
                    fontSize: "0.5rem",
                    letterSpacing: "0.1em",
                    cursor: "none",
                    fontFamily: "inherit",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(245,200,0,0.4)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(245,200,0,0.15)")}
                >
                  DISCONNECT
                </button>
              </div>
            ) : (
              <button
                onClick={() => connect({ connector: injected() })}
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
            {!mounted ? null : !isConnected && activeNav !== "RWA Tokens" && activeNav !== "Settlement" ? (
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
                  onClick={() => connect({ connector: injected() })}
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
            RWA: <b>0xd384...6194</b> ↗
          </a>
          <a href={`${SEPOLIA_SCAN}/address/${DARKPOOL_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: Y, textDecoration: "none", cursor: "none" }}>
            DARKPOOL: <b>0x855d...FD31</b> ↗
          </a>
          <a href={`${SEPOLIA_SCAN}/address/${MATCHING_ENGINE_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: Y, textDecoration: "none", cursor: "none" }}>
            ENGINE: <b>0xEE66...933d</b> ↗
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
