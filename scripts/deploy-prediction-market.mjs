#!/usr/bin/env node
/**
 * Deploy PredictionMarket contract to Base Sepolia
 * Uses the compiled artifact from artifacts/contracts/PredictionMarket.sol/
 * Constructor args: (arenaToken, daoTreasury)
 *   - arenaToken = deployed ARENA ERC-20 address
 *   - daoTreasury = deployer address (owner) acts as treasury initially
 */
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error("DEPLOYER_PRIVATE_KEY env var required");
  process.exit(1);
}

const RPC_URL = "https://sepolia.base.org";
const ARENA_TOKEN = "0x9DB281D2243ea30577783ab3364873E3F0a02610";
// DAO treasury = deployer for now; can be updated via setDaoTreasury()
const DAO_TREASURY = "0x0b923f3Cfa9ad1D926bDce8Fd1494534d4DA27B3";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  // Load artifact
  const artifactPath = path.join(ROOT, "artifacts/contracts/PredictionMarket.sol/PredictionMarket.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));

  console.log(`\nDeploying PredictionMarket...`);
  console.log(`  ARENA token: ${ARENA_TOKEN}`);
  console.log(`  DAO treasury: ${DAO_TREASURY}`);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ? feeData.gasPrice * 120n / 100n : ethers.parseUnits("0.1", "gwei");

  const contract = await factory.deploy(ARENA_TOKEN, DAO_TREASURY, { gasPrice });
  console.log(`  Tx hash: ${contract.deploymentTransaction()?.hash}`);
  console.log(`  Waiting for confirmation...`);

  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`  ✅ PredictionMarket deployed at: ${address}`);

  // Update deployed-contracts.json
  const contractsPath = path.join(ROOT, "shared/deployed-contracts.json");
  const contracts = JSON.parse(fs.readFileSync(contractsPath, "utf-8"));
  contracts.contracts["PredictionMarket"] = address;
  contracts.txHashes["PredictionMarket"] = contract.deploymentTransaction()?.hash || "";
  contracts.deployedAt = new Date().toISOString();
  fs.writeFileSync(contractsPath, JSON.stringify(contracts, null, 2));
  console.log(`\n✅ deployed-contracts.json updated`);
  console.log(`\nView on BaseScan: https://sepolia.basescan.org/address/${address}`);
}

main().catch(e => { console.error(e); process.exit(1); });
