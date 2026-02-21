#!/usr/bin/env node
/**
 * Verify all 9 Token Arena contracts on BaseScan (Base Mainnet)
 * Uses solc's import resolution to collect ALL transitive dependencies
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

const require = createRequire(import.meta.url);
const solc = require("solc");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const BASESCAN_API_KEY = "SGTK888FIYG1H2483B561MBPJ755YG5G2P";
// Base Mainnet API URL
const API_URL = "https://api.etherscan.io/v2/api?chainid=8453";
const DEPLOYER = "0x0b923f3Cfa9ad1D926bDce8Fd1494534d4DA27B3";

const deployed = JSON.parse(fs.readFileSync(path.join(ROOT, "shared/mainnet-contracts.json"), "utf-8"));

function collectAllSources(contractPath, contractSource) {
  const collected = {};
  function findImports(importPath) {
    const resolved = path.join(ROOT, "node_modules", importPath);
    if (fs.existsSync(resolved)) {
      const content = fs.readFileSync(resolved, "utf-8");
      collected[importPath] = { content };
      return { contents: content };
    }
    return { error: "File not found: " + importPath };
  }
  const input = {
    language: "Solidity",
    sources: { [contractPath]: { content: contractSource } },
    settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi"] } } },
  };
  solc.compile(JSON.stringify(input), { import: findImports });
  const sources = { [contractPath]: { content: contractSource } };
  Object.assign(sources, collected);
  console.log(`  Resolved ${Object.keys(sources).length} source files`);
  return sources;
}

function buildStandardInput(sources) {
  return {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
    },
  };
}

async function submitVerification(address, contractName, sourceFile, standardInput, constructorArgs) {
  console.log(`\nVerifying ${contractName} at ${address}...`);
  const params = new URLSearchParams();
  params.append("module", "contract");
  params.append("action", "verifysourcecode");
  params.append("apikey", BASESCAN_API_KEY);
  params.append("sourceCode", JSON.stringify(standardInput));
  params.append("codeformat", "solidity-standard-json-input");
  params.append("contractaddress", address);
  params.append("contractname", `${sourceFile}:${contractName}`);
  params.append("compilerversion", "v0.8.24+commit.e11b9ed9");
  params.append("optimizationUsed", "1");
  params.append("runs", "200");
  params.append("constructorArguements", constructorArgs);

  const resp = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await resp.json();
  console.log(`  Submit: ${data.status} - ${data.message}`);
  if (data.status === "1" && data.result) {
    console.log(`  GUID: ${data.result}`);
    return data.result;
  }
  console.log(`  Error: ${typeof data.result === 'string' ? data.result.slice(0, 200) : JSON.stringify(data.result)}`);
  return null;
}

async function pollStatus(guid) {
  await new Promise(r => setTimeout(r, 10000));
  for (let i = 0; i < 8; i++) {
    const url = `${API_URL}&module=contract&action=checkverifystatus&guid=${guid}&apikey=${BASESCAN_API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    const result = data.result || "";
    if (result.includes("Pass - Verified") || result.includes("Already Verified")) {
      console.log(`  ✅ ${result}`);
      return true;
    }
    if (result.includes("Fail")) {
      console.log(`  ❌ ${result.slice(0, 200)}`);
      return false;
    }
    console.log(`  ⏳ (${i + 1}/8) Pending...`);
    await new Promise(r => setTimeout(r, 5000));
  }
  console.log(`  ⏳ Still pending`);
  return false;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  TOKEN ARENA — BaseScan Mainnet Verification");
  console.log("═══════════════════════════════════════════════════════\n");

  const arenaSource = fs.readFileSync(path.join(ROOT, "contracts/ArenaToken.sol"), "utf-8");
  const weaponSource = fs.readFileSync(path.join(ROOT, "contracts/WeaponToken.sol"), "utf-8");
  const predictionSource = fs.readFileSync(path.join(ROOT, "contracts/PredictionMarket.sol"), "utf-8");
  const daoSource = fs.readFileSync(path.join(ROOT, "contracts/TokenArenaDAO.sol"), "utf-8");

  console.log("Resolving ArenaToken dependencies...");
  const arenaSources = collectAllSources("contracts/ArenaToken.sol", arenaSource);
  const arenaInput = buildStandardInput(arenaSources);

  console.log("\nResolving WeaponToken dependencies...");
  const weaponSources = collectAllSources("contracts/WeaponToken.sol", weaponSource);
  const weaponInput = buildStandardInput(weaponSources);

  console.log("\nResolving PredictionMarket dependencies...");
  const predictionSources = collectAllSources("contracts/PredictionMarket.sol", predictionSource);
  const predictionInput = buildStandardInput(predictionSources);

  console.log("\nResolving TokenArenaDAO dependencies...");
  const daoSources = collectAllSources("contracts/TokenArenaDAO.sol", daoSource);
  const daoInput = buildStandardInput(daoSources);

  const results = {};

  // 1. ARENA - constructor(address initialOwner)
  const arenaArgs = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [DEPLOYER]).slice(2);
  const arenaGuid = await submitVerification(
    deployed.contracts.ARENA, "ArenaToken", "contracts/ArenaToken.sol", arenaInput, arenaArgs
  );
  if (arenaGuid) results.ARENA = await pollStatus(arenaGuid);
  else results.ARENA = false;

  // 2. Weapon tokens - constructor(string name, string symbol, string weaponType, uint256 maxSupply, address initialOwner)
  const weapons = [
    { symbol: "PLAS", name: "Plasma Ammo Token", type: "plasma", maxSupply: "100000000" },
    { symbol: "RAIL", name: "Railgun Ammo Token", type: "railgun", maxSupply: "50000000" },
    { symbol: "SCAT", name: "Scatter Ammo Token", type: "scatter", maxSupply: "75000000" },
    { symbol: "RCKT", name: "Rocket Ammo Token", type: "rocket", maxSupply: "25000000" },
    { symbol: "BEAM", name: "Beam Ammo Token", type: "beam", maxSupply: "100000000" },
    { symbol: "VOID", name: "Void Ammo Token", type: "void", maxSupply: "30000000" },
  ];

  for (const w of weapons) {
    const args = ethers.AbiCoder.defaultAbiCoder().encode(
      ["string", "string", "string", "uint256", "address"],
      [w.name, w.symbol, w.type, ethers.parseEther(w.maxSupply), DEPLOYER]
    ).slice(2);
    const guid = await submitVerification(
      deployed.contracts[w.symbol], "WeaponToken", "contracts/WeaponToken.sol", weaponInput, args
    );
    if (guid) results[w.symbol] = await pollStatus(guid);
    else results[w.symbol] = false;
    await new Promise(r => setTimeout(r, 2000));
  }

  // 3. PredictionMarket - constructor(address _arenaToken, address _daoTreasury)
  const pmArgs = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address"],
    [deployed.contracts.ARENA, DEPLOYER]
  ).slice(2);
  const pmGuid = await submitVerification(
    deployed.contracts.PredictionMarket, "PredictionMarket", "contracts/PredictionMarket.sol", predictionInput, pmArgs
  );
  if (pmGuid) results.PredictionMarket = await pollStatus(pmGuid);
  else results.PredictionMarket = false;

  // 4. TokenArenaDAO - constructor(address _arenaToken)
  await new Promise(r => setTimeout(r, 2000));
  const daoArgs = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [deployed.contracts.ARENA]
  ).slice(2);
  const daoGuid = await submitVerification(
    deployed.contracts.TokenArenaDAO, "TokenArenaDAO", "contracts/TokenArenaDAO.sol", daoInput, daoArgs
  );
  if (daoGuid) results.TokenArenaDAO = await pollStatus(daoGuid);
  else results.TokenArenaDAO = false;

  // Summary
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  VERIFICATION SUMMARY");
  console.log("═══════════════════════════════════════════════════════");
  let verified = 0;
  for (const [sym, ok] of Object.entries(results)) {
    console.log(`  ${sym.padEnd(20)} ${deployed.contracts[sym]}  ${ok ? "✅ Verified" : "❌ Failed"}`);
    if (ok) verified++;
  }
  console.log(`\n  ${verified}/${Object.keys(results).length} contracts verified on BaseScan`);
  console.log("═══════════════════════════════════════════════════════");
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
