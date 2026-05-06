# CipherRWA — Confidential Dark Pool for Tokenized Real-World Assets

> **Built for Zama Developer Program Mainnet Season 2**

The first fully on-chain confidential dark pool for tokenized RWAs. All order parameters — price, amount, and investor risk score — are encrypted using **Fully Homomorphic Encryption (FHE)** before touching the chain. No plaintext is ever exposed to any party.

## Architecture

```
┌─────────────┐     Encrypted Order      ┌──────────────────┐
│  Investor    │ ──► handles[] + proof ──►│  DarkPool.sol    │
│  (Browser)   │     (FHEVM SDK)          │  (Sepolia)       │
└─────────────┘                          └────────┬─────────┘
                                                  │
                                    ┌─────────────▼──────────┐
                                    │  MatchingEngine.sol     │
                                    │  TFHE.ge() comparison   │
                                    │  Homorphic matching     │
                                    └─────────────┬──────────┘
                                                  │
                                    ┌─────────────▼──────────┐
                                    │  Zama Gateway           │
                                    │  Async decrypt          │
                                    │  Settlement only        │
                                    └────────────────────────┘
```

## Deployed Contracts (Sepolia)

| Contract | Address | SepoliaScan |
|----------|---------|-------------|
| cTBILL Token | `0x2e74A6F0e739B6F61f8c143385d4D80e8f3D9164` | [View ↗](https://sepolia.etherscan.io/address/0x2e74A6F0e739B6F61f8c143385d4D80e8f3D9164) |
| cREAL Token | `0x43f6F3D8e12265ABc4eCa455662ac8ce2188F5B6` | [View ↗](https://sepolia.etherscan.io/address/0x43f6F3D8e12265ABc4eCa455662ac8ce2188F5B6) |
| cCARBON Token | `0x93F67cEa9B0f231AA4d23e494066530Ab0A8fB3b` | [View ↗](https://sepolia.etherscan.io/address/0x93F67cEa9B0f231AA4d23e494066530Ab0A8fB3b) |
| Dark Pool | `0x318F23D39fd29e31a503A2A190Cff95C069E4e77` | [View ↗](https://sepolia.etherscan.io/address/0x318F23D39fd29e31a503A2A190Cff95C069E4e77) |
| Matching Engine | `0xD482e2286efd826E42609A9E9641434c5a696f0B` | [View ↗](https://sepolia.etherscan.io/address/0xD482e2286efd826E42609A9E9641434c5a696f0B) |

## Features

- **Confidential Orders** — `euint64` encrypted amounts, prices, and risk scores
- **Homomorphic Matching** — TFHE comparison operators match orders without decryption
- **Gateway Settlement** — Async decrypt via Zama Gateway only upon execution
- **ACL-Gated Decrypt** — Owner-only decryption, no counterparty visibility
- **RWA Tokenization** — cTBILL, cREAL, cCARBON tokenized asset classes
- **TWAP Oracle** — Homomorphic accumulator for time-weighted average pricing

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.24, FHEVM v0.6, OpenZeppelin |
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Wallet | wagmi v3, viem v2, injected connectors |
| Encryption | @zama-fhe/relayer-sdk v0.4.2 |
| Network | Sepolia Testnet (Chain ID 11155111) |
| Deployment | Vercel (frontend), Hardhat (contracts) |

## Getting Started

### Prerequisites

- Node.js 18+
- MetaMask or compatible EIP-1193 wallet with Sepolia ETH

### Frontend

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

### Contracts (Hardhat)

```bash
# Compile
npx hardhat compile

# Deploy to Sepolia
npx hardhat deploy --network sepolia

# Run tests
npx hardhat test
```

## FHE Encryption Flow

1. User enters order parameters (amount, price, risk score)
2. `@zama-fhe/relayer-sdk` encrypts values via `createEncryptedInput().add64()`
3. SDK generates ZK input proof and submits to Zama relayer
4. `placeEncryptedOrder()` is called with `handles[]` + `inputProof`
5. MatchingEngine performs homomorphic comparison via `TFHE.ge()`
6. Settlement triggers `Gateway.requestDecryption()` for matched orders
7. Plaintext revealed only to matched counterparties

## Security Checklist

- [x] ACL correctly set on encrypted values (owner-only decrypt)
- [x] No reentrancy vectors in settlement flow
- [x] Decrypt rights granted only to authorized parties
- [x] Zero plaintext exposure on-chain
- [x] Input proof verification via InputVerifier contract
- [x] Gateway async decrypt pattern for settlement

## Links

- [Live Dashboard (Vercel)](https://cipherrwa-darkpool.vercel.app)
- [Demo Video (YouTube)]()
- [Zama Developer Program](https://forms.zama.org/developer-program-mainnet-season2-builder-track)

## License

MIT
