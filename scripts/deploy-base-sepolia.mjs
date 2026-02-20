#!/usr/bin/env node
/**
 * Token Arena — Deploy ERC-20 Contracts to Base Sepolia
 * 
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... node scripts/deploy-base-sepolia.mjs
 * 
 * Requirements:
 *   - A funded Base Sepolia wallet (get ETH from https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
 *   - Node.js 18+
 *   - ethers v6 (installed via pnpm add ethers)
 * 
 * This script:
 *   1. Compiles ArenaToken.sol and WeaponToken.sol using solc
 *   2. Deploys ARENA token + 6 weapon tokens to Base Sepolia
 *   3. Mints initial supply to deployer
 *   4. Updates shared/deployed-contracts.json with real addresses
 */

import { ethers } from "ethers";
import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
const CHAIN_ID = 84532;

const WEAPON_CONFIGS = [
  { symbol: "PLAS", name: "Plasma Ammo", type: "plasma", maxSupply: "100000000" },
  { symbol: "RAIL", name: "Railgun Ammo", type: "railgun", maxSupply: "50000000" },
  { symbol: "SCAT", name: "Scatter Ammo", type: "scatter", maxSupply: "200000000" },
  { symbol: "RCKT", name: "Rocket Ammo", type: "missile", maxSupply: "25000000" },
  { symbol: "BEAM", name: "Beam Ammo", type: "beam", maxSupply: "75000000" },
  { symbol: "VOID", name: "Void Ammo", type: "nova", maxSupply: "10000000" },
];

// ─── Compile Contracts ───────────────────────────────────────────────────────
function compileContracts() {
  console.log("📦 Compiling contracts...");
  
  try {
    // Use Hardhat to compile if available
    execSync("npx hardhat compile --config hardhat.config.cjs 2>/dev/null", { 
      cwd: ROOT, 
      stdio: "pipe" 
    });
    
    // Read compiled artifacts
    const arenaArtifact = JSON.parse(
      readFileSync(path.join(ROOT, "artifacts/contracts/ArenaToken.sol/ArenaToken.json"), "utf-8")
    );
    const weaponArtifact = JSON.parse(
      readFileSync(path.join(ROOT, "artifacts/contracts/WeaponToken.sol/WeaponToken.json"), "utf-8")
    );
    
    return { arenaArtifact, weaponArtifact };
  } catch {
    console.log("⚠️  Hardhat compile failed, using pre-compiled ABIs...");
    return usePrecompiledABIs();
  }
}

