# ERC-8021 Builder Codes Research

## Key Facts
- Builder Codes are ERC-721 NFTs with unique codes (e.g. "bc_b7k3p9da")
- Register on base.dev → Settings → Builder Code
- The suffix is appended to transaction calldata (no contract changes needed)
- Smart contracts execute normally and ignore the extra data
- Attribution is extracted by offchain indexers after the fact
- Negligible gas cost: 16 gas per non-zero byte

## Integration (Server-side with viem)
```ts
import { Attribution } from "ox/erc8021";

const DATA_SUFFIX = Attribution.toDataSuffix({
  codes: ["YOUR-BUILDER-CODE"],
});

// Option 1: Client-level (all txs get suffix)
const walletClient = createWalletClient({
  chain: base,
  transport: http(),
  dataSuffix: DATA_SUFFIX,
});

// Option 2: Per-transaction
const hash = await walletClient.sendTransaction({
  to: "0x...",
  value: parseEther("0.01"),
  dataSuffix: DATA_SUFFIX,
});
```

## Dependencies
- viem >= 2.45.0
- ox (for Attribution.toDataSuffix)

## Verification
1. Check base.dev → Onchain → Total Transactions
2. Block explorer: input data last 16 bytes are `8021` repeating
3. Builder Code Validation tool

## For Token Arena
- Need to register on base.dev first to get a builder code
- Then integrate dataSuffix into all contract deployment and interaction transactions
- Works with both EOAs and smart contract wallets
