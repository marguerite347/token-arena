#!/usr/bin/env node
/**
 * Compile Solidity contracts using solc npm package
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const solc = require("solc");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function findImports(importPath) {
  const resolved = path.join(ROOT, "node_modules", importPath);
  if (fs.existsSync(resolved)) {
    return { contents: fs.readFileSync(resolved, "utf-8") };
  }
  return { error: "File not found: " + importPath };
}

const arenaSource = fs.readFileSync(path.join(ROOT, "contracts/ArenaToken.sol"), "utf-8");
const weaponSource = fs.readFileSync(path.join(ROOT, "contracts/WeaponToken.sol"), "utf-8");

const input = {
  language: "Solidity",
  sources: {
    "contracts/ArenaToken.sol": { content: arenaSource },
    "contracts/WeaponToken.sol": { content: weaponSource },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
  },
};

console.log("Compiling contracts...");
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

if (output.errors) {
  const errs = output.errors.filter(e => e.severity === "error");
  if (errs.length > 0) {
    console.error("Compilation errors:");
    errs.forEach(e => console.error(e.formattedMessage));
    process.exit(1);
  }
  // Print warnings
  output.errors.filter(e => e.severity === "warning").forEach(e => console.warn(e.formattedMessage));
}

// Save artifacts
const arenaDir = path.join(ROOT, "artifacts/contracts/ArenaToken.sol");
const weaponDir = path.join(ROOT, "artifacts/contracts/WeaponToken.sol");
fs.mkdirSync(arenaDir, { recursive: true });
fs.mkdirSync(weaponDir, { recursive: true });

const arenaContract = output.contracts["contracts/ArenaToken.sol"]["ArenaToken"];
fs.writeFileSync(path.join(arenaDir, "ArenaToken.json"), JSON.stringify({
  abi: arenaContract.abi,
  bytecode: "0x" + arenaContract.evm.bytecode.object,
}, null, 2));

const weaponContract = output.contracts["contracts/WeaponToken.sol"]["WeaponToken"];
fs.writeFileSync(path.join(weaponDir, "WeaponToken.json"), JSON.stringify({
  abi: weaponContract.abi,
  bytecode: "0x" + weaponContract.evm.bytecode.object,
}, null, 2));

console.log("Compiled successfully!");
console.log(`ArenaToken bytecode: ${arenaContract.evm.bytecode.object.length / 2} bytes`);
console.log(`WeaponToken bytecode: ${weaponContract.evm.bytecode.object.length / 2} bytes`);
console.log(`Artifacts saved to ${path.join(ROOT, "artifacts/")}`);
