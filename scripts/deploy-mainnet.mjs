/**
 * Deploy all Token Arena contracts to Base Mainnet
 * Uses viem for deployment with ERC-8021 builder code attribution
 * 
 * Contracts: ARENA, PLAS, RAIL, SCAT, RCKT, BEAM, VOID, PredictionMarket, TokenArenaDAO
 */
import { createPublicClient, createWalletClient, http, parseEther, encodeDeployData, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { readFileSync, writeFileSync } from 'fs';

// ─── Config ─────────────────────────────────────────────────────────────────
// SECURITY: Never hardcode private keys. Use environment variable:
// DEPLOYER_PRIVATE_KEY=0x... node scripts/deploy-mainnet.mjs
const DEPLOYER_PK = process.env.DEPLOYER_PRIVATE_KEY;
if (!DEPLOYER_PK) {
  console.error('❌ DEPLOYER_PRIVATE_KEY environment variable not set');
  console.error('Usage: DEPLOYER_PRIVATE_KEY=0x... node scripts/deploy-mainnet.mjs');
  process.exit(1);
}
const RPC_URL = 'https://mainnet.base.org';
const DEPLOYER_ADDRESS = '0x0b923f3Cfa9ad1D926bDce8Fd1494534d4DA27B3';

// ERC-8021 Builder Code Attribution Suffix
// Format: 0x + length_byte + "tokenarena" as hex + padding with 8021 repeating
// Per the spec, the suffix is: <code_bytes> + 8021 padding to fill 16 bytes
// Using the ox/erc8021 format: 0x + code_length(1byte) + code_hex + 0080218021802180218021802180218021
// For "tokenarena" (10 chars): 0x0a746f6b656e6172656e610080218021802180218021
// Simplified: just append the hex suffix to transaction data
const BUILDER_CODE = 'tokenarena';
const BUILDER_CODE_HEX = Buffer.from(BUILDER_CODE).toString('hex');
// ERC-8021 suffix format: 0x + length_prefix + code_hex + 00 + 8021 repeating padding
const ERC8021_SUFFIX = '0x' + BUILDER_CODE_HEX.length.toString(16).padStart(2, '0') + BUILDER_CODE_HEX + '00' + '8021'.repeat(8);

console.log('ERC-8021 Builder Code Suffix:', ERC8021_SUFFIX);

// ─── Setup ──────────────────────────────────────────────────────────────────
const account = privateKeyToAccount(DEPLOYER_PK);
const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
const walletClient = createWalletClient({ chain: base, transport: http(RPC_URL), account });

// ─── Load Artifacts ─────────────────────────────────────────────────────────
function loadArtifact(name) {
  const paths = [
    `artifacts/contracts/${name}.sol/${name}.json`,
  ];
  for (const p of paths) {
    try {
      const data = JSON.parse(readFileSync(p, 'utf8'));
      return { abi: data.abi, bytecode: data.bytecode };
    } catch (e) { continue; }
  }
  throw new Error(`Cannot find artifact for ${name}`);
}

const ArenaToken = loadArtifact('ArenaToken');
const WeaponToken = loadArtifact('WeaponToken');
const PredictionMarket = loadArtifact('PredictionMarket');
const TokenArenaDAO = loadArtifact('TokenArenaDAO');

// ─── Deploy Helper ──────────────────────────────────────────────────────────
async function deployContract(name, artifact, constructorArgs = []) {
  console.log(`\n🚀 Deploying ${name}...`);
  
  const deployData = encodeDeployData({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: constructorArgs,
  });
  
  // Append ERC-8021 builder code suffix to deployment data
  const dataWithAttribution = deployData + ERC8021_SUFFIX.slice(2); // remove 0x prefix from suffix
  
  // Estimate gas
  const gasEstimate = await publicClient.estimateGas({
    account: account.address,
    data: dataWithAttribution,
  });
  console.log(`  Gas estimate: ${gasEstimate}`);
  
  // Get current gas price
  const gasPrice = await publicClient.getGasPrice();
  const gasCost = formatEther(gasEstimate * gasPrice);
  console.log(`  Estimated cost: ${gasCost} ETH (gas price: ${gasPrice} wei)`);
  
  // Send deployment transaction
  const hash = await walletClient.sendTransaction({
    data: dataWithAttribution,
    gas: gasEstimate + (gasEstimate / 10n), // 10% buffer
  });
  console.log(`  Tx hash: ${hash}`);
  
  // Wait for receipt
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
  console.log(`  ✅ ${name} deployed at: ${receipt.contractAddress}`);
  console.log(`  Block: ${receipt.blockNumber}, Gas used: ${receipt.gasUsed}`);
  
  return { address: receipt.contractAddress, txHash: hash, gasUsed: receipt.gasUsed };
}

// ─── Main Deployment ────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  TOKEN ARENA — Base Mainnet Deployment');
  console.log('  Chain: Base (8453)');
  console.log('  Deployer:', DEPLOYER_ADDRESS);
  console.log('  Builder Code: tokenarena (ERC-8021)');
  console.log('═══════════════════════════════════════════════════');
  
  const balance = await publicClient.getBalance({ address: DEPLOYER_ADDRESS });
  console.log(`\nDeployer balance: ${formatEther(balance)} ETH`);
  
  if (balance < parseEther('0.005')) {
    console.error('❌ Insufficient balance for deployment');
    process.exit(1);
  }
  
  const results = {};
  const txHashes = {};
  
  // 1. Deploy ARENA Token
  const arena = await deployContract('ArenaToken (ARENA)', ArenaToken, [DEPLOYER_ADDRESS]);
  results.ARENA = arena.address;
  txHashes.ARENA = arena.txHash;
  
  // 2. Deploy Weapon Tokens
  const weapons = [
    { symbol: 'PLAS', name: 'Plasma Ammo Token', type: 'plasma', supply: '100000000' },
    { symbol: 'RAIL', name: 'Railgun Ammo Token', type: 'railgun', supply: '50000000' },
    { symbol: 'SCAT', name: 'Scatter Ammo Token', type: 'scatter', supply: '75000000' },
    { symbol: 'RCKT', name: 'Rocket Ammo Token', type: 'rocket', supply: '25000000' },
    { symbol: 'BEAM', name: 'Beam Ammo Token', type: 'beam', supply: '100000000' },
    { symbol: 'VOID', name: 'Void Ammo Token', type: 'void', supply: '30000000' },
  ];
  
  for (const w of weapons) {
    const maxSupply = parseEther(w.supply);
    const result = await deployContract(
      `WeaponToken (${w.symbol})`,
      WeaponToken,
      [w.name, w.symbol, w.type, maxSupply, DEPLOYER_ADDRESS]
    );
    results[w.symbol] = result.address;
    txHashes[w.symbol] = result.txHash;
  }
  
  // 3. Deploy PredictionMarket (needs arenaToken + daoTreasury)
  const pm = await deployContract('PredictionMarket', PredictionMarket, [results.ARENA, DEPLOYER_ADDRESS]);
  results.PredictionMarket = pm.address;
  txHashes.PredictionMarket = pm.txHash;
  
  // 4. Deploy TokenArenaDAO (needs ARENA token address)
  const dao = await deployContract('TokenArenaDAO', TokenArenaDAO, [results.ARENA]);
  results.TokenArenaDAO = dao.address;
  txHashes.TokenArenaDAO = dao.txHash;
  
  // ─── Save Results ───────────────────────────────────────────────────────
  const deploymentData = {
    network: 'base-mainnet',
    chainId: 8453,
    deployer: DEPLOYER_ADDRESS,
    builderCode: 'tokenarena',
    erc8021Suffix: ERC8021_SUFFIX,
    deployedAt: new Date().toISOString(),
    contracts: results,
    txHashes: txHashes,
    verification: {
      basescan: `https://basescan.org/address/${results.ARENA}`,
      note: 'All contracts deployed with ERC-8021 builder code attribution'
    }
  };
  
  writeFileSync('shared/mainnet-contracts.json', JSON.stringify(deploymentData, null, 2));
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  DEPLOYMENT COMPLETE');
  console.log('═══════════════════════════════════════════════════');
  console.log(JSON.stringify(deploymentData, null, 2));
  
  // Check remaining balance
  const remainingBalance = await publicClient.getBalance({ address: DEPLOYER_ADDRESS });
  console.log(`\nRemaining balance: ${formatEther(remainingBalance)} ETH`);
  console.log(`Total spent: ${formatEther(balance - remainingBalance)} ETH`);
}

main().catch(err => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
