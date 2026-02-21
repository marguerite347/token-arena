# DeployBuilderCodes.s.sol Notes

## Production addresses from script:
- owner = 0xa12579F2DD32ea03035692cc5DBA1DCa5f614271
- initialRegistrar = address(0) (no initial registrar in production)

## The contract uses:
- ERC1967Proxy pattern (UUPS upgradeable)
- Salt for deterministic deployment: 0x8ace9ca5472a45afce9af1f68f915cd3b719b3f543ee88ca8feea089b8bbf03c

## Key: register() requires REGISTER_ROLE
- Only owner or addresses with REGISTER_ROLE can register codes
- We CANNOT call register() directly - need to go through base.dev or an authorized registrar

## Alternative approach for ERC-8021:
- We don't need to mint a builder code NFT ourselves
- We can manually construct the ERC-8021 data suffix
- Format: builder code encoded as hex + 8021 padding
- OR use ox library: Attribution.toDataSuffix({ codes: ["tokenarena"] })
