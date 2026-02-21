# Uniswap API Research

## API Base URL
`https://trade-api.gateway.uniswap.org/v1`

## Auth
Header: `x-api-key: <API_KEY>` from Developer Portal

## Swap Flow (3 steps)
1. **check_approval** POST `/check_approval`
   - walletAddress, amount, token, chainId, tokenOut, tokenOutChainId
   - Returns approval tx if needed

2. **quote** POST `/quote`
   - swapper, tokenInChainId, tokenOutChainId, tokenIn, tokenOut, amount
   - routingPreference, type: "EXACT_INPUT"
   - Returns: quote, permitData, routing

3. **swap or order** depending on routing:
   - CLASSIC/WRAP/UNWRAP/BRIDGE → POST `/swap` (gasful)
   - DUTCH_V2/DUTCH_V3/PRIORITY → POST `/order` (gasless, UniswapX)

## For Token Arena
- Agents swap ARENA → ETH on Base chain
- Base chain ID: 8453 (mainnet), 84532 (Base Sepolia)
- For demo: simulate the API calls with realistic data
- For real: need Uniswap API key + ARENA token deployed on Uniswap pool

## Integration Plan
- Create uniswapService.ts with quote + swap functions
- For hackathon demo: use real API for quote (shows real prices), simulate execution
- Log all swaps in x402_transactions
- Wire into flywheel: agent earns ARENA → swaps via Uniswap → gets ETH → buys compute
