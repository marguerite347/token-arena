/**
 * Deploy remaining contracts (PredictionMarket + TokenArenaDAO) to Base Mainnet
 * ARENA + 6 weapon tokens already deployed.
 */
import { createPublicClient, createWalletClient, http, encodeDeployData, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { readFileSync, writeFileSync } from 'fs';

// SECURITY: Never hardcode private keys. Use environment variable:
// DEPLOYER_PRIVATE_KEY=0x... node scripts/deploy-mainnet-remaining.mjs
const DEPLOYER_PK = process.env.DEPLOYER_PRIVATE_KEY;
if (!DEPLOYER_PK) {
  console.error('❌ DEPLOYER_PRIVATE_KEY environment variable not set');
  process.exit(1);
}
const RPC_URL = 'https://mainnet.base.org';
const DEPLOYER_ADDRESS = '0x0b923f3Cfa9ad1D926bDce8Fd1494534d4DA27B3';
const ARENA_ADDRESS = '0x50ed7aebbcfdae85cea0d5860109ef98b2225a6b';

// ERC-8021 Builder Code Attribution
const BUILDER_CODE_HEX = Buffer.from('tokenarena').toString('hex');
const ERC8021_SUFFIX = BUILDER_CODE_HEX.length.toString(16).padStart(2, '0') + BUILDER_CODE_HEX + '00' + '8021'.repeat(8);

const account = privateKeyToAccount(DEPLOYER_PK);
const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
const walletClient = createWalletClient({ chain: base, transport: http(RPC_URL), account });

function loadArtifact(name) {
  return JSON.parse(readFileSync(`artifacts/contracts/${name}.sol/${name}.json`, 'utf8'));
}

async function deployContract(name, artifact, constructorArgs = []) {
  console.log(`\n🚀 Deploying ${name}...`);
  const deployData = encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode, args: constructorArgs });
  const dataWithAttribution = deployData + ERC8021_SUFFIX;
  
  const gasEstimate = await publicClient.estimateGas({ account: account.address, data: dataWithAttribution });
  console.log(`  Gas estimate: ${gasEstimate}`);
  
  const hash = await walletClient.sendTransaction({ data: dataWithAttribution, gas: gasEstimate + (gasEstimate / 10n) });
  console.log(`  Tx hash: ${hash}`);
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
  console.log(`  ✅ ${name} deployed at: ${receipt.contractAddress}`);
  return { address: receipt.contractAddress, txHash: hash };
}

async function main() {
  console.log('Deploying PredictionMarket + TokenArenaDAO to Base Mainnet...');
  const balance = await publicClient.getBalance({ address: DEPLOYER_ADDRESS });
  console.log(`Balance: ${formatEther(balance)} ETH`);
  
  const pm = await deployContract('PredictionMarket', loadArtifact('PredictionMarket'), [ARENA_ADDRESS, DEPLOYER_ADDRESS]);
  const dao = await deployContract('TokenArenaDAO', loadArtifact('TokenArenaDAO'), [ARENA_ADDRESS]);
  
  const deploymentData = {
    network: 'base-mainnet',
    chainId: 8453,
    deployer: DEPLOYER_ADDRESS,
    builderCode: 'tokenarena',
    erc8021Suffix: '0x' + ERC8021_SUFFIX,
    deployedAt: new Date().toISOString(),
    contracts: {
      ARENA: ARENA_ADDRESS,
      PLAS: '0x0cb7b046b5a1ba636b1cfe9596dbdb356936d99d',
      RAIL: '0xcf84590c752de7fd648cf28447a4a4a68a87791c',
      SCAT: '0x418355cdec41f5b7aefc34c4b7368a43f59f43d5',
      RCKT: '0x085c234387bad266875b1dfdbd7df2132ec52263',
      BEAM: '0x76821c1b2c69545ce9c105c41734ea16ea386d94',
      VOID: '0x4afb5bbe53dad291da351ae6ab66230af882f912',
      PredictionMarket: pm.address,
      TokenArenaDAO: dao.address,
    },
    txHashes: {
      ARENA: '0xaac3b3394afe6f574ec88701730fd9e6c5517f9e376d6effc60122f4170f338b',
      PLAS: '0x127d2cd407db65ad4e8e2dd920491b3f504c067106bcf5fcfd211766a213d927',
      RAIL: '0xcb524d02cabdb8adb0ba37496662e1ced16c2f1bd5cb334770d09126ca6ecaa1',
      SCAT: '0x2cce7c1f0e3c457aef88eecc368993f6ac2a4b2f1f3dc46e56e97fd55fa425b0',
      RCKT: '0x331a26495090f4d11fbeb06197eb8cd43b4657a436db24e25a588135ab78f1a7',
      BEAM: '0x3927590f093f0a8ffd1d97d2a1ea8a61819da5acaee7a43956df61ae25720df8',
      VOID: '0xd312548dddfd4d44b99739ff94318e22b8f41973d90d6de2541feabbdd831d01',
      PredictionMarket: pm.txHash,
      TokenArenaDAO: dao.txHash,
    },
    verification: {
      basescan: `https://basescan.org/address/${ARENA_ADDRESS}`,
      note: 'All 9 contracts deployed with ERC-8021 builder code attribution (tokenarena)'
    }
  };
  
  writeFileSync('shared/mainnet-contracts.json', JSON.stringify(deploymentData, null, 2));
  console.log('\n✅ ALL 9 CONTRACTS DEPLOYED!');
  console.log(JSON.stringify(deploymentData, null, 2));
  
  const remaining = await publicClient.getBalance({ address: DEPLOYER_ADDRESS });
  console.log(`\nRemaining: ${formatEther(remaining)} ETH`);
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
