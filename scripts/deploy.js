const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying Token Arena contracts to Base Sepolia...");

  const [deployer] = await hre.ethers.getSigners();
  console.log(`📝 Deployer: ${deployer.address}`);

  const deployedContracts = {
    network: "base-sepolia",
    chainId: 84532,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {},
    agentWallets: {},
  };

  // ─── Deploy ARENA Token ───────────────────────────────────────────────────
  console.log("\n📦 Deploying ARENA token...");
  const ArenaToken = await hre.ethers.getContractFactory("ArenaToken");
  const arenaToken = await ArenaToken.deploy(deployer.address);
  await arenaToken.deployed();
  deployedContracts.contracts.ARENA = arenaToken.address;
  console.log(`✓ ARENA deployed: ${arenaToken.address}`);

  // ─── Deploy Weapon Tokens ─────────────────────────────────────────────────
  const weapons = [
    { symbol: "PLAS", name: "Plasma Ammo Token", type: "Plasma", supply: "100000000" },
    { symbol: "RAIL", name: "Railgun Ammo Token", type: "Railgun", supply: "50000000" },
    { symbol: "SCAT", name: "Scatter Ammo Token", type: "Scatter", supply: "75000000" },
    { symbol: "RCKT", name: "Rocket Ammo Token", type: "Rocket", supply: "25000000" },
    { symbol: "BEAM", name: "Beam Ammo Token", type: "Beam", supply: "100000000" },
    { symbol: "VOID", name: "Void Ammo Token", type: "Void", supply: "30000000" },
  ];

  const WeaponToken = await hre.ethers.getContractFactory("WeaponToken");

  for (const weapon of weapons) {
    console.log(`\n📦 Deploying ${weapon.symbol}...`);
    const maxSupply = hre.ethers.utils.parseEther(weapon.supply);
    const token = await WeaponToken.deploy(
      weapon.name,
      weapon.symbol,
      weapon.type,
      maxSupply,
      deployer.address
    );
    await token.deployed();
    deployedContracts.contracts[weapon.symbol] = token.address;
    console.log(`✓ ${weapon.symbol} deployed: ${token.address}`);
  }

  // ─── Generate Agent Smart Wallets ─────────────────────────────────────────
  // For now, we'll use deterministic addresses based on agent IDs
  // In production, these would be ERC-4337 smart contract wallets
  console.log("\n🤖 Generating agent smart wallet addresses...");
  const agents = [
    { id: 1, name: "NEXUS-7" },
    { id: 2, name: "PHANTOM" },
    { id: 3, name: "TITAN" },
    { id: 4, name: "CIPHER" },
    { id: 5, name: "AURORA" },
    { id: 6, name: "WRAITH" },
  ];

  for (const agent of agents) {
    // Deterministic wallet address based on agent ID
    const walletAddress = "0x" + agent.id.toString().padStart(40, "A");
    deployedContracts.agentWallets[`agent-${agent.id}`] = walletAddress;
    console.log(`✓ Agent ${agent.name}: ${walletAddress}`);
  }

  // ─── Save Deployment Info ─────────────────────────────────────────────────
  const outputPath = path.join(__dirname, "../shared/deployed-contracts.json");
  fs.writeFileSync(outputPath, JSON.stringify(deployedContracts, null, 2));
  console.log(`\n✅ Deployment complete! Saved to ${outputPath}`);

  // ─── Display Summary ──────────────────────────────────────────────────────
  console.log("\n📊 Deployment Summary:");
  console.log(`  ARENA: ${deployedContracts.contracts.ARENA}`);
  console.log(`  PLAS:  ${deployedContracts.contracts.PLAS}`);
  console.log(`  RAIL:  ${deployedContracts.contracts.RAIL}`);
  console.log(`  SCAT:  ${deployedContracts.contracts.SCAT}`);
  console.log(`  RCKT:  ${deployedContracts.contracts.RCKT}`);
  console.log(`  BEAM:  ${deployedContracts.contracts.BEAM}`);
  console.log(`  VOID:  ${deployedContracts.contracts.VOID}`);

  console.log("\n🔗 Verify on BaseScan:");
  console.log(`  https://sepolia.basescan.org/address/${deployedContracts.contracts.ARENA}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
