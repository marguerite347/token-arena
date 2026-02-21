#!/usr/bin/env node
/**
 * Deploy TokenArenaDAO.sol to Base Sepolia
 * Usage: DEPLOYER_PRIVATE_KEY=0x... BASESCAN_API_KEY=... node scripts/deploy-dao.mjs
 */
import { ethers } from "ethers";
import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
const BASESCAN_API = "https://api-sepolia.basescan.org/api";

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  const basescanKey = process.env.BASESCAN_API_KEY;

  if (!privateKey) {
    console.error("❌ DEPLOYER_PRIVATE_KEY not set");
    process.exit(1);
  }

  console.log("🔨 Compiling TokenArenaDAO.sol...");

  // Compile with solc
  const contractPath = path.join(ROOT, "contracts", "TokenArenaDAO.sol");
  const source = readFileSync(contractPath, "utf8");

  // Use solcjs for compilation
  const solc = await import("solc");
  const input = {
    language: "Solidity",
    sources: { "TokenArenaDAO.sol": { content: source } },
    settings: {
      outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
      optimizer: { enabled: true, runs: 200 },
    },
  };

  const output = JSON.parse(solc.default.compile(JSON.stringify(input)));

  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === "error");
    if (errors.length > 0) {
      console.error("❌ Compilation errors:", errors.map(e => e.message).join("\n"));
      process.exit(1);
    }
    // Print warnings
    output.errors.forEach(e => console.warn("⚠️ ", e.message));
  }

  const contract = output.contracts["TokenArenaDAO.sol"]["TokenArenaDAO"];
  const abi = contract.abi;
  const bytecode = contract.evm.bytecode.object;

  console.log("✅ Compilation successful");

  // Connect to Base Sepolia
  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`\n🔑 Deployer: ${wallet.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther("0.001")) {
    console.error("❌ Insufficient ETH for deployment. Need at least 0.001 ETH on Base Sepolia.");
    process.exit(1);
  }

  // Read ARENA token address from deployed contracts
  const deployedContracts = JSON.parse(
    readFileSync(path.join(ROOT, "shared", "deployed-contracts.json"), "utf8")
  );
  const arenaAddress = deployedContracts.contracts.ARENA;
  console.log(`\n🏟️  ARENA Token: ${arenaAddress}`);

  // Deploy TokenArenaDAO
  console.log("\n🚀 Deploying TokenArenaDAO...");
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const deployTx = await factory.deploy(arenaAddress);
  console.log(`📤 Deploy tx: ${deployTx.target || "pending..."}`);

  const receipt = await deployTx.waitForDeployment();
  const daoAddress = await deployTx.getAddress();

  console.log(`\n✅ TokenArenaDAO deployed!`);
  console.log(`📍 Address: ${daoAddress}`);
  console.log(`🔗 BaseScan: https://sepolia.basescan.org/address/${daoAddress}`);

  // Update deployed-contracts.json
  deployedContracts.contracts.TokenArenaDAO = daoAddress;
  deployedContracts.txHashes = deployedContracts.txHashes || {};
  deployedContracts.txHashes.TokenArenaDAO = deployTx.deploymentTransaction()?.hash || "";
  deployedContracts.deployedAt = new Date().toISOString();

  writeFileSync(
    path.join(ROOT, "shared", "deployed-contracts.json"),
    JSON.stringify(deployedContracts, null, 2)
  );
  console.log("📝 Updated shared/deployed-contracts.json");

  // Verify on BaseScan
  if (basescanKey) {
    console.log("\n🔍 Verifying on BaseScan...");
    await new Promise(resolve => setTimeout(resolve, 15000)); // Wait for indexing

    // ABI-encode constructor args: address arenaToken
    const encodedArgs = ethers.AbiCoder.defaultAbiCoder()
      .encode(["address"], [arenaAddress])
      .slice(2); // remove 0x

    const verifyParams = new URLSearchParams({
      apikey: basescanKey,
      module: "contract",
      action: "verifysourcecode",
      contractaddress: daoAddress,
      sourceCode: source,
      codeformat: "solidity-single-file",
      contractname: "TokenArenaDAO",
      compilerversion: "v0.8.20+commit.a1b79de6",
      optimizationUsed: "1",
      runs: "200",
      constructorArguements: encodedArgs,
      licenseType: "3", // MIT
    });

    try {
      const verifyRes = await fetch(`${BASESCAN_API}`, {
        method: "POST",
        body: verifyParams,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const verifyData = await verifyRes.json();
      console.log("Verification response:", verifyData);

      if (verifyData.status === "1") {
        const guid = verifyData.result;
        console.log(`✅ Verification submitted! GUID: ${guid}`);

        // Check verification status
        await new Promise(resolve => setTimeout(resolve, 10000));
        const checkRes = await fetch(
          `${BASESCAN_API}?apikey=${basescanKey}&module=contract&action=checkverifystatus&guid=${guid}`
        );
        const checkData = await checkRes.json();
        console.log("Verification status:", checkData.result);
      } else {
        console.warn("⚠️  Verification may have failed:", verifyData.result);
      }
    } catch (err) {
      console.warn("⚠️  Verification request failed:", err.message);
    }
  }

  console.log("\n🎉 DAO Deployment Complete!");
  console.log(`   Contract: ${daoAddress}`);
  console.log(`   Network: Base Sepolia (chainId: 84532)`);
  console.log(`   ARENA Token: ${arenaAddress}`);
  console.log(`   BaseScan: https://sepolia.basescan.org/address/${daoAddress}`);

  // Save ABI for frontend use
  const abiPath = path.join(ROOT, "shared", "TokenArenaDAO.abi.json");
  writeFileSync(abiPath, JSON.stringify(abi, null, 2));
  console.log(`   ABI saved: shared/TokenArenaDAO.abi.json`);

  return daoAddress;
}

main().catch(err => {
  console.error("❌ Deployment failed:", err.message);
  process.exit(1);
});
