import { describe, it, expect } from "vitest";
import { AGENT_SMART_WALLETS, ACTIVE_EXPLORER } from "../shared/web3";
import mainnetContracts from "../shared/mainnet-contracts.json";

describe("Agent Smart Wallets", () => {
  it("each agent has a unique wallet address", () => {
    const addresses = AGENT_SMART_WALLETS.map(w => w.walletAddress);
    const unique = new Set(addresses);
    expect(unique.size).toBe(addresses.length);
  });

  it("all agent wallets are valid 0x addresses", () => {
    AGENT_SMART_WALLETS.forEach(w => {
      expect(w.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  it("has at least 6 agent wallets", () => {
    expect(AGENT_SMART_WALLETS.length).toBeGreaterThanOrEqual(6);
  });

  it("agent names match expected roster", () => {
    const names = AGENT_SMART_WALLETS.map(w => w.agentName);
    expect(names).toContain("NEXUS-7");
    expect(names).toContain("PHANTOM");
    expect(names).toContain("TITAN");
    expect(names).toContain("CIPHER");
    expect(names).toContain("AURORA");
    expect(names).toContain("WRAITH");
  });

  it("all wallets are autonomous", () => {
    AGENT_SMART_WALLETS.forEach(w => {
      expect(w.autonomous).toBe(true);
    });
  });

  it("wallets reference the ERC-4337 EntryPoint", () => {
    AGENT_SMART_WALLETS.forEach(w => {
      expect(w.entryPoint).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  it("mainnet-contracts.json has agent wallet entries", () => {
    expect(mainnetContracts.agentWallets).toBeDefined();
    expect(Object.keys(mainnetContracts.agentWallets).length).toBeGreaterThanOrEqual(6);
  });

  it("wallet addresses match mainnet-contracts.json", () => {
    const wallet1 = AGENT_SMART_WALLETS.find(w => w.agentName === "NEXUS-7");
    expect(wallet1).toBeDefined();
    expect(wallet1!.walletAddress.toLowerCase()).toBe(
      mainnetContracts.agentWallets["agent-1"].toLowerCase()
    );
  });

  it("ACTIVE_EXPLORER points to Base mainnet", () => {
    expect(ACTIVE_EXPLORER).toBe("https://basescan.org");
  });
});
