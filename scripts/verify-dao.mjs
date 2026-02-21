#!/usr/bin/env node
/**
 * Verify TokenArenaDAO on BaseScan using Etherscan V2 API
 */
import { ethers } from "ethers";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const BASESCAN_V2_API = "https://api.etherscan.io/v2/api";
const CHAIN_ID = 84532; // Base Sepolia

async function main() {
  const basescanKey = process.env.BASESCAN_API_KEY;
  if (!basescanKey) {
    console.error("❌ BASESCAN_API_KEY not set");
    process.exit(1);
  }

  const deployedContracts = JSON.parse(
    readFileSync(path.join(ROOT, "shared", "deployed-contracts.json"), "utf8")
  );
  const daoAddress = deployedContracts.contracts.TokenArenaDAO;
  const arenaAddress = deployedContracts.contracts.ARENA;

  if (!daoAddress) {
    console.error("❌ TokenArenaDAO not found in deployed-contracts.json");
    process.exit(1);
  }

  console.log(`🔍 Verifying TokenArenaDAO at ${daoAddress}...`);

  const source = readFileSync(
    path.join(ROOT, "contracts", "TokenArenaDAO.sol"),
    "utf8"
  );

  // ABI-encode constructor args
  const encodedArgs = ethers.AbiCoder.defaultAbiCoder()
    .encode(["address"], [arenaAddress])
    .slice(2);

  const params = new URLSearchParams({
    chainid: String(CHAIN_ID),
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

  const res = await fetch(BASESCAN_V2_API, {
    method: "POST",
    body: params,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const data = await res.json();
  console.log("Submit response:", JSON.stringify(data, null, 2));

  if (data.status === "1" || (data.result && !data.result.includes("NOTOK"))) {
    const guid = data.result;
    console.log(`✅ Verification submitted! GUID: ${guid}`);

    // Poll for status
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 10000));
      const checkRes = await fetch(
        `${BASESCAN_V2_API}?chainid=${CHAIN_ID}&apikey=${basescanKey}&module=contract&action=checkverifystatus&guid=${guid}`
      );
      const checkData = await checkRes.json();
      console.log(`Status check ${i + 1}:`, checkData.result);
      if (checkData.result && checkData.result.includes("Pass")) {
        console.log("✅ Contract verified on BaseScan!");
        console.log(`🔗 https://sepolia.basescan.org/address/${daoAddress}#code`);
        return;
      }
      if (checkData.result && checkData.result.includes("Fail")) {
        console.error("❌ Verification failed:", checkData.result);
        return;
      }
    }
  } else {
    console.warn("⚠️  Unexpected response:", data);
  }
}

main().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
