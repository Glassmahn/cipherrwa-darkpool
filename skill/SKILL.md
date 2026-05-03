# SKILL.md — CipherRWA AI Agent

## name
CipherRWA Encrypted Order Agent

## description
An AI agent that generates fully homomorphic encrypted RWA orders for the CipherRWA Dark Pool. Accepts natural language trading instructions and outputs encrypted handles, ZK proofs, and contract-ready transaction payloads for confidential placement of cTBILL, cREAL, and cCARBON orders on Sepolia via Zama FHEVM.

## contractAddresses
- DarkPool: `0x855dA715F3182f9A105343c91F80ba1B435BfD31`
- RWA Token: `0xd38489433B393F80281f5F59Abd9B82CCacE6194`
- MatchingEngine: `0xEE66574d63535a344A0b044734fC2Ec0Be2a933d`
- Network: Sepolia (Chain ID 11155111)

## examplePrompts
- "Place a buy order for 50,000 cTBILL at $9.85 per token with risk score 20"
- "Sell 100,000 cREAL at market price with risk score 45"
- "What encrypted handles are generated for a cCARBON order of 250,000 at $12.40?"
- "Show me the FHE encryption flow for placing a confidential dark pool order"
- "Calculate the TWAP-adjusted price for cTBILL given the last 10 observations"

## fhePatterns
- **euint64 Order Amount**: `TFHE.asEuint64(amount)` — encrypts trade size as 64-bit unsigned integer
- **euint64 Order Price**: `TFHE.asEuint64(price * 1e6)` — fixed-point encrypted price with 6 decimals
- **euint64 Risk Score**: `TFHE.asEuint64(riskScore)` — encrypted compliance risk (0-100)
- **Homomorphic Comparison**: `TFHE.ge(buyPrice, sellPrice)` — matches orders without decryption
- **ACL Allow**: `TFHE.allow(handle, trader)` — grants decryption permission to order owner
- **Transient Allow**: `TFHE.allowTransient(handle, matchingEngine)` — temporary matching access
- **Gateway Decrypt**: `Gateway.requestDecryption(handles, callback)` — async settlement decrypt
- **Input Proof**: `createEncryptedInput().add64(value).encrypt()` → `{ handles, inputProof }`

## apiEndpoints
- `placeEncryptedOrder(bytes32[] handles, bytes inputProof, address rwaToken, uint8 side)` — DarkPool entry point
- `getTraderOrders(address trader)` — returns order IDs for a given address
- `getOrderMeta(uint256 orderId)` — returns non-encrypted metadata (side, status, timestamp)
- `cancelOrder(uint256 orderId)` — cancels an open order
- `requestSettlement(uint256 orderId)` — triggers Gateway decrypt for matched orders
