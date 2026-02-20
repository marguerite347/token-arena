#!/usr/bin/env node
/**
 * Token Arena — Deploy remaining weapon tokens to Base Sepolia
 * ARENA already deployed at nonce 0. This deploys the 6 weapon tokens.
 */
import { ethers } from "ethers";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
const CHAIN_ID = 84532;

const ARENA_ADDRESS = "0x9DB281D2243ea30577783ab3364873E3F0a02610";

const WEAPON_CONFIGS = [
  { symbol: "PLAS", name: "Plasma Ammo", type: "plasma", maxSupply: "100000000" },
  { symbol: "RAIL", name: "Railgun Ammo", type: "railgun", maxSupply: "50000000" },
  { symbol: "SCAT", name: "Scatter Ammo", type: "scatter", maxSupply: "200000000" },
  { symbol: "RCKT", name: "Rocket Ammo", type: "missile", maxSupply: "25000000" },
  { symbol: "BEAM", name: "Beam Ammo", type: "beam", maxSupply: "75000000" },
  { symbol: "VOID", name: "Void Ammo", type: "nova", maxSupply: "10000000" },
];

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Missing DEPLOYER_PRIVATE_KEY");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC, CHAIN_ID);
  const wallet = new ethers.Wallet(privateKey, provider);
  const deployer = wallet.address;

  console.log(`\nDeployer: ${deployer}`);
  const balance = await provider.getBalance(deployer);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  let nonce = await provider.getTransactionCount(deployer, "pending");
  console.log(`Starting nonce: ${nonce}`);

  // Load compiled artifacts
  const weaponArtifact = JSON.parse(
    readFileSync(path.join(ROOT, "artifacts/contracts/WeaponToken.sol/WeaponToken.json"), "utf-8")
  );

  const contracts = { ARENA: ARENA_ADDRESS };
  const txHashes = {};

  // Get current fee data for proper gas pricing
  const feeData = await provider.getFeeData();
  console.log(`Gas price: ${ethers.formatUnits(feeData.gasPrice || 0n, "gwei")} gwei`);
  console.log(`Max fee: ${ethers.formatUnits(feeData.maxFeePerGas || 0n, "gwei")} gwei`);

  for (const weapon of WEAPON_CONFIGS) {
    console.log(`\nDeploying ${weapon.name} (${weapon.symbol}) at nonce ${nonce}...`);
    
    try {
      const WeaponFactory = new ethers.ContractFactory(
        weaponArtifact.abi,
        weaponArtifact.bytecode,
        wallet
      );

      const token = await WeaponFactory.deploy(
        weapon.name,
        weapon.symbol,
        weapon.type,
        ethers.parseEther(weapon.maxSupply),
        deployer,
        { nonce }
      );

      console.log(`   TX sent: ${token.deploymentTransaction()?.hash}`);
      console.log(`   Waiting for confirmation...`);
      
      await token.waitForDeployment();
      const addr = await token.getAddress();
      
      contracts[weapon.symbol] = addr;
      txHashes[weapon.symbol] = token.deploymentTransaction()?.hash;
      console.log(`   ${weapon.symbol} deployed: ${addr}`);
      
      nonce++;

      // Small delay between deployments
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`   FAILED: ${err.message}`);
      
      // Check if contract was deployed despite error
      const expectedAddr = ethers.getCreateAddress({ from: deployer, nonce });
      const code = await provider.getCode(expectedAddr);
      if (code.length > 2) {
        console.log(`   But contract exists at ${expectedAddr}! Continuing...`);
        contracts[weapon.symbol] = expectedAddr;
        nonce++;
      } else {
        console.error(`   Stopping deployment. Remaining contracts not deployed.`);
        break;
      }
    }
  }

  // Generate agent wallets
  const agentWallets = {};
  for (let i = 1; i <= 8; i++) {
    const agentWallet = ethers.Wallet.createRandom();
    agentWallets[`agent-${i}`] = agentWallet.address;
  }

  // Write deployed-contracts.json
  const deployData = {
    network: "base-sepolia",
    chainId: CHAIN_ID,
    deployer,
    deployedAt: new Date().toISOString(),
    contracts,
    txHashes,
    agentWallets,
    verification: {
      basescan: `https://sepolia.basescan.org/address/${ARENA_ADDRESS}`,
      note: "Verify with: npx hardhat verify --network base-sepolia <address> <constructor-args>",
    },
  };

  const outPath = path.join(ROOT, "shared/deployed-contracts.json");
  writeFileSync(outPath, JSON.stringify(deployData, null, 2));
  console.log(`\nWritten to ${outPath}`);

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  TOKEN ARENA — Base Sepolia Deployment");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Network:  Base Sepolia (Chain ID ${CHAIN_ID})`);
  console.log(`  Deployer: ${deployer}`);
  for (const [sym, addr] of Object.entries(contracts)) {
    console.log(`  ${sym.padEnd(8)}  ${addr}`);
  }
  console.log("═══════════════════════════════════════════════════════");
  
  const finalBalance = await provider.getBalance(deployer);
  console.log(`\nFinal balance: ${ethers.formatEther(finalBalance)} ETH`);
  console.log(`Gas spent: ${ethers.formatEther(balance - finalBalance)} ETH`);
  
  const deployed = Object.keys(contracts).length;
  console.log(`\n${deployed}/7 contracts deployed!`);
}

main().catch((err) => {
  console.error("Deployment failed:", err.message);
  process.exit(1);
});