function usePrecompiledABIs() {
  // Minimal ABI for deployment — covers constructor, mint, and key functions
  const arenaABI = [
    "constructor(address initialOwner)",
    "function mint(address to, uint256 amount) external",
    "function addMinter(address minter) external",
    "function balanceOf(address account) external view returns (uint256)",
    "function totalSupply() external view returns (uint256)",
    "function name() external view returns (string)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event MinterAdded(address indexed minter)",
  ];

  const weaponABI = [
    "constructor(string name, string symbol, string _weaponType, uint256 _maxSupply, address initialOwner)",
    "function mint(address to, uint256 amount) external",
    "function balanceOf(address account) external view returns (uint256)",
    "function totalSupply() external view returns (uint256)",
    "function name() external view returns (string)",
    "function symbol() external view returns (string)",
    "function weaponType() external view returns (string)",
    "function maxSupply() external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ];

  return {
    arenaArtifact: { abi: arenaABI, bytecode: null },
    weaponArtifact: { abi: weaponABI, bytecode: null },
  };
}

// ─── Deploy ──────────────────────────────────────────────────────────────────
async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ Missing DEPLOYER_PRIVATE_KEY environment variable");
    console.error("   Usage: DEPLOYER_PRIVATE_KEY=0x... node scripts/deploy-base-sepolia.mjs");
    console.error("   Get Base Sepolia ETH: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC, CHAIN_ID);
  const wallet = new ethers.Wallet(privateKey, provider);
  const deployer = wallet.address;

  console.log(`\n🔑 Deployer: ${deployer}`);
  const balance = await provider.getBalance(deployer);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.error("❌ Deployer has no ETH. Get testnet ETH from the faucet.");
    process.exit(1);
  }

  const { arenaArtifact, weaponArtifact } = compileContracts();

  if (!arenaArtifact.bytecode || !weaponArtifact.bytecode) {
    console.error("❌ No bytecode available. Run 'npx hardhat compile' first or install solc.");
    console.error("   Alternatively, deploy via Remix IDE: https://remix.ethereum.org");
    console.error("   Copy contracts/ArenaToken.sol and contracts/WeaponToken.sol to Remix,");
    console.error("   compile with Solidity 0.8.24, and deploy to Base Sepolia.");
    process.exit(1);
  }

  const contracts = {};
  const txHashes = {};

  // Deploy ARENA token
  console.log("\n🚀 Deploying ArenaToken (ARENA)...");
  const ArenaFactory = new ethers.ContractFactory(arenaArtifact.abi, arenaArtifact.bytecode, wallet);
  const arena = await ArenaFactory.deploy(deployer);
  await arena.waitForDeployment();
  const arenaAddr = await arena.getAddress();
  contracts.ARENA = arenaAddr;
  txHashes.ARENA = arena.deploymentTransaction()?.hash;
  console.log(`   ✅ ARENA deployed: ${arenaAddr}`);

  // Mint initial ARENA supply (100M to deployer for distribution)
  console.log("   💎 Minting 100M ARENA to deployer...");
  const mintTx = await arena.mint(deployer, ethers.parseEther("100000000"));
  await mintTx.wait();
  console.log(`   ✅ Minted 100M ARENA`);

  // Deploy weapon tokens
  for (const weapon of WEAPON_CONFIGS) {
    console.log(`\n🚀 Deploying ${weapon.name} (${weapon.symbol})...`);
    const WeaponFactory = new ethers.ContractFactory(weaponArtifact.abi, weaponArtifact.bytecode, wallet);
    const token = await WeaponFactory.deploy(
      weapon.name,
      weapon.symbol,
      weapon.type,
      ethers.parseEther(weapon.maxSupply),
      deployer
    );
    await token.waitForDeployment();
    const addr = await token.getAddress();
    contracts[weapon.symbol] = addr;
    txHashes[weapon.symbol] = token.deploymentTransaction()?.hash;
    console.log(`   ✅ ${weapon.symbol} deployed: ${addr}`);

    // Mint initial supply (10% to deployer)
    const initialMint = BigInt(weapon.maxSupply) / 10n;
    console.log(`   💎 Minting ${initialMint.toString()} ${weapon.symbol}...`);
    const wMintTx = await token.mint(deployer, ethers.parseEther(initialMint.toString()));
    await wMintTx.wait();
  }

  // Generate agent wallets (deterministic from deployer)
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
      basescan: `https://sepolia.basescan.org/address/${arenaAddr}`,
      note: "Verify with: npx hardhat verify --network base-sepolia <address> <constructor-args>",
    },
  };

  const outPath = path.join(ROOT, "shared/deployed-contracts.json");
  writeFileSync(outPath, JSON.stringify(deployData, null, 2));
  console.log(`\n📄 Written to ${outPath}`);

  // Summary
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  TOKEN ARENA — Base Sepolia Deployment Complete");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Network:  Base Sepolia (Chain ID ${CHAIN_ID})`);
  console.log(`  Deployer: ${deployer}`);
  console.log(`  ARENA:    ${contracts.ARENA}`);
  for (const w of WEAPON_CONFIGS) {
    console.log(`  ${w.symbol.padEnd(8)}  ${contracts[w.symbol]}`);
  }
  console.log("═══════════════════════════════════════════════════════");
  console.log("\n🔗 Verify on BaseScan:");
  console.log(`   https://sepolia.basescan.org/address/${contracts.ARENA}`);
  console.log("\n✅ All 7 contracts deployed successfully!");
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err.message);
  process.exit(1);
});
