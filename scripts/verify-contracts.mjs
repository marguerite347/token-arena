#!/usr/bin/env node
/**
 * Token Arena — Verify contracts on BaseScan (Base Sepolia)
 * Uses Etherscan V2 API: https://api.etherscan.io/v2/api?chainid=84532
 * 
 * Requires: BASESCAN_API_KEY env var (get free key from https://basescan.org/apis)
 * Or tries without API key (rate limited but works for verification)
 */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const solc = require("solc");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const ETHERSCAN_V2_URL = "https://api.etherscan.io/v2/api";
const CHAIN_ID = 84532;
const API_KEY = process.env.BASESCAN_API_KEY || "";

const CONTRACTS = JSON.parse(
  readFileSync(path.join(ROOT, "shared/deployed-contracts.json"), "utf-8")
);

// Flatten all Solidity sources for standard JSON input
function getAllSources() {
  const sources = {};
  
  function addSource(importPath) {
    if (sources[importPath]) return;
    
    let fullPath;
    if (importPath.startsWith("@")) {
      fullPath = path.join(ROOT, "node_modules", importPath);
    } else {
      fullPath = path.join(ROOT, importPath);
    }
    
    const content = readFileSync(fullPath, "utf-8");
    sources[importPath] = { content };
    
    // Find imports recursively
    const importRegex = /import\s+.*?["'](.+?)["']/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const dep = match[1];
      if (dep.startsWith("@")) {
        addSource(dep);
      } else {
        // Resolve relative import
        const dir = path.dirname(importPath);
        const resolved = path.join(dir, dep).replace(/\\/g, "/");
        addSource(resolved);
      }
    }
  }
  
  addSource("contracts/ArenaToken.sol");
  addSource("contracts/WeaponToken.sol");
  
  return sources;
}

function buildStandardJsonInput(sources) {
  return {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode"] }
      }
    }
  };
}

async function verifyContract(address, contractName, sourceFile, constructorArgs) {
  const sources = getAllSources();
  const standardJsonInput = buildStandardJsonInput(sources);
  
  const params = new URLSearchParams();
  params.append("chainid", CHAIN_ID.toString());
  params.append("module", "contract");
  params.append("action", "verifysourcecode");
  if (API_KEY) params.append("apikey", API_KEY);
  params.append("sourceCode", JSON.stringify(standardJsonInput));
  params.append("contractaddress", address);
  params.append("codeformat", "solidity-standard-json-input");
  params.append("contractname", `${sourceFile}:${contractName}`);
  params.append("compilerversion", "v0.8.24+commit.e11b9ed9");
  params.append("optimizationUsed", "1");
  params.append("runs", "200");
  if (constructorArgs) {
    params.append("constructorArguements", constructorArgs);
  }
  
  console.log(`\nVerifying ${contractName} at ${address}...`);
  
  const resp = await fetch(ETHERSCAN_V2_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  
  const data = await resp.json();
  console.log(`  Response: ${JSON.stringify(data)}`);
  
  if (data.status === "1" || data.result) {
    const guid = data.result;
    console.log(`  GUID: ${guid}`);
    
    // Poll for verification result
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const checkParams = new URLSearchParams();
      checkParams.append("chainid", CHAIN_ID.toString());
      checkParams.append("module", "contract");
      checkParams.append("action", "checkverifystatus");
      checkParams.append("guid", guid);
      if (API_KEY) checkParams.append("apikey", API_KEY);
      
      const checkResp = await fetch(`${ETHERSCAN_V2_URL}?${checkParams.toString()}`);
      const checkData = await checkResp.json();
      console.log(`  Check ${i+1}: ${checkData.result}`);
      
      if (checkData.result === "Pass - Verified" || checkData.result?.includes("Already Verified")) {
        console.log(`  ✅ ${contractName} VERIFIED!`);
        return true;
      }
      if (checkData.result?.includes("Fail") && !checkData.result?.includes("Pending")) {
        console.log(`  ❌ Verification failed: ${checkData.result}`);
        return false;
      }
    }
  } else {
    console.log(`  ❌ Submission failed: ${data.message || data.result}`);
    return false;
  }
  
  return false;
}

// Encode constructor arguments using ethers
async function getConstructorArgs(contractName, args) {
  const { ethers } = await import("ethers");
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  
  if (contractName === "ArenaToken") {
    // constructor(address initialOwner)
    return abiCoder.encode(["address"], args).slice(2);
  } else {
    // constructor(string name, string symbol, string _weaponType, uint256 _maxSupply, address initialOwner)
    return abiCoder.encode(
      ["string", "string", "string", "uint256", "address"],
      args
    ).slice(2);
  }
}

async function main() {
  const deployer = CONTRACTS.deployer;
  const { ethers } = await import("ethers");
  
  console.log("═══════════════════════════════════════════════════════");
  console.log("  TOKEN ARENA — Contract Verification");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  API Key: ${API_KEY ? "provided" : "not set (may be rate limited)"}`);
  
  const results = {};
  
  // 1. Verify ArenaToken
  const arenaArgs = await getConstructorArgs("ArenaToken", [deployer]);
  results.ARENA = await verifyContract(
    CONTRACTS.contracts.ARENA,
    "ArenaToken",
    "contracts/ArenaToken.sol",
    arenaArgs
  );
  
  // 2. Verify WeaponTokens
  const weaponConfigs = [
    { symbol: "PLAS", name: "Plasma Ammo", type: "plasma", maxSupply: "100000000" },
    { symbol: "RAIL", name: "Railgun Ammo", type: "railgun", maxSupply: "50000000" },
    { symbol: "SCAT", name: "Scatter Ammo", type: "scatter", maxSupply: "200000000" },
    { symbol: "RCKT", name: "Rocket Ammo", type: "missile", maxSupply: "25000000" },
    { symbol: "BEAM", name: "Beam Ammo", type: "beam", maxSupply: "75000000" },
    { symbol: "VOID", name: "Void Ammo", type: "nova", maxSupply: "10000000" },
  ];
  
  for (const w of weaponConfigs) {
    const args = await getConstructorArgs("WeaponToken", [
      w.name,
      w.symbol,
      w.type,
      ethers.parseEther(w.maxSupply),
      deployer,
    ]);
    
    results[w.symbol] = await verifyContract(
      CONTRACTS.contracts[w.symbol],
      "WeaponToken",
      "contracts/WeaponToken.sol",
      args
    );
    
    // Delay between submissions to avoid rate limiting
    await new Promise(r => setTimeout(r, 3000));
  }
  
  // Summary
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  Verification Summary");
  console.log("═══════════════════════════════════════════════════════");
  for (const [sym, ok] of Object.entries(results)) {
    console.log(`  ${sym.padEnd(8)} ${ok ? "✅ Verified" : "❌ Failed"}`);
  }
}

main().catch(err => {
  console.error("Verification failed:", err.message);
  process.exit(1);
});
